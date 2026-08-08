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
    r = client.post(
        "/api/v1/users",
        json={"login": "mgr", "password": "12345678901", "role": "MANAGER"},
        headers=super_headers,
    )
    assert r.status_code == 200
    return client.post(
        "/api/v1/auth/login",
        json={"login": "mgr", "password": "12345678901"},
    ).json()["accessToken"]


def test_client_policies_returns_compact_fields(client):
    headers = _bootstrap_super_admin(client)
    company = client.post("/api/v1/insurance-companies", json={"name": "СК Юг"}, headers=headers).json()
    product = client.post(
        f"/api/v1/insurance-companies/{company['id']}/products",
        json={"name": "КАСКО"},
        headers=headers,
    ).json()
    person = client.post(
        "/api/v1/clients",
        json={"lastName": "Иванов", "firstName": "Петр", "phone": "+79001112233"},
        headers=headers,
    ).json()

    create_policy = client.post(
        "/api/v1/policies",
        json={
            "clientId": person["id"],
            "companyId": company["id"],
            "productId": product["id"],
            "number": "POL-7788",
            "insuredObject": "Квартира",
            "premiumRubles": "5500",
            "issueDate": "2026-03-01",
            "endDate": "2027-03-01",
        },
        headers=headers,
    )
    assert create_policy.status_code == 200

    res = client.get(f"/api/v1/clients/{person['id']}/policies?page=1&pageSize=25", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    row = body["items"][0]

    assert row["number"] == "POL-7788"
    assert row["insuredObject"] == "Квартира"
    assert row["issueDate"].startswith("2026-03-01")
    assert row["endDate"].startswith("2027-03-01")
    assert "clientId" not in row


def test_manager_forbidden_to_read_client_policies(client):
    headers = _bootstrap_super_admin(client)
    manager_token = _create_manager_token(client, headers)
    manager_headers = {"Authorization": f"Bearer {manager_token}"}

    person = client.post(
        "/api/v1/clients",
        json={"lastName": "Павлов", "firstName": "Никита", "phone": "+79002223344"},
        headers=headers,
    ).json()

    res = client.get(f"/api/v1/clients/{person['id']}/policies?page=1&pageSize=25", headers=manager_headers)
    assert res.status_code == 403
