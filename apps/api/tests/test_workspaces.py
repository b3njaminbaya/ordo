from datetime import timedelta

from models import TaskList, User, Workspace, WorkspaceInvite, db
from tests.conftest import auth_headers, register
from tests.helpers import join_workspace, make_list, make_task, session_user, team, two_users
from validation import utcnow_naive


def _members(client, headers):
    ws = session_user(client, headers)["workspace_id"]
    return client.get(f"/workspace/{ws}/members", headers=headers).get_json()


class TestRegistration:
    def test_new_user_gets_workspace_owner_and_starter_list(self, client):
        h = auth_headers(client)
        me = session_user(client, h)
        assert me["workspace"]["is_owner"] is True
        lists = client.get("/tasklists/", headers=h).get_json()
        assert [l["name"] for l in lists] == ["My Tasks"]

    def test_login_and_session_payloads_match(self, client):
        register(client)
        from tests.conftest import login
        res = login(client).get_json()["user"]
        h = auth_headers(client)
        assert set(res) == set(session_user(client, h))


class TestInvites:
    def test_preview_and_accept_via_link(self, client):
        a, b = two_users(client)
        ws = session_user(client, a)["workspace_id"]
        link = client.post("/invite/generate-link", json={"workspace_id": ws}, headers=a).get_json()["link"]
        token = link.rsplit("/", 1)[-1]

        preview = client.get(f"/invite/preview/{token}")          # no login needed
        assert preview.status_code == 200
        assert preview.get_json()["invited_by"] == "alice"

        assert client.post(f"/invite/accept/{token}", headers=b).status_code == 200
        assert session_user(client, b)["workspace_id"] == ws
        assert len(_members(client, a)["members"]) == 2

    def test_email_invite_is_single_use_and_normalised(self, client):
        a, b = two_users(client)
        ws = session_user(client, a)["workspace_id"]
        res = client.post("/invite", json={"email": "Bob@Test.com", "workspace_id": ws}, headers=a)
        assert res.status_code == 200
        assert client.post("/invite", json={"email": "bob@test.com", "workspace_id": ws}, headers=a).status_code == 400
        token = res.get_json()["invite_url"].rsplit("/", 1)[-1]
        assert client.post(f"/invite/accept/{token}", headers=b).status_code == 200
        assert client.post(f"/invite/accept/{token}", headers=b).status_code == 404

    def test_cannot_invite_existing_member_or_bad_email(self, client):
        a, b = team(client)
        ws = session_user(client, a)["workspace_id"]
        assert client.post("/invite", json={"email": "bob@test.com", "workspace_id": ws}, headers=a).status_code == 400
        assert client.post("/invite", json={"email": "nope", "workspace_id": ws}, headers=a).status_code == 400

    def test_outsider_cannot_invite_into_workspace(self, client):
        a, b = two_users(client)
        ws = session_user(client, a)["workspace_id"]
        assert client.post("/invite", json={"email": "x@y.co", "workspace_id": ws}, headers=b).status_code == 404
        assert client.post("/invite/generate-link", json={"workspace_id": ws}, headers=b).status_code == 404

    def test_invites_expire(self, client):
        a, b = two_users(client)
        ws = session_user(client, a)["workspace_id"]
        link = client.post("/invite/generate-link", json={"workspace_id": ws}, headers=a).get_json()["link"]
        token = link.rsplit("/", 1)[-1]
        WorkspaceInvite.query.filter_by(token=token).first().created_at = utcnow_naive() - timedelta(days=30)
        db.session.commit()
        assert client.get(f"/invite/preview/{token}").status_code == 404
        assert client.post(f"/invite/accept/{token}", headers=b).status_code == 404

    def test_revoke_link_and_email_invite(self, client):
        a, b = two_users(client)
        ws = session_user(client, a)["workspace_id"]
        link = client.post("/invite/generate-link", json={"workspace_id": ws}, headers=a).get_json()["link"]
        token = link.rsplit("/", 1)[-1]
        assert _members(client, a)["has_active_link"] is True
        assert client.delete("/invite/link", headers=a).status_code == 200
        assert client.post(f"/invite/accept/{token}", headers=b).status_code == 404
        assert _members(client, a)["has_active_link"] is False

        invite = client.post("/invite", json={"email": "z@z.co", "workspace_id": ws}, headers=a).get_json()
        pending = _members(client, a)["pending_invites"]
        assert [p["email"] for p in pending] == ["z@z.co"]
        assert client.delete(f"/invite/{invite['id']}", headers=a).status_code == 200
        assert _members(client, a)["pending_invites"] == []
        assert client.post(f"/invite/accept/{invite['invite_url'].rsplit('/', 1)[-1]}", headers=b).status_code == 404


