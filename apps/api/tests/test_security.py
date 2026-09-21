import time

import pytest
from flask_jwt_extended import create_access_token

from app import app as flask_app, socketio
from models import User, db
from tests.conftest import auth_headers, login, register
from tests.helpers import join_workspace, make_list, make_task, session_user, team, two_users


class TestTenantIsolation:
    def test_no_public_task_endpoint(self, client):
        h = auth_headers(client)
        make_task(client, h, make_list(client, h), description="secret")
        assert client.get("/tasks/featured").status_code in (401, 404)

    def test_other_workspace_cannot_touch_task(self, client):
        a, b = two_users(client)
        task = make_task(client, a, make_list(client, a))
        tid = task["id"]

        assert client.get(f"/tasks/{tid}/comments", headers=b).status_code == 404
        assert client.post(f"/tasks/{tid}/comments", json={"content": "hi"}, headers=b).status_code == 404
        assert client.get(f"/tasks/{tid}/subtasks", headers=b).status_code == 404
        assert client.post(f"/tasks/{tid}/subtasks", json={"title": "x"}, headers=b).status_code == 404
        assert client.get(f"/tasks/{tid}/attachments", headers=b).status_code == 404
        assert client.patch(f"/tasks/{tid}", json={"title": "pwn"}, headers=b).status_code == 404
        assert client.delete(f"/tasks/{tid}", headers=b).status_code == 404
        assert client.post(f"/tasks/{tid}/assign", json={"user_ids": [1]}, headers=b).status_code == 404

    def test_cannot_create_task_in_foreign_list(self, client):
        a, b = two_users(client)
        list_id = make_list(client, a)
        res = client.post("/tasks", json={"title": "x", "tasklist_id": list_id}, headers=b)
        assert res.status_code == 404

    def test_cannot_move_task_into_foreign_list(self, client):
        a, b = two_users(client)
        foreign = make_list(client, a)
        mine = make_task(client, b, make_list(client, b, "Mine"))
        res = client.patch(f"/tasks/{mine['id']}", json={"tasklist_id": foreign}, headers=b)
        assert res.status_code == 404

    def test_user_and_members_lookup_is_scoped(self, client):
        a, b = two_users(client)
        alice = session_user(client, a)
        assert client.get(f"/users/{alice['id']}", headers=b).status_code == 404
        assert client.get(f"/workspace/{alice['workspace_id']}/members", headers=b).status_code == 404
        assert client.get(f"/users/{alice['id']}", headers=a).status_code == 200

    def test_team_members_can_collaborate(self, client):
        a, b = team(client)
        task = make_task(client, a, make_list(client, a))
        assert client.post(f"/tasks/{task['id']}/comments", json={"content": "hi"}, headers=b).status_code == 201
        assert client.patch(f"/tasks/{task['id']}", json={"status": "in-progress"}, headers=b).status_code == 200
        assert task["id"] in [t["id"] for t in client.get("/tasks", headers=b).get_json()]

    def test_only_list_or_workspace_owner_can_delete(self, client):
        a, b = team(client)
        list_id = make_list(client, b, "Bobs")
        task = make_task(client, b, list_id)
        c = auth_headers(client, username="carol")
        join_workspace(client, a, c)
        assert client.delete(f"/tasks/{task['id']}", headers=c).status_code == 403
        assert client.delete(f"/tasks/{task['id']}", headers=a).status_code == 200  # alice owns the workspace

    def test_assignee_must_be_workspace_member(self, client):
        a, b = two_users(client)
        task = make_task(client, a, make_list(client, a))
        bob = session_user(client, b)
        res = client.post(f"/tasks/{task['id']}/assign", json={"user_ids": [bob["id"]]}, headers=a)
        assert res.status_code == 400

    def test_user_without_workspace_cannot_see_others(self, client):
        # Two users who both have workspace_id NULL must not see each other's lists.
        a, b = two_users(client)
        list_id = make_list(client, a)
        for name in ("alice", "bob"):
            User.query.filter_by(username=name).first().workspace_id = None
        db.session.commit()
        assert client.get(f"/tasklists/{list_id}", headers=b).status_code == 404


