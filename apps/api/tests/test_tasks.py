from tests.conftest import auth_headers, register


def _make_tasklist(client, headers, name="My List"):
    res = client.post("/tasklists", json={"name": name}, headers=headers)
    return res.get_json()["id"]


def _make_task(client, headers, tasklist_id, title="Test Task"):
    return client.post("/tasks", json={
        "title": title,
        "description": "desc",
        "due_date": "2026-12-31",
        "priority": "medium",
        "status": "todo",
        "tasklist_id": tasklist_id,
    }, headers=headers)


class TestCreateTask:
    def test_create_success(self, client):
        h = auth_headers(client)
        tl_id = _make_tasklist(client, h)
        res = _make_task(client, h, tl_id)
        assert res.status_code == 201
        data = res.get_json()
        assert data["title"] == "Test Task"
        assert data["priority"] == "medium"

    def test_missing_tasklist(self, client):
        h = auth_headers(client)
        res = client.post("/tasks", json={"title": "X", "tasklist_id": 9999}, headers=h)
        assert res.status_code == 404

    def test_requires_auth(self, client):
        res = client.post("/tasks", json={"title": "X"})
        assert res.status_code == 401


class TestGetTasks:
    def test_returns_user_tasks_only(self, client):
        h = auth_headers(client)
        tl_id = _make_tasklist(client, h)
        _make_task(client, h, tl_id, title="Task A")
        _make_task(client, h, tl_id, title="Task B")

        res = client.get("/tasks", headers=h)
        assert res.status_code == 200
        titles = [t["title"] for t in res.get_json()]
        assert "Task A" in titles
        assert "Task B" in titles

    def test_filter_by_status(self, client):
        h = auth_headers(client)
        tl_id = _make_tasklist(client, h)
        _make_task(client, h, tl_id, title="Todo task")

        res = client.get("/tasks?status=todo", headers=h)
        assert res.status_code == 200
        assert all(t["status"] == "todo" for t in res.get_json())

    def test_filter_by_priority(self, client):
        h = auth_headers(client)
        tl_id = _make_tasklist(client, h)
        _make_task(client, h, tl_id)  # priority=medium by default

        res = client.get("/tasks?priority=medium", headers=h)
        assert res.status_code == 200
        assert all(t["priority"] == "medium" for t in res.get_json())


class TestUpdateTask:
    def test_update_status(self, client):
        h = auth_headers(client)
        tl_id = _make_tasklist(client, h)
        task = _make_task(client, h, tl_id).get_json()

        res = client.patch(f"/tasks/{task['id']}", json={"status": "completed"}, headers=h)
        assert res.status_code == 200
        assert res.get_json()["status"] == "completed"

    def test_update_title(self, client):
        h = auth_headers(client)
        tl_id = _make_tasklist(client, h)
        task = _make_task(client, h, tl_id).get_json()

        res = client.patch(f"/tasks/{task['id']}", json={"title": "Renamed"}, headers=h)
        assert res.status_code == 200
        assert res.get_json()["title"] == "Renamed"

    def test_nonexistent_task(self, client):
        h = auth_headers(client)
        res = client.patch("/tasks/9999", json={"status": "completed"}, headers=h)
        assert res.status_code == 404


class TestDeleteTask:
    def test_delete_success(self, client):
        h = auth_headers(client)
        tl_id = _make_tasklist(client, h)
        task = _make_task(client, h, tl_id).get_json()

        res = client.delete(f"/tasks/{task['id']}", headers=h)
        assert res.status_code == 200

        res2 = client.get("/tasks", headers=h)
        ids = [t["id"] for t in res2.get_json()]
        assert task["id"] not in ids

    def test_delete_nonexistent(self, client):
        h = auth_headers(client)
        res = client.delete("/tasks/9999", headers=h)
        assert res.status_code == 404


class TestCalendarTasks:
    def test_returns_tasks_in_range(self, client):
        h = auth_headers(client)
        tl_id = _make_tasklist(client, h)
        client.post("/tasks", json={
            "title": "Dated Task",
            "due_date": "2026-06-15",
            "priority": "low",
            "tasklist_id": tl_id,
        }, headers=h)

        res = client.get("/tasks/calendar?start=2026-06-01&end=2026-06-30", headers=h)
        assert res.status_code == 200
        assert any(t["title"] == "Dated Task" for t in res.get_json())

    def test_missing_params(self, client):
        h = auth_headers(client)
        res = client.get("/tasks/calendar", headers=h)
        assert res.status_code == 400
