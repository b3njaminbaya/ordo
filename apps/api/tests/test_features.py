from datetime import timedelta

from models import Notification, RecurringTask, Task, TaskReminder, TimeEntry, db
from notifications_service import check_task_deadlines
from tests.conftest import auth_headers
from tests.helpers import make_list, make_task, session_user, team, two_users
from validation import utcnow_naive
from views.recurring import _add_months, spawn_recurring_tasks


def _ids(res):
    return [t["id"] for t in res.get_json()]


class TestSubtasks:
    def test_subtasks_are_not_top_level_tasks(self, client):
        h = auth_headers(client)
        lid = make_list(client, h)
        parent = make_task(client, h, lid, title="Parent")
        sub = client.post(f"/tasks/{parent['id']}/subtasks", json={"title": "Child"}, headers=h).get_json()

        assert _ids(client.get("/tasks", headers=h)) == [parent["id"]]
        listed = client.get("/tasklists/", headers=h).get_json()
        assert [t["id"] for l in listed for t in l["tasks"]] == [parent["id"]]
        assert client.get("/api/task-stats", headers=h).get_json()["total"] == 1
        assert sub["parent_task_id"] == parent["id"]

    def test_parent_card_carries_counts(self, client):
        h = auth_headers(client)
        parent = make_task(client, h, make_list(client, h))
        s1 = client.post(f"/tasks/{parent['id']}/subtasks", json={"title": "a"}, headers=h).get_json()
        client.post(f"/tasks/{parent['id']}/subtasks", json={"title": "b"}, headers=h)
        client.patch(f"/subtasks/{s1['id']}", json={"status": "completed"}, headers=h)
        card = client.get("/tasks", headers=h).get_json()[0]
        assert (card["subtask_count"], card["subtasks_completed"]) == (2, 1)

    def test_deleting_parent_deletes_subtasks(self, client):
        h = auth_headers(client)
        parent = make_task(client, h, make_list(client, h))
        client.post(f"/tasks/{parent['id']}/subtasks", json={"title": "a"}, headers=h)
        assert client.delete(f"/tasks/{parent['id']}", headers=h).status_code == 200
        assert Task.query.count() == 0


class TestOrdering:
    def test_drop_at_index_in_another_column(self, client):
        h = auth_headers(client)
        lid = make_list(client, h)
        a = make_task(client, h, lid, title="a", status="in-progress")
        b = make_task(client, h, lid, title="b", status="in-progress")
        c = make_task(client, h, lid, title="c")
        res = client.patch(f"/tasks/{c['id']}", json={"status": "in-progress", "index": 1}, headers=h)
        assert res.status_code == 200
        col = client.get("/tasks?status=in-progress", headers=h).get_json()
        assert [t["title"] for t in col] == ["a", "c", "b"]

    def test_reorder_column_validates_ids(self, client):
        h = auth_headers(client)
        lid = make_list(client, h)
        a, b = make_task(client, h, lid), make_task(client, h, lid)
        ok = client.patch("/tasks/reorder", json={"status": "todo", "order": [b["id"], a["id"]]}, headers=h)
        assert ok.status_code == 200
        assert _ids(client.get("/tasks", headers=h)) == [b["id"], a["id"]]
        assert client.patch("/tasks/reorder", json={"status": "todo", "order": [a["id"], a["id"]]}, headers=h).status_code == 400
        assert client.patch("/tasks/reorder", json={"status": "todo", "order": ["x"]}, headers=h).status_code == 400
        assert client.patch("/tasks/reorder", json={"status": "todo", "order": [9999]}, headers=h).status_code == 403

    def test_list_order_persists_and_moves_between_lists(self, client):
        h = auth_headers(client)
        l1, l2 = make_list(client, h, "One"), make_list(client, h, "Two")
        a, b = make_task(client, h, l1, title="a"), make_task(client, h, l1, title="b")
        client.patch(f"/tasklists/{l1}/reorder", json={"order": [b["id"], a["id"]]}, headers=h)
        lists = {l["id"]: l for l in client.get("/tasklists/", headers=h).get_json()}
        assert [t["title"] for t in lists[l1]["tasks"]] == ["b", "a"]

        client.patch(f"/tasks/{a['id']}", json={"tasklist_id": l2, "list_index": 0}, headers=h)
        lists = {l["id"]: l for l in client.get("/tasklists/", headers=h).get_json()}
        assert [t["title"] for t in lists[l2]["tasks"]] == ["a"]
        assert [t["title"] for t in lists[l1]["tasks"]] == ["b"]

    def test_completed_at_tracks_status(self, client):
        h = auth_headers(client)
        t = make_task(client, h, make_list(client, h))
        done = client.patch(f"/tasks/{t['id']}", json={"status": "completed"}, headers=h).get_json()
        assert done["completed_at"]
        again = client.patch(f"/tasks/{t['id']}", json={"status": "todo"}, headers=h).get_json()
        assert again["completed_at"] is None


