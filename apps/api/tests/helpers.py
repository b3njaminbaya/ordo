from tests.conftest import auth_headers


def make_list(client, headers, name="Work"):
    res = client.post("/tasklists", json={"name": name}, headers=headers)
    assert res.status_code == 201, res.get_json()
    return res.get_json()["id"]


def make_task(client, headers, list_id, **kw):
    body = {"title": "Task", "tasklist_id": list_id, **kw}
    res = client.post("/tasks", json=body, headers=headers)
    assert res.status_code == 201, res.get_json()
    return res.get_json()


def session_user(client, headers):
    return client.get("/session", headers=headers).get_json()["user"]


def join_workspace(client, owner_headers, member_headers):
    """Put `member` into `owner`'s workspace using an invite link."""
    ws = session_user(client, owner_headers)["workspace_id"]
    link = client.post("/invite/generate-link", json={"workspace_id": ws}, headers=owner_headers).get_json()["link"]
    token = link.rsplit("/", 1)[-1]
    res = client.post(f"/invite/accept/{token}", headers=member_headers)
    assert res.status_code == 200, res.get_json()
    return ws


def two_users(client):
    a = auth_headers(client, username="alice")
    b = auth_headers(client, username="bob")
    return a, b


def team(client):
    """alice (owner) and bob in the same workspace."""
    a, b = two_users(client)
    join_workspace(client, a, b)
    return a, b
