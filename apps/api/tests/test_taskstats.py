from tests.conftest import auth_headers


def _seed_tasks(client, headers):
    tl = client.post("/tasklists", json={"name": "TL"}, headers=headers).get_json()
    tl_id = tl["id"]

    statuses = [("completed", "2025-01-01"), ("todo", "2026-12-31"), ("in-progress", "2026-12-31")]
    for status, due in statuses:
        client.post("/tasks", json={
            "title": f"Task {status}",
            "priority": "medium",
            "status": status,
            "due_date": due,
            "tasklist_id": tl_id,
        }, headers=headers)
    return tl_id


class TestTaskStats:
    def test_returns_counts(self, client):
        h = auth_headers(client)
        _seed_tasks(client, h)

        res = client.get("/api/task-stats", headers=h)
        assert res.status_code == 200
        data = res.get_json()
        assert "completed" in data
        assert "pending" in data
        assert "inProgress" in data
        assert "overdue" in data
        assert data["completed"] == 1

    def test_requires_auth(self, client):
        res = client.get("/api/task-stats")
        assert res.status_code == 401


class TestUpcomingTasks:
    def test_returns_upcoming(self, client):
        h = auth_headers(client)
        tl = client.post("/tasklists", json={"name": "TL"}, headers=h).get_json()
        client.post("/tasks", json={
            "title": "Soon",
            "priority": "high",
            "status": "todo",
            "due_date": "2026-12-31",
            "tasklist_id": tl["id"],
        }, headers=h)

        res = client.get("/api/upcoming-tasks", headers=h)
        assert res.status_code == 200
        titles = [t["title"] for t in res.get_json()]
        assert "Soon" in titles

    def test_excludes_completed(self, client):
        h = auth_headers(client)
        tl = client.post("/tasklists", json={"name": "TL"}, headers=h).get_json()
        client.post("/tasks", json={
            "title": "Done task",
            "priority": "low",
            "status": "completed",
            "due_date": "2026-12-31",
            "tasklist_id": tl["id"],
        }, headers=h)

        res = client.get("/api/upcoming-tasks", headers=h)
        assert res.status_code == 200
        assert not any(t["title"] == "Done task" for t in res.get_json())


class TestVelocity:
    def test_returns_eight_weeks(self, client):
        h = auth_headers(client)
        res = client.get("/api/task-stats/velocity", headers=h)
        assert res.status_code == 200
        data = res.get_json()
        assert len(data) == 8
        assert "week" in data[0]
        assert "completed" in data[0]

    def test_requires_auth(self, client):
        res = client.get("/api/task-stats/velocity")
        assert res.status_code == 401