class TestSockets:
    def _client(self, token=None):
        auth = {"token": token} if token else None
        try:
            return socketio.test_client(flask_app, auth=auth)
        except Exception:  # newer clients raise when the server refuses the connection
            return None

    def test_anonymous_and_garbage_are_rejected(self, client):
        for token in (None, "garbage"):
            sc = self._client(token)
            assert sc is None or not sc.is_connected()

    def test_receives_only_own_workspace_events(self, client):
        a, b = two_users(client)
        token_b = b["Authorization"].split()[1]
        sc = self._client(token_b)
        assert sc is not None and sc.is_connected()

        make_task(client, a, make_list(client, a))       # alice's workspace — bob must not hear it
        assert [m for m in sc.get_received() if m["name"].startswith("task_")] == []

        make_task(client, b, make_list(client, b, "Bobs"))
        assert any(m["name"] == "task_created" for m in sc.get_received())

    def test_cannot_join_arbitrary_rooms(self, client):
        a, b = two_users(client)
        sc = self._client(b["Authorization"].split()[1])
        sc.emit("join_workspace", {"workspace_id": session_user(client, a)["workspace_id"]})
        sc.emit("join_user", {"user_id": session_user(client, a)["id"]})
        sc.get_received()
        make_task(client, a, make_list(client, a))
        assert sc.get_received() == []

    def test_revoked_token_is_rejected(self, client):
        h = auth_headers(client)
        token = h["Authorization"].split()[1]
        client.delete("/logout", headers=h)
        sc = self._client(token)
        assert sc is None or not sc.is_connected()


class TestTokens:
    def test_reset_password_flow(self, client):
        register(client)
        from models import User
        import hashlib
        from datetime import timedelta
        from validation import utcnow_naive

        user = User.query.filter_by(username="alice").first()
        user.reset_token = hashlib.sha256(b"tok").hexdigest()
        user.token_expiry = utcnow_naive() + timedelta(hours=1)
        db.session.commit()

        assert client.post("/reset-password/tok", json={"new_password": "short"}).status_code == 400
        assert client.post("/reset-password/tok", json={"new_password": "brandnew99"}).status_code == 200
        assert client.post("/reset-password/tok", json={"new_password": "again12345"}).status_code == 400  # single use
        assert login(client, password="brandnew99").status_code == 200
        assert login(client, password="pass1234").status_code == 400

    def test_expired_reset_token(self, client):
        register(client)
        import hashlib
        from datetime import timedelta
        from validation import utcnow_naive
        user = User.query.filter_by(username="alice").first()
        user.reset_token = hashlib.sha256(b"old").hexdigest()
        user.token_expiry = utcnow_naive() - timedelta(minutes=1)
        db.session.commit()
        assert client.post("/reset-password/old", json={"new_password": "brandnew99"}).status_code == 400

    def test_logout_revokes_refresh_token(self, client):
        register(client)
        tokens = login(client).get_json()
        h = {"Authorization": f"Bearer {tokens['access_token']}"}
        client.delete("/logout", json={"refresh_token": tokens["refresh_token"]}, headers=h)
        res = client.post("/refresh", headers={"Authorization": f"Bearer {tokens['refresh_token']}"})
        assert res.status_code == 401

    def test_password_change_signs_out_other_sessions(self, client):
        register(client)
        old = login(client).get_json()
        old_h = {"Authorization": f"Bearer {old['access_token']}"}
        time.sleep(1.1)  # token `iat` has one-second resolution
        res = client.patch("/users/change-password",
                           json={"current_password": "pass1234", "new_password": "brandnew99"}, headers=old_h)
        assert res.status_code == 200
        assert client.get("/session", headers=old_h).status_code == 401
        new_h = {"Authorization": f"Bearer {res.get_json()['access_token']}"}
        assert client.get("/session", headers=new_h).status_code == 200

    def test_deleted_users_token_stops_working(self, client):
        h = auth_headers(client)
        res = client.delete("/users/deleteaccount", json={"password": "pass1234"}, headers=h)
        assert res.status_code == 200
        assert client.get("/session", headers=h).status_code == 401

    def test_delete_account_requires_password(self, client):
        h = auth_headers(client)
        assert client.delete("/users/deleteaccount", json={"password": "wrong"}, headers=h).status_code == 400
        assert client.delete("/users/deleteaccount", headers=h).status_code == 400


