from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from access import (
    can_access_tasklist, current_user, visible_tasklist_query, workspace_id_for_owner,
)
from files import attachment_dir, attachment_filenames_for_lists, remove_files
from models import db, Task, TaskList, User
from serializers import serialize_tasks
from validation import int_list, json_body

tasklist_bp = Blueprint('tasklist', __name__, url_prefix='/tasklists')


def _serialize_list(tasklist, with_tasks=True):
    owner = db.session.get(User, tasklist.user_id)
    out = {
        "id": tasklist.id,
        "name": tasklist.name,
        "user_id": tasklist.user_id,
        "owner_name": owner.username if owner else None,
    }
    if with_tasks:
        tasks = sorted(
            (t for t in tasklist.tasks if t.parent_task_id is None),
            key=lambda t: (t.list_position, t.id),
        )
        out["tasks"] = serialize_tasks(tasks)
    return out


def _valid_name(data):
    name = data.get("name")
    name = name.strip() if isinstance(name, str) else ""
    if not name:
        return None, "Task list name is required"
    if len(name) > 120:
        return None, "Task list name must be 120 characters or fewer"
    return name, None


def _name_taken(user_id, name, exclude_id=None):
    q = TaskList.query.filter(
        TaskList.user_id == user_id,
        TaskList.is_template.isnot(True),
        db.func.lower(TaskList.name) == name.lower(),
    )
    if exclude_id is not None:
        q = q.filter(TaskList.id != exclude_id)
    return q.first() is not None


def _announce(tasklist_owner_id):
    ws = workspace_id_for_owner(tasklist_owner_id)
    if ws:
        from views.realtime import emit_tasklist_changed
        emit_tasklist_changed(ws)


@tasklist_bp.route('/', methods=['GET'])
@jwt_required()
def get_all_tasklist():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 100, type=int), 200)
    tasklists = (
        visible_tasklist_query(user)
        .order_by(TaskList.id)
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return jsonify([_serialize_list(tl) for tl in tasklists.items]), 200


@tasklist_bp.route('/<int:tasklist_id>', methods=['GET'])
@jwt_required()
def get_tasklist(tasklist_id):
    user = current_user()
    tasklist = db.session.get(TaskList, tasklist_id)
    if not user or not can_access_tasklist(user, tasklist) or tasklist.is_template:
        return jsonify({"error": "Task list not found"}), 404
    return jsonify(_serialize_list(tasklist)), 200


@tasklist_bp.route('/', methods=['POST'])
@jwt_required()
def create_tasklist():
    user = current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    name, err = _valid_name(json_body())
    if err:
        return jsonify({"error": err}), 400
    if _name_taken(user.id, name):
        return jsonify({"error": "You already have a list with that name"}), 409

    tasklist = TaskList(name=name, user_id=user.id)
    db.session.add(tasklist)
    db.session.commit()
    _announce(user.id)

    return jsonify({
        "message": "Task list created successfully",
        **_serialize_list(tasklist),
    }), 201


@tasklist_bp.route('/<int:tasklist_id>', methods=['PUT'])
@jwt_required()
def update_tasklist(tasklist_id):
    user = current_user()
    tasklist = TaskList.query.filter_by(id=tasklist_id, user_id=user.id if user else -1).first()
    if not tasklist:
        return jsonify({"error": "Task list not found"}), 404

    name, err = _valid_name(json_body())
    if err:
        return jsonify({"error": err}), 400
    if _name_taken(user.id, name, exclude_id=tasklist_id):
        return jsonify({"error": "Task list name already exists"}), 400

    tasklist.name = name
    db.session.commit()
    _announce(user.id)
    return jsonify({"message": "Task list updated successfully", "name": name}), 200


@tasklist_bp.route('/<int:tasklist_id>/reorder', methods=['PATCH'])
@jwt_required()
def reorder_tasklist(tasklist_id):
    """Persist the order of tasks inside one list (top to bottom)."""
    user = current_user()
    tasklist = db.session.get(TaskList, tasklist_id)
    if not user or not can_access_tasklist(user, tasklist):
        return jsonify({"error": "Task list not found"}), 404

    order = int_list(json_body().get("order"))
    if order is None or len(set(order)) != len(order):
        return jsonify({"error": "order must be a list of unique task ids"}), 400

    tasks = {t.id: t for t in Task.query.filter_by(tasklist_id=tasklist.id, parent_task_id=None)}
    if not set(order) <= set(tasks):
        return jsonify({"error": "order contains tasks that are not in this list"}), 400

    for pos, task_id in enumerate(order):
        tasks[task_id].list_position = pos
    db.session.commit()
    return jsonify({"message": "Reordered", "count": len(order)}), 200


@tasklist_bp.route('/<int:tasklist_id>', methods=['DELETE'])
@jwt_required()
def delete_tasklist(tasklist_id):
    user = current_user()
    tasklist = TaskList.query.filter_by(id=tasklist_id, user_id=user.id if user else -1).first()
    if not tasklist:
        return jsonify({"error": "Task list not found"}), 404

    files = attachment_filenames_for_lists([tasklist.id])
    db.session.delete(tasklist)
    db.session.commit()
    remove_files(attachment_dir(), files)
    _announce(user.id)
    return jsonify({"message": "Task list deleted successfully"}), 200