class TestTaskLists:
    def test_name_rules(self, client):
        h = auth_headers(client)
        assert client.post("/tasklists", json={"name": "  "}, headers=h).status_code == 400
        make_list(client, h, "Sprint")
        assert client.post("/tasklists", json={"name": "sprint"}, headers=h).status_code == 409

    def test_only_owner_edits_lists(self, client):
        a, b = team(client)
        lid = make_list(client, a, "Alice list")
        assert client.put(f"/tasklists/{lid}", json={"name": "Hijack"}, headers=b).status_code == 404
        assert client.delete(f"/tasklists/{lid}", headers=b).status_code == 404
        listed = {l["id"]: l for l in client.get("/tasklists/", headers=b).get_json()}
        assert listed[lid]["user_id"] != session_user(client, b)["id"]


class TestAssignmentsAndNotifications:
    def test_set_assignees_replaces_and_notifies(self, client):
        a, b = team(client)
        bob = session_user(client, b)
        task = make_task(client, a, make_list(client, a))

        res = client.put(f"/tasks/{task['id']}/assignees", json={"user_ids": [bob["id"]]}, headers=a)
        assert res.status_code == 200
        assert [x["id"] for x in res.get_json()["task"]["assignees"]] == [bob["id"]]
        assert Notification.query.filter_by(user_id=bob["id"]).count() == 1

        res = client.put(f"/tasks/{task['id']}/assignees", json={"user_ids": []}, headers=a)
        assert res.get_json()["task"]["assignees"] == []

    def test_self_assignment_does_not_notify(self, client):
        h = auth_headers(client)
        me = session_user(client, h)
        task = make_task(client, h, make_list(client, h))
        client.put(f"/tasks/{task['id']}/assignees", json={"user_ids": [me["id"]]}, headers=h)
        assert Notification.query.count() == 0

    def test_create_with_assignee_is_atomic(self, client):
        a, b = team(client)
        bob = session_user(client, b)
        task = make_task(client, a, make_list(client, a), assignee_ids=[bob["id"]])
        assert [x["id"] for x in task["assignees"]] == [bob["id"]]
        bad = client.post("/tasks", json={"title": "x", "tasklist_id": task["tasklist_id"], "assignee_ids": [9999]}, headers=a)
        assert bad.status_code == 400 and Task.query.count() == 1

    def test_notifications_respect_preference(self, client):
        a, b = team(client)
        bob = session_user(client, b)
        client.patch("/users/notifications", json={"notifications_enabled": False}, headers=b)
        task = make_task(client, a, make_list(client, a))
        client.put(f"/tasks/{task['id']}/assignees", json={"user_ids": [bob["id"]]}, headers=a)
        assert Notification.query.filter_by(user_id=bob["id"]).count() == 0
        assert session_user(client, b)["notifications_enabled"] is False

    def test_commenting_notifies_owner_and_assignees_not_author(self, client):
        a, b = team(client)
        task = make_task(client, a, make_list(client, a))
        client.post(f"/tasks/{task['id']}/comments", json={"content": "ping"}, headers=b)
        alice = session_user(client, a)
        assert [n.user_id for n in Notification.query.all()] == [alice["id"]]


class TestDeadlineReminders:
    def _due_in(self, client, h, delta):
        lid = client.get("/tasklists/", headers=h).get_json()[0]["id"]   # the starter list
        return make_task(client, h, lid, due_date=(utcnow_naive() + delta).isoformat())

    def test_each_reminder_fires_once_with_accurate_text(self, client):
        h = auth_headers(client)
        self._due_in(client, h, timedelta(hours=5))
        check_task_deadlines()
        check_task_deadlines()
        notes = Notification.query.all()
        assert len(notes) == 1
        assert "about 5 hours" in notes[0].message or "about 4 hours" in notes[0].message
        assert "24 hours" not in notes[0].message

    def test_overdue_and_completed(self, client):
        h = auth_headers(client)
        late = self._due_in(client, h, timedelta(hours=-2))
        done = self._due_in(client, h, timedelta(hours=-2))
        client.patch(f"/tasks/{done['id']}", json={"status": "completed"}, headers=h)
        check_task_deadlines()
        assert [n.task_id for n in Notification.query.all()] == [late["id"]]

    def test_rescheduling_resets_reminders(self, client):
        h = auth_headers(client)
        t = self._due_in(client, h, timedelta(hours=-2))
        check_task_deadlines()
        assert TaskReminder.query.count() == 1
        new_due = (utcnow_naive() - timedelta(hours=1)).isoformat()
        client.patch(f"/tasks/{t['id']}", json={"due_date": new_due}, headers=h)
        assert TaskReminder.query.count() == 0
        check_task_deadlines()
        assert Notification.query.count() == 2

    def test_subtasks_are_ignored(self, client):
        h = auth_headers(client)
        parent = make_task(client, h, make_list(client, h))
        client.post(f"/tasks/{parent['id']}/subtasks", json={"title": "s"}, headers=h)
        check_task_deadlines()
        assert Notification.query.count() == 0


