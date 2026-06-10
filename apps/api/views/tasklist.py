from flask import Blueprint, request, jsonify
from models import db, TaskList, Task, User
from flask_jwt_extended import jwt_required, get_jwt_identity


tasklist_bp = Blueprint('tasklist', __name__, url_prefix='/tasklists')


def _serialize_task(task):
    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "priority": task.priority,
        "status": task.status,
        "position": task.position,
        "assignments": [
            {"user_id": a.user_id, "username": a.user.username if a.user else "Unknown"}
            for a in task.assignments
        ],
    }


def _workspace_tasklist_query(user):
    """Return a query for all non-template tasklists visible to this user."""
    base = TaskList.query.filter(TaskList.is_template == False)  # noqa: E712
    if user.workspace_id:
        member_ids = db.session.query(User.id).filter_by(workspace_id=user.workspace_id)
        return base.filter(TaskList.user_id.in_(member_ids))
    return base.filter(TaskList.user_id == user.id)


@tasklist_bp.route('/', methods=['GET'])
@jwt_required()
def get_all_tasklist():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        return jsonify({"error": "User not found"}), 404

    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 100, type=int)

    tasklists = _workspace_tasklist_query(user).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify([
        {
            "id": tl.id,
            "name": tl.name,
            "tasks": [_serialize_task(t) for t in tl.tasks],
        }
        for tl in tasklists.items
    ]), 200


@tasklist_bp.route('/<int:tasklist_id>', methods=['GET'])
@jwt_required()
def get_tasklist(tasklist_id):
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        return jsonify({"error": "User not found"}), 404

    tasklist = db.session.get(TaskList, tasklist_id)
    if not tasklist:
        return jsonify({"error": "Task list not found"}), 404

    # Allow access if owner or same workspace member
    if tasklist.user_id != user.id:
        owner = db.session.get(User, tasklist.user_id)
        if not owner or owner.workspace_id != user.workspace_id:
            return jsonify({"error": "Unauthorized"}), 403

    return jsonify({
        "id": tasklist.id,
        "name": tasklist.name,
        "tasks": [_serialize_task(t) for t in tasklist.tasks],
    }), 200


@tasklist_bp.route('/templates', methods=['GET'])
@jwt_required()
def get_tasklist_templates():
    templates = TaskList.query.filter_by(is_template=True).all()

    return jsonify([
        {
            "id": template.id,
            "name": template.name,
            "tasks": [_serialize_task(t) for t in template.tasks],
        }
        for template in templates
    ]), 200


@tasklist_bp.route('/', methods=['POST'])
@jwt_required()
def create_tasklist():
    user_id = get_jwt_identity()
    data = request.get_json()

    if not data or not data.get('name'):
        return jsonify({"error": "Task list name is required"}), 400
    
    if 'template_id' in data:
        template = TaskList.query.filter_by(id=data['template_id'], is_template=True).first()
        if not template:
            return jsonify({"error": "Template not found"}), 404
        
        new_tasklist = TaskList(name=template.name, user_id=user_id)
        new_tasklist.tasks = [Task(title=task.title, description=task.description) for task in template.tasks]
        db.session.add(new_tasklist)
        db.session.commit()
    else:
        new_tasklist = TaskList(name=data['name'], user_id=user_id)
        db.session.add(new_tasklist)
        db.session.commit()

    return jsonify({
        "message": "Task list created successfully", 
        "id": new_tasklist.id,
        "name": new_tasklist.name,
        "tasks": []
    }), 201

# Update a task list
@tasklist_bp.route('/<int:tasklist_id>', methods=['PUT'])
@jwt_required()
def update_tasklist(tasklist_id):
    user_id = get_jwt_identity()
    tasklist = TaskList.query.filter_by(id=tasklist_id, user_id=user_id).first()

    if not tasklist:
        return jsonify({"error": "Task list not found"}), 404

    data = request.get_json()
    new_name = data.get('name')

    if not new_name:
        return jsonify({"error": "Task list name is required"}), 400

    existing = TaskList.query.filter_by(name=new_name, user_id=user_id).first()
    if existing and existing.id != tasklist_id:
        return jsonify({"error": "Task list name already exists"}), 400

    tasklist.name = new_name
    db.session.commit()
    return jsonify({"message": "Task list updated successfully"}), 200

# Delete a task list
@tasklist_bp.route('/<int:tasklist_id>', methods=['DELETE'])
@jwt_required()
def delete_tasklist(tasklist_id):
    user_id = get_jwt_identity()
    tasklist = TaskList.query.filter_by(id=tasklist_id, user_id=user_id).first()

    if not tasklist:
        return jsonify({"error": "Task list not found"}), 404

    db.session.delete(tasklist)
    db.session.commit()
    return jsonify({"message": "Task list deleted successfully"}), 200
