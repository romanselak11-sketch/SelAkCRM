def _bootstrap_super_admin(client) -> dict[str, str]:
    client.post(
        "/api/v1/setup/complete",
        json={"adminLogin": "admin", "adminPassword": "12345678901"},
    )
    token = client.post(
        "/api/v1/auth/login",
        json={"login": "admin", "password": "12345678901"},
    ).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def _create_manager_token(client, super_headers: dict[str, str]) -> str:
    client.post(
        "/api/v1/users",
        json={"login": "mgr", "password": "12345678901", "role": "MANAGER"},
        headers=super_headers,
    )
    return client.post(
        "/api/v1/auth/login",
        json={"login": "mgr", "password": "12345678901"},
    ).json()["accessToken"]


def test_manager_creates_client_via_policy_form(client):
    headers = _bootstrap_super_admin(client)
    manager_headers = {"Authorization": f"Bearer {_create_manager_token(client, headers)}"}

    denied = client.post(
        "/api/v1/clients",
        json={"lastName": "Сидоров", "firstName": "Иван", "phone": "+79003334455"},
        headers=manager_headers,
    )
    assert denied.status_code == 403

    created = client.post(
        "/api/v1/home/policy-form/clients",
        json={"lastName": "Сидоров", "firstName": "Иван", "phone": "+79003334455"},
        headers=manager_headers,
    )
    assert created.status_code == 200
    body = created.json()
    assert body["lastName"] == "Сидоров"
    assert body["firstName"] == "Иван"

    listed = client.get("/api/v1/home/policy-form/clients", headers=manager_headers)
    assert listed.status_code == 200
    ids = {row["id"] for row in listed.json()}
    assert body["id"] in ids