class TestRecurring:
    def _create(self, client, h, **kw):
        res = client.post("/recurring-tasks", json={"title": "Report", **kw}, headers=h)
        assert res.status_code == 201, res.get_json()
        return res.get_json()

    def test_spawns_once_and_skips_missed_periods(self, client):
        h = auth_headers(client)
        rt = self._create(client, h, recurrence_rule="daily")
        row = db.session.get(RecurringTask, rt["id"])
        row.next_run_at = utcnow_naive() - timedelta(days=5)   # server was "down" for 5 days
        db.session.commit()

        assert spawn_recurring_tasks() == 1
        assert Task.query.count() == 1
        assert db.session.get(RecurringTask, rt["id"]).next_run_at > utcnow_naive()
        assert spawn_recurring_tasks() == 0                      # nothing more due
        assert Task.query.count() == 1

    def test_monthly_uses_calendar_months(self, client):
        from datetime import datetime
        assert _add_months(datetime(2026, 1, 31), 1) == datetime(2026, 2, 28)
        assert _add_months(datetime(2026, 12, 15), 1) == datetime(2027, 1, 15)

    def test_validation_and_list_change(self, client):
        h = auth_headers(client)
        assert client.post("/recurring-tasks", json={"title": "x", "recurrence_interval": "abc"}, headers=h).status_code == 400
        assert client.post("/recurring-tasks", json={"title": "x", "priority": "z"}, headers=h).status_code == 400
        rt = self._create(client, h)
        other = make_list(client, h, "Other")
        res = client.patch(f"/recurring-tasks/{rt['id']}", json={"tasklist_id": other}, headers=h)
        assert res.get_json()["tasklist_id"] == other

    def test_resume_reschedules_from_now(self, client):
        h = auth_headers(client)
        rt = self._create(client, h)
        client.patch(f"/recurring-tasks/{rt['id']}", json={"active": False}, headers=h)
        row = db.session.get(RecurringTask, rt["id"])
        row.next_run_at = utcnow_naive() - timedelta(days=10)
        db.session.commit()
        assert spawn_recurring_tasks() == 0                       # paused
        client.patch(f"/recurring-tasks/{rt['id']}", json={"active": True}, headers=h)
        assert spawn_recurring_tasks() == 0                       # not due right after resuming


class TestStats:
    def test_every_status_is_counted(self, client):
        h = auth_headers(client)
        lid = make_list(client, h)
        for status in ("todo", "in-progress", "pending", "completed"):
            make_task(client, h, lid, status=status)
        s = client.get("/api/task-stats", headers=h).get_json()
        assert (s["todo"], s["inProgress"], s["pending"], s["completed"], s["total"]) == (1, 1, 1, 1, 4)

    def test_stats_cover_the_workspace(self, client):
        a, b = team(client)
        make_task(client, b, make_list(client, b, "Bobs"))
        assert client.get("/api/task-stats", headers=a).get_json()["total"] == 1

    def test_velocity_uses_completion_time_not_last_edit(self, client):
        h = auth_headers(client)
        t = make_task(client, h, make_list(client, h))
        client.patch(f"/tasks/{t['id']}", json={"status": "completed"}, headers=h)
        row = db.session.get(Task, t["id"])
        row.completed_at = utcnow_naive() - timedelta(days=15)
        db.session.commit()
        client.patch(f"/tasks/{t['id']}", json={"title": "edited later"}, headers=h)   # bumps updated_at only
        weeks = client.get("/api/task-stats/velocity", headers=h).get_json()
        assert len(weeks) == 8
        assert weeks[-1]["completed"] == 0 and weeks[-3]["completed"] + weeks[-2]["completed"] == 1

    def test_workload_by_assignment_with_unassigned(self, client):
        a, b = team(client)
        bob = session_user(client, b)
        lid = make_list(client, a)
        make_task(client, a, lid, assignee_ids=[bob["id"]])
        make_task(client, a, lid)
        rows = {r["username"]: r for r in client.get("/api/task-stats/workload", headers=a).get_json()}
        assert rows["bob"]["open"] == 1 and rows["Unassigned"]["open"] == 1 and rows["alice"]["total"] == 0


