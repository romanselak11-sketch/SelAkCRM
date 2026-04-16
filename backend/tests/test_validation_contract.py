def test_login_extra_field_400_nest_shape(client):
    r = client.post(
        "/api/v1/auth/login",
        json={"login": "x", "password": "y", "evil": True},
    )
    assert r.status_code == 400
    body = r.json()
    assert body["statusCode"] == 400
    assert body["error"] == "Bad Request"
    assert isinstance(body["message"], list)
    assert any("should not exist" in m for m in body["message"])


def test_setup_password_min_10(client):
    r = client.post(
        "/api/v1/setup/complete",
        json={"adminLogin": "ab", "adminPassword": "123456789"},
    )
    assert r.status_code == 400
    body = r.json()
    assert body["statusCode"] == 400
    assert isinstance(body["message"], list)


def test_login_rate_limit_429(client, monkeypatch):
    import selakcrm.login_rate_limit as rl

    monkeypatch.setattr(rl, "_MAX_FAILURES", 2)
    client.post(
        "/api/v1/setup/complete",
        json={"adminLogin": "rl", "adminPassword": "12345678901"},
    )
    for _ in range(2):
        r = client.post("/api/v1/auth/login", json={"login": "rl", "password": "bad"})
        assert r.status_code == 401
    r3 = client.post("/api/v1/auth/login", json={"login": "rl", "password": "bad"})
    assert r3.status_code == 429
    assert r3.json()["statusCode"] == 429


def test_logout_ok(client):
    client.post(
        "/api/v1/setup/complete",
        json={"adminLogin": "admin", "adminPassword": "12345678901"},
    )
    tok = client.post("/api/v1/auth/login", json={"login": "admin", "password": "12345678901"}).json()["accessToken"]
    r = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200
    assert r.json() == {"ok": True}
