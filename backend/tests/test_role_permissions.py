def _bootstrap_super_admin(client) -> dict[str, str]:
    client.post(
        "/api/v1/setup/complete",
        json={"adminLogin": "admin", "adminPassword": "12345678901"},
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"login": "admin", "password": "12345678901"},
    )
    token = login.json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def _create_manager(client, super_headers: dict[str, str], login: str = "mgr") -> str:
    client.post(
        "/api/v1/users",
        headers=super_headers,
        json={"login": login, "password": "12345678901", "role": "MANAGER"},
    )
    tok = client.post(
        "/api/v1/auth/login",
        json={"login": login, "password": "12345678901"},
    ).json()["accessToken"]
    return tok


def test_me_includes_default_permissions(client):
    headers = _bootstrap_super_admin(client)
    me = client.get("/api/v1/auth/me", headers=headers).json()
    assert "permissions" in me
    assert "settings.role_permissions" in me["permissions"]
    assert "nav.analytics" in me["permissions"]


def test_manager_default_permissions_hide_analytics(client):
    headers = _bootstrap_super_admin(client)
    mgr_token = _create_manager(client, headers)
    me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {mgr_token}"}
    ).json()
    assert "nav.home" in me["permissions"]
    assert "nav.tasks" in me["permissions"]
    assert "policies.create" in me["permissions"]
    assert "nav.analytics" not in me["permissions"]
    assert "users.manage" not in me["permissions"]


def test_admin_can_update_manager_permissions(client):
    headers = _bootstrap_super_admin(client)
    matrix = client.get("/api/v1/role-permissions", headers=headers)
    assert matrix.status_code == 200
    body = matrix.json()
    assert "MANAGER" in body["roles"]
    assert body["lockedRole"] == "SUPER_ADMIN"

    updated = client.put(
        "/api/v1/role-permissions",
        headers=headers,
        json={
            "role": "MANAGER",
            "permissions": ["nav.home", "nav.tasks", "nav.clients", "clients.write"],
        },
    )
    assert updated.status_code == 200
    assert "nav.clients" in updated.json()["roles"]["MANAGER"]
    assert "policies.create" not in updated.json()["roles"]["MANAGER"]

    mgr_token = _create_manager(client, headers)
    me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {mgr_token}"}
    ).json()
    assert "nav.clients" in me["permissions"]
    assert "policies.create" not in me["permissions"]

    forbidden = client.get(
        "/api/v1/analytics/summary",
        params={"from": "2020-01-01", "to": "2020-01-31"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert forbidden.status_code == 403


def test_cannot_configure_super_admin_role(client):
    headers = _bootstrap_super_admin(client)
    res = client.put(
        "/api/v1/role-permissions",
        headers=headers,
        json={"role": "SUPER_ADMIN", "permissions": ["nav.home"]},
    )
    assert res.status_code in (400, 422)


def test_manager_cannot_read_role_permissions(client):
    headers = _bootstrap_super_admin(client)
    mgr_token = _create_manager(client, headers)
    res = client.get(
        "/api/v1/role-permissions",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 403


def test_granting_clients_nav_allows_list(client):
    headers = _bootstrap_super_admin(client)
    client.put(
        "/api/v1/role-permissions",
        headers=headers,
        json={
            "role": "MANAGER",
            "permissions": ["nav.home", "nav.tasks", "nav.clients"],
        },
    )
    mgr_token = _create_manager(client, headers)
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}
    ok = client.get("/api/v1/clients?page=1&limit=25", headers=mgr_headers)
    assert ok.status_code == 200

    denied_write = client.post(
        "/api/v1/clients",
        headers=mgr_headers,
        json={
            "lastName": "Иванов",
            "firstName": "Иван",
            "phone": "+79991234567",
        },
    )
    assert denied_write.status_code == 403
