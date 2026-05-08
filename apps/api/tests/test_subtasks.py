from tests.conftest import auth_headers


def _setup(client):
    h = auth_headers(client)
    tl = client.post("/tasklists", json={"name": "TL"}, headers=h).get_json()
    task = client.post("/tasks", json={
        "title": "Parent",
        "priority": "medium",
        "status": "todo",
        "due_date": "2026-12-31",
        "tasklist_id": tl["id"],
    }, headers=h).get_json()
    return h, task["id"]


class TestSubtasks:
    def test_add_subtask(self, client):
        h, task_id = _setup(client)
        res = client.post(f"/tasks/{task_id}/subtasks", json={"title": "Sub 1"}, headers=h)
        assert res.status_code == 201
        data = res.get_json()
        assert data["title"] == "Sub 1"
        assert data["parent_task_id"] == task_id

    def test_list_subtasks(self, client):
        h, task_id = _setup(client)
        client.post(f"/tasks/{task_id}/subtasks", json={"title": "S1"}, headers=h)
        client.post(f"/tasks/{task_id}/subtasks", json={"title": "S2"}, headers=h)

        res = client.get(f"/tasks/{task_id}/subtasks", headers=h)
        assert res.status_code == 200
        assert len(res.get_json()) == 2

    def test_add_subtask_missing_title(self, client):
        h, task_id = _setup(client)
        res = client.post(f"/tasks/{task_id}/subtasks", json={}, headers=h)
        assert res.status_code == 400

    def test_add_subtask_nonexistent_task(self, client):
        h, _ = _setup(client)
        res = client.post("/tasks/9999/subtasks", json={"title": "X"}, headers=h)
        assert res.status_code == 404

    def test_update_subtask_status(self, client):
        h, task_id = _setup(client)
        sub = client.post(f"/tasks/{task_id}/subtasks", json={"title": "Sub"}, headers=h).get_json()

        res = client.patch(f"/subtasks/{sub['id']}", json={"status": "completed"}, headers=h)
        assert res.status_code == 200
        assert res.get_json()["status"] == "completed"

    def test_delete_subtask(self, client):
        h, task_id = _setup(client)
        sub = client.post(f"/tasks/{task_id}/subtasks", json={"title": "Del me"}, headers=h).get_json()

        res = client.delete(f"/subtasks/{sub['id']}", headers=h)
        assert res.status_code == 200

        remaining = client.get(f"/tasks/{task_id}/subtasks", headers=h).get_json()
        assert not any(s["id"] == sub["id"] for s in remaining)

    def test_update_nonexistent_subtask(self, client):
        h, _ = _setup(client)
        res = client.patch("/subtasks/9999", json={"status": "completed"}, headers=h)
        assert res.status_code == 404