class TestTimeTracking:
    def test_only_one_running_timer_enforced_by_database(self, client):
        h = auth_headers(client)
        lid = make_list(client, h)
        assert client.post("/time-entries/start", json={"tasklist_id": lid}, headers=h).status_code == 201
        assert client.post("/time-entries/start", json={"tasklist_id": lid}, headers=h).status_code == 409
        # bypass the pre-check: the unique index must still refuse a second open entry
        me = session_user(client, h)
        db.session.add(TimeEntry(user_id=me["id"], tasklist_id=lid, started_at=utcnow_naive()))
        try:
            db.session.commit()
            raised = False
        except Exception:
            db.session.rollback()
            raised = True
        assert raised

    def test_timestamps_are_marked_utc(self, client):
        h = auth_headers(client)
        lid = make_list(client, h)
        entry = client.post("/time-entries/start", json={"tasklist_id": lid}, headers=h).get_json()
        assert entry["started_at"].endswith("Z")

    def test_logging_with_offset_stores_true_utc(self, client):
        h = auth_headers(client)
        lid = make_list(client, h)
        res = client.post("/time-entries", json={
            "tasklist_id": lid,
            "started_at": "2026-07-10T09:00:00+03:00",     # 09:00 in Nairobi
            "ended_at": "2026-07-10T10:00:00+03:00",
        }, headers=h).get_json()
        assert res["started_at"] == "2026-07-10T06:00:00Z" and res["duration_seconds"] == 3600

    def test_cannot_log_future_time(self, client):
        h = auth_headers(client)
        lid = make_list(client, h)
        future = (utcnow_naive() + timedelta(days=2)).isoformat()
        end = (utcnow_naive() + timedelta(days=2, hours=1)).isoformat()
        res = client.post("/time-entries", json={"tasklist_id": lid, "started_at": future, "ended_at": end}, headers=h)
        assert res.status_code == 400

    def test_summary_day_boundaries_follow_tz_offset(self, client):
        h = auth_headers(client)
        lid = make_list(client, h)
        # An entry 20 minutes ago. In UTC+14 the "day" boundary differs from UTC's,
        # but it must always land in exactly one of the 7 daily buckets.
        start = (utcnow_naive() - timedelta(minutes=30)).isoformat() + "Z"
        end = (utcnow_naive() - timedelta(minutes=10)).isoformat() + "Z"
        client.post("/time-entries", json={"tasklist_id": lid, "started_at": start, "ended_at": end}, headers=h)
        for offset in (0, 180, -300, 840):
            s = client.get(f"/time-entries/summary?tz_offset={offset}", headers=h).get_json()
            assert s["today_seconds"] == 1200
            assert sum(d["seconds"] for d in s["by_day"]) == 1200

    def test_teammates_lists_are_usable_but_entries_stay_private(self, client):
        a, b = team(client)
        lid = make_list(client, a)
        assert client.post("/time-entries/start", json={"tasklist_id": lid}, headers=b).status_code == 201
        assert client.get("/time-entries", headers=a).get_json() == []

    def test_task_must_belong_to_selected_list(self, client):
        h = auth_headers(client)
        l1, l2 = make_list(client, h, "One"), make_list(client, h, "Two")
        t = make_task(client, h, l1)
        res = client.post("/time-entries/start", json={"tasklist_id": l2, "task_id": t["id"]}, headers=h)
        assert res.status_code == 400

    def test_bad_ids_are_400(self, client):
        h = auth_headers(client)
        assert client.get("/time-entries?task_id=abc", headers=h).status_code == 400
        assert client.post("/time-entries/start", json={"task_id": "abc"}, headers=h).status_code == 400

    def test_csv_neutralises_formulas(self, client):
        h = auth_headers(client)
        lid = make_list(client, h)
        client.post("/time-entries", json={
            "tasklist_id": lid, "started_at": "2026-07-10T09:00:00Z", "ended_at": "2026-07-10T10:00:00Z",
            "note": "=HYPERLINK(\"http://evil\")",
        }, headers=h)
        body = client.get("/time-entries/export.csv?tz_offset=180", headers=h).get_data(as_text=True)
        assert "'=HYPERLINK" in body and ",=HYPERLINK" not in body
        assert "12:00" in body       # 09:00Z shown in UTC+3
