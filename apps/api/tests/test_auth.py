from tests.conftest import register, login, auth_headers


class TestRegister:
    def test_success(self, client):
        res = register(client)
        assert res.status_code == 201
        data = res.get_json()
        assert data["user"]["username"] == "alice"
        assert "access_token" in data
        assert "refresh_token" in data

    def test_duplicate_username(self, client):
        register(client)
        res = register(client, email="other@test.com")
        assert res.status_code == 409
        assert "Username already exists" in res.get_json()["error"]

    def test_duplicate_email(self, client):
        register(client)
        res = register(client, username="bob")
        assert res.status_code == 409
        assert "Email already exists" in res.get_json()["error"]

    def test_missing_fields(self, client):
        res = client.post("/register", json={"username": "x"})
        assert res.status_code == 400


class TestLogin:
    def test_success_with_username(self, client):
        register(client)
        res = login(client, identifier="alice")
        assert res.status_code == 200
        assert "access_token" in res.get_json()

    def test_success_with_email(self, client):
        register(client)
        res = login(client, identifier="alice@test.com")
        assert res.status_code == 200

    def test_wrong_password(self, client):
        register(client)
        res = login(client, password="wrong")
        assert res.status_code == 400
        assert "Invalid" in res.get_json()["error"]

    def test_unknown_user(self, client):
        res = login(client, identifier="nobody")
        assert res.status_code == 400

    def test_missing_fields(self, client):
        res = client.post("/login", json={})
        assert res.status_code == 400


class TestSession:
    def test_valid_token(self, client):
        headers = auth_headers(client)
        res = client.get("/session", headers=headers)
        assert res.status_code == 200
        assert res.get_json()["user"]["username"] == "alice"

    def test_no_token(self, client):
        res = client.get("/session")
        assert res.status_code == 401


class TestRefresh:
    def test_refresh_returns_new_token(self, client):
        register(client)
        res = login(client)
        refresh_token = res.get_json()["refresh_token"]
        res2 = client.post("/refresh", headers={"Authorization": f"Bearer {refresh_token}"})
        assert res2.status_code == 200
        assert "access_token" in res2.get_json()


class TestLogout:
    def test_logout_invalidates_token(self, client):
        headers = auth_headers(client)
        res = client.delete("/logout", headers=headers)
        assert res.status_code == 200
        # Same token should now be rejected
        res2 = client.get("/session", headers=headers)
        assert res2.status_code == 401


class TestForgotPassword:
    def test_unknown_email(self, client):
        res = client.post("/forgot-password", json={"email": "no@one.com"})
        assert res.status_code == 404

    def test_known_email_returns_200(self, client):
        register(client)
        res = client.post("/forgot-password", json={"email": "alice@test.com"})
        assert res.status_code == 200
