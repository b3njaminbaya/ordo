from tests.conftest import auth_headers, register, login


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_list(client, headers, name="Work"):
    res = client.post("/tasklists", json={"name": name}, headers=headers)
    assert res.status_code == 201
    return res.get_json()["id"]


def _start(client, headers, tasklist_id, **kwargs):
    body = {"tasklist_id": tasklist_id, **kwargs}
    return client.post("/time-entries/start", json=body, headers=headers)


def _stop(client, headers, entry_id):
    return client.patch(f"/time-entries/{entry_id}/stop", headers=headers)


def _log(client, headers, tasklist_id, started="2026-07-10T09:00:00", ended="2026-07-10T10:30:00", **kwargs):
    body = {
        "tasklist_id": tasklist_id,
        "started_at": started,
        "ended_at": ended,
        **kwargs,
    }
    return client.post("/time-entries", json=body, headers=headers)


# ── Start timer ───────────────────────────────────────────────────────────────

class TestStartTimer:
    def test_start_success(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        res = _start(client, h, tl_id)
        assert res.status_code == 201
        data = res.get_json()
        assert data["ended_at"] is None
        assert data["duration_seconds"] is None
        assert data["tasklist_id"] == tl_id

    def test_blocks_second_timer(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        _start(client, h, tl_id)
        res = _start(client, h, tl_id)
        assert res.status_code == 409
        body = res.get_json()
        assert "active_timer" in body

    def test_requires_task_or_list(self, client):
        h = auth_headers(client)
        res = client.post("/time-entries/start", json={}, headers=h)
        assert res.status_code == 400

    def test_rejects_invalid_category(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        res = _start(client, h, tl_id, category="nonsense")
        assert res.status_code == 400

    def test_requires_auth(self, client):
        res = client.post("/time-entries/start", json={"tasklist_id": 1})
        assert res.status_code == 401

    def test_rejects_inaccessible_list(self, client):
        alice = auth_headers(client, username="alice", email="alice@t.com")
        bob = auth_headers(client, username="bob", email="bob@t.com")
        tl_id = _make_list(client, bob, name="Bob's list")
        res = _start(client, alice, tl_id)
        assert res.status_code == 403


# ── Stop timer ────────────────────────────────────────────────────────────────

class TestStopTimer:
    def test_stop_sets_ended_and_duration(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        entry = _start(client, h, tl_id).get_json()
        res = _stop(client, h, entry["id"])
        assert res.status_code == 200
        data = res.get_json()
        assert data["ended_at"] is not None
        assert isinstance(data["duration_seconds"], int)
        assert data["duration_seconds"] >= 0

    def test_cannot_stop_already_stopped(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        entry = _start(client, h, tl_id).get_json()
        _stop(client, h, entry["id"])
        res = _stop(client, h, entry["id"])
        assert res.status_code == 400

    def test_cannot_stop_other_users_timer(self, client):
        alice = auth_headers(client, username="alice", email="alice@t.com")
        bob = auth_headers(client, username="bob", email="bob@t.com")
        tl_id = _make_list(client, bob, name="Bob")
        entry = _start(client, bob, tl_id).get_json()
        res = _stop(client, alice, entry["id"])
        assert res.status_code == 404

    def test_stop_nonexistent(self, client):
        h = auth_headers(client)
        res = _stop(client, h, 99999)
        assert res.status_code == 404


# ── Log a past entry ──────────────────────────────────────────────────────────

class TestLogEntry:
    def test_log_computes_duration(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        res = _log(client, h, tl_id, started="2026-07-10T09:00:00", ended="2026-07-10T10:30:00")
        assert res.status_code == 201
        data = res.get_json()
        assert data["duration_seconds"] == 5400  # 90 minutes

    def test_rejects_inverted_timestamps(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        res = _log(client, h, tl_id, started="2026-07-10T11:00:00", ended="2026-07-10T09:00:00")
        assert res.status_code == 400

    def test_rejects_equal_timestamps(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        res = _log(client, h, tl_id, started="2026-07-10T09:00:00", ended="2026-07-10T09:00:00")
        assert res.status_code == 400

    def test_missing_started_at(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        res = client.post("/time-entries", json={"tasklist_id": tl_id, "ended_at": "2026-07-10T10:00:00"}, headers=h)
        assert res.status_code == 400

    def test_missing_ended_at(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        res = client.post("/time-entries", json={"tasklist_id": tl_id, "started_at": "2026-07-10T09:00:00"}, headers=h)
        assert res.status_code == 400

    def test_with_category_and_note(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        res = _log(client, h, tl_id, category="focus", note="Deep work session")
        assert res.status_code == 201
        data = res.get_json()
        assert data["category"] == "focus"
        assert data["note"] == "Deep work session"


# ── Active timer ──────────────────────────────────────────────────────────────

class TestActiveTimer:
    def test_no_active_timer_returns_null(self, client):
        h = auth_headers(client)
        res = client.get("/time-entries/active", headers=h)
        assert res.status_code == 200
        assert res.get_json() is None

    def test_returns_running_timer(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        entry = _start(client, h, tl_id).get_json()
        res = client.get("/time-entries/active", headers=h)
        assert res.status_code == 200
        assert res.get_json()["id"] == entry["id"]

    def test_null_after_stop(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        entry = _start(client, h, tl_id).get_json()
        _stop(client, h, entry["id"])
        res = client.get("/time-entries/active", headers=h)
        assert res.get_json() is None


# ── List entries (ownership isolation) ───────────────────────────────────────

class TestListEntries:
    def test_returns_own_entries_only(self, client):
        alice = auth_headers(client, username="alice", email="alice@t.com")
        bob = auth_headers(client, username="bob", email="bob@t.com")
        tl_alice = _make_list(client, alice, "Alice")
        tl_bob = _make_list(client, bob, "Bob")
        _log(client, alice, tl_alice)
        _log(client, bob, tl_bob)

        res = client.get("/time-entries", headers=alice)
        data = res.get_json()
        assert res.status_code == 200
        assert len(data) == 1
        assert data[0]["tasklist_id"] == tl_alice

    def test_date_range_filter(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        _log(client, h, tl_id, started="2026-07-01T09:00:00", ended="2026-07-01T10:00:00")
        _log(client, h, tl_id, started="2026-07-10T09:00:00", ended="2026-07-10T10:00:00")

        res = client.get("/time-entries?start=2026-07-09&end=2026-07-11", headers=h)
        assert res.status_code == 200
        assert len(res.get_json()) == 1


# ── Edit entry ────────────────────────────────────────────────────────────────

class TestEditEntry:
    def test_edit_note_and_category(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        entry = _log(client, h, tl_id).get_json()
        res = client.patch(f"/time-entries/{entry['id']}",
                           json={"note": "Updated note", "category": "meeting"}, headers=h)
        assert res.status_code == 200
        data = res.get_json()
        assert data["note"] == "Updated note"
        assert data["category"] == "meeting"

    def test_edit_timestamps_recomputes_duration(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        entry = _log(client, h, tl_id,
                     started="2026-07-10T09:00:00", ended="2026-07-10T10:00:00").get_json()
        assert entry["duration_seconds"] == 3600

        res = client.patch(f"/time-entries/{entry['id']}",
                           json={"ended_at": "2026-07-10T12:00:00"}, headers=h)
        assert res.status_code == 200
        assert res.get_json()["duration_seconds"] == 10800  # 3 hours

    def test_cannot_edit_timestamps_on_running_timer(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        entry = _start(client, h, tl_id).get_json()
        res = client.patch(f"/time-entries/{entry['id']}",
                           json={"started_at": "2026-07-10T09:00:00"}, headers=h)
        assert res.status_code == 400

    def test_cannot_edit_other_users_entry(self, client):
        alice = auth_headers(client, username="alice", email="alice@t.com")
        bob = auth_headers(client, username="bob", email="bob@t.com")
        tl_bob = _make_list(client, bob, "Bob")
        entry = _log(client, bob, tl_bob).get_json()
        res = client.patch(f"/time-entries/{entry['id']}", json={"note": "hack"}, headers=alice)
        assert res.status_code == 404

    def test_edit_rejects_inverted_timestamps(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        entry = _log(client, h, tl_id,
                     started="2026-07-10T09:00:00", ended="2026-07-10T10:00:00").get_json()
        res = client.patch(f"/time-entries/{entry['id']}",
                           json={"started_at": "2026-07-10T11:00:00"}, headers=h)
        assert res.status_code == 400


# ── Delete entry ──────────────────────────────────────────────────────────────

class TestDeleteEntry:
    def test_delete_own_entry(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        entry = _log(client, h, tl_id).get_json()
        res = client.delete(f"/time-entries/{entry['id']}", headers=h)
        assert res.status_code == 200
        assert client.get("/time-entries", headers=h).get_json() == []

    def test_cannot_delete_other_users_entry(self, client):
        alice = auth_headers(client, username="alice", email="alice@t.com")
        bob = auth_headers(client, username="bob", email="bob@t.com")
        tl_bob = _make_list(client, bob, "Bob")
        entry = _log(client, bob, tl_bob).get_json()
        res = client.delete(f"/time-entries/{entry['id']}", headers=alice)
        assert res.status_code == 404

    def test_delete_nonexistent(self, client):
        h = auth_headers(client)
        res = client.delete("/time-entries/99999", headers=h)
        assert res.status_code == 404


# ── Summary ───────────────────────────────────────────────────────────────────

class TestSummary:
    def test_summary_shape(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        _log(client, h, tl_id, started="2026-07-10T09:00:00", ended="2026-07-10T10:00:00")

        res = client.get("/time-entries/summary", headers=h)
        assert res.status_code == 200
        data = res.get_json()
        assert "today_seconds" in data
        assert "week_seconds" in data
        assert isinstance(data["by_day"], list)
        assert len(data["by_day"]) == 7
        assert isinstance(data["by_list"], list)

    def test_running_timer_excluded_from_summary(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        _start(client, h, tl_id)  # running — no duration yet

        res = client.get("/time-entries/summary", headers=h)
        data = res.get_json()
        # A running timer has no duration_seconds, so totals should be 0
        assert data["week_seconds"] == 0


# ── Export ────────────────────────────────────────────────────────────────────

class TestExport:
    def test_export_returns_csv(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        _log(client, h, tl_id, started="2026-07-10T09:00:00", ended="2026-07-10T10:30:00",
             category="focus", note="Morning session")

        res = client.get("/time-entries/export.csv", headers=h)
        assert res.status_code == 200
        assert "text/csv" in res.content_type
        lines = res.data.decode().strip().split("\n")
        assert len(lines) == 2  # header + 1 data row
        assert "90.0" in lines[1]   # duration in minutes
        assert "focus" in lines[1]

    def test_export_excludes_running_timer(self, client):
        h = auth_headers(client)
        tl_id = _make_list(client, h)
        _start(client, h, tl_id)   # running — should not appear in export

        res = client.get("/time-entries/export.csv", headers=h)
        lines = res.data.decode().strip().split("\n")
        assert len(lines) == 1  # header only

    def test_export_requires_auth(self, client):
        res = client.get("/time-entries/export.csv")
        assert res.status_code == 401