class TestMembership:
    def test_lists_stay_with_team_when_member_joins_elsewhere(self, client):
        a, b = team(client)                           # bob is in alice's workspace
        bob_list = make_list(client, b, "Bobs list")
        task = make_task(client, b, bob_list)

        c = auth_headers(client, username="carol")     # carol has her own workspace
        join_workspace(client, c, b)                   # bob moves to carol's workspace

        # alice's team keeps bob's list; bob does not take it along
        names = [l["name"] for l in client.get("/tasklists/", headers=a).get_json()]
        assert "Bobs list" in names
        assert client.get(f"/tasks", headers=a).get_json()[0]["id"] == task["id"]
        bob_lists = [l["name"] for l in client.get("/tasklists/", headers=b).get_json()]
        assert "Bobs list" not in bob_lists

    def test_lone_user_takes_their_lists_when_joining(self, client):
        a, b = two_users(client)
        make_list(client, b, "Solo")
        join_workspace(client, a, b)
        names = [l["name"] for l in client.get("/tasklists/", headers=a).get_json()]
        assert "Solo" in names

    def test_owner_can_remove_member(self, client):
        a, b = team(client)
        bob = session_user(client, b)
        ws = session_user(client, a)["workspace_id"]
        assert client.delete(f"/workspace/{ws}/members/{bob['id']}", headers=b).status_code == 403   # not owner
        assert client.delete(f"/workspace/{ws}/members/{bob['id']}", headers=a).status_code == 200
        after = session_user(client, b)
        assert after["workspace_id"] != ws
        assert [l["name"] for l in client.get("/tasklists/", headers=b).get_json()] == ["My Tasks"]
        assert len(_members(client, a)["members"]) == 1

    def test_owner_cannot_remove_self_and_lone_user_cannot_leave(self, client):
        a, b = team(client)
        alice = session_user(client, a)
        ws = alice["workspace_id"]
        assert client.delete(f"/workspace/{ws}/members/{alice['id']}", headers=a).status_code == 400
        c = auth_headers(client, username="carol")
        cws = session_user(client, c)["workspace_id"]
        assert client.post(f"/workspace/{cws}/leave", headers=c).status_code == 400

    def test_member_can_leave_and_ownership_transfers(self, client):
        a, b = team(client)
        ws = session_user(client, a)["workspace_id"]
        res = client.post(f"/workspace/{ws}/leave", headers=a)      # the owner leaves
        assert res.status_code == 200
        bob = session_user(client, b)
        assert bob["workspace"]["is_owner"] is True                 # ownership passed on

    def test_deleting_account_keeps_teams_lists(self, client):
        a, b = team(client)
        list_id = make_list(client, b, "Bobs list")
        task = make_task(client, b, list_id)
        assert client.delete("/users/deleteaccount", json={"password": "pass1234"}, headers=b).status_code == 200
        assert task["id"] in [t["id"] for t in client.get("/tasks", headers=a).get_json()]

    def test_deleting_lone_account_removes_data(self, client):
        h = auth_headers(client)
        make_task(client, h, make_list(client, h, "Mine"))
        client.delete("/users/deleteaccount", json={"password": "pass1234"}, headers=h)
        assert TaskList.query.count() == 0
        assert Workspace.query.count() == 0       # no empty workspace left behind

    def test_deleting_one_of_two_members_keeps_the_workspace(self, client):
        a, b = team(client)
        client.delete("/users/deleteaccount", json={"password": "pass1234"}, headers=b)
        assert Workspace.query.count() == 1
