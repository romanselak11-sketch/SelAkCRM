def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "selakcrm-api"}


def test_setup_status_needs_setup(client):
    r = client.get("/api/v1/setup/status")
    assert r.status_code == 200
    assert r.json()["needsSetup"] is True


def test_setup_complete_then_status(client):
    r = client.post(
        "/api/v1/setup/complete",
        json={"adminLogin": "admin", "adminPassword": "12345678901"},
    )
    assert r.status_code == 200
    r2 = client.get("/api/v1/setup/status")
    assert r2.json()["needsSetup"] is False
