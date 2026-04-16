def test_login_me_flow(client):
    client.post(
        "/api/v1/setup/complete",
        json={"adminLogin": "adm", "adminPassword": "12345678901"},
    )
    r = client.post("/api/v1/auth/login", json={"login": "adm", "password": "wrong"})
    assert r.status_code == 401
    r2 = client.post("/api/v1/auth/login", json={"login": "adm", "password": "12345678901"})
    assert r2.status_code == 200
    token = r2.json()["accessToken"]
    r3 = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r3.status_code == 200
    assert r3.json()["login"] == "adm"


def test_manager_forbidden_analytics(client):
    client.post(
        "/api/v1/setup/complete",
        json={"adminLogin": "ad", "adminPassword": "12345678901"},
    )
    tok = client.post("/api/v1/auth/login", json={"login": "ad", "password": "12345678901"}).json()["accessToken"]
    client.patch("/api/v1/me/theme", json={"theme": "dark"}, headers={"Authorization": f"Bearer {tok}"})
    r = client.post(
        "/api/v1/users",
        json={"login": "mgr", "password": "12345678901", "role": "MANAGER"},
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r.status_code == 200
    mtok = client.post("/api/v1/auth/login", json={"login": "mgr", "password": "12345678901"}).json()["accessToken"]
    ar = client.get(
        "/api/v1/analytics/summary",
        params={"from": "2026-01-01", "to": "2026-01-31"},
        headers={"Authorization": f"Bearer {mtok}"},
    )
    assert ar.status_code == 403