class TestValidation:
    @pytest.mark.parametrize("payload", [
        {"username": "ab", "email": "a@b.co", "password": "longenough"},
        {"username": "has space", "email": "a@b.co", "password": "longenough"},
        {"username": "alice", "email": "not-an-email", "password": "longenough"},
        {"username": "alice", "email": "a@b.co", "password": "short"},
    ])
    def test_register_rejects_bad_input(self, client, payload):
        assert client.post("/register", json=payload).status_code == 400

    def test_register_is_case_insensitive_for_email_and_username(self, client):
        register(client, username="Alice", email="Alice@Test.com")
        assert register(client, username="alice", email="other@test.com").status_code == 409
        assert register(client, username="other", email="ALICE@test.com").status_code == 409
        assert login(client, identifier="alice@TEST.com").status_code == 200

    def test_non_json_body_is_a_400_not_a_500(self, client):
        assert client.post("/login", data="nope", content_type="text/plain").status_code == 400
        assert client.post("/register", json=[1, 2]).status_code == 400

    def test_task_input_errors_are_400(self, client):
        h = auth_headers(client)
        list_id = make_list(client, h)
        bad = [
            {"tasklist_id": list_id},                                   # no title
            {"tasklist_id": list_id, "title": "x" * 101},
            {"tasklist_id": list_id, "title": "x", "priority": "banana"},
            {"tasklist_id": list_id, "title": "x", "status": "banana"},
            {"tasklist_id": list_id, "title": "x", "due_date": "not-a-date"},
        ]
        for body in bad:
            assert client.post("/tasks", json=body, headers=h).status_code == 400, body
        task = make_task(client, h, list_id)
        for body in ({"due_date": "garbage"}, {"priority": "x"}, {"status": "x"}, {"title": "  "}):
            assert client.patch(f"/tasks/{task['id']}", json=body, headers=h).status_code == 400, body

    def test_due_date_can_be_cleared_and_accepts_iso(self, client):
        h = auth_headers(client)
        task = make_task(client, h, make_list(client, h), due_date="2026-12-31T10:30:00")
        assert task["due_date"] == "2026-12-31T10:30:00"
        res = client.patch(f"/tasks/{task['id']}", json={"due_date": ""}, headers=h)
        assert res.status_code == 200 and res.get_json()["due_date"] is None

    def test_profile_update_conflicts_are_409(self, client):
        a, b = two_users(client)
        assert client.patch("/users/updateprofile", json={"username": "alice"}, headers=b).status_code == 409
        assert client.patch("/users/updateprofile", json={"email": "alice@test.com"}, headers=b).status_code == 409

    def test_errors_are_json(self, client):
        res = client.get("/definitely-not-a-route")
        assert res.status_code == 404 and res.is_json


class TestUploads:
    PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 32

    def test_avatar_must_be_a_real_image(self, client):
        import io
        h = auth_headers(client)
        fake = {"file": (io.BytesIO(b"<script>alert(1)</script>"), "evil.png")}
        assert client.post("/users/profile-picture", data=fake, headers=h,
                           content_type="multipart/form-data").status_code == 400
        ok = {"file": (io.BytesIO(self.PNG), "me.png")}
        res = client.post("/users/profile-picture", data=ok, headers=h, content_type="multipart/form-data")
        assert res.status_code == 200
        url = res.get_json()["profile_picture_url"]
        assert client.get(url).status_code == 200
        assert session_user(client, h)["profile_picture"] == url

    def test_attachments_are_not_publicly_served(self, client):
        import io
        h = auth_headers(client)
        task = make_task(client, h, make_list(client, h))
        up = client.post(f"/tasks/{task['id']}/attachments",
                         data={"file": (io.BytesIO(b"hello"), "notes.txt")}, headers=h,
                         content_type="multipart/form-data")
        assert up.status_code == 201
        from models import TaskAttachment
        stored = TaskAttachment.query.first().filename
        assert client.get(f"/uploads/task_attachments/{stored}").status_code == 404
        assert client.get(f"/uploads/../app.py").status_code == 404

    def test_svg_attachments_rejected(self, client):
        import io
        h = auth_headers(client)
        task = make_task(client, h, make_list(client, h))
        res = client.post(f"/tasks/{task['id']}/attachments",
                          data={"file": (io.BytesIO(b"<svg/>"), "x.svg")}, headers=h,
                          content_type="multipart/form-data")
        assert res.status_code == 400

    def test_attachment_files_deleted_with_task(self, client):
        import io, os
        from files import attachment_dir
        from models import TaskAttachment
        h = auth_headers(client)
        task = make_task(client, h, make_list(client, h))
        client.post(f"/tasks/{task['id']}/attachments",
                    data={"file": (io.BytesIO(b"hello"), "notes.txt")}, headers=h,
                    content_type="multipart/form-data")
        path = os.path.join(attachment_dir(), TaskAttachment.query.first().filename)
        assert os.path.exists(path)
        client.delete(f"/tasks/{task['id']}", headers=h)
        assert not os.path.exists(path)
