from datetime import timedelta

from selakcrm.time_utils import utcnow


def _auth_headers(client) -> dict[str, str]:
    client.post(
        "/api/v1/setup/complete",
        json={"adminLogin": "admin", "adminPassword": "12345678901"},
    )
    token = client.post(
        "/api/v1/auth/login",
        json={"login": "admin", "password": "12345678901"},
    ).json()["accessToken"]
    return {"Authorization": f"Bearer {token}"}


def test_tasks_registry_pagination(client):
    headers = _auth_headers(client)
    comp = client.post("/api/v1/insurance-companies", json={"name": "СК Тест"}, headers=headers).json()
    product = client.post(
        f"/api/v1/insurance-companies/{comp['id']}/products",
        json={"name": "ОСАГО"},
        headers=headers,
    ).json()

    for i in range(11):
        c = client.post(
            "/api/v1/clients",
            json={
                "lastName": f"Клиент{i}",
                "firstName": "Тест",
                "phone": f"+7900000000{i}",
            },
            headers=headers,
        ).json()
        end_date = (utcnow() + timedelta(days=10 + i)).strftime("%Y-%m-%d")
        r = client.post(
            "/api/v1/policies",
            json={
                "clientId": c["id"],
                "companyId": comp["id"],
                "productId": product["id"],
                "number": f"P-{i}",
                "insuredObject": f"Авто {i}",
                "premiumRubles": "1000",
                "endDate": end_date,
            },
            headers=headers,
        )
        assert r.status_code == 200

    p1 = client.get("/api/v1/home/tasks?page=1&limit=10", headers=headers)
    assert p1.status_code == 200
    d1 = p1.json()
    assert d1["page"] == 1
    assert d1["limit"] == 10
    assert d1["total"] == 11
    assert len(d1["items"]) == 10

    p2 = client.get("/api/v1/home/tasks?page=2&limit=10", headers=headers)
    assert p2.status_code == 200
    d2 = p2.json()
    assert d2["page"] == 2
    assert d2["limit"] == 10
    assert d2["total"] == 11
    assert len(d2["items"]) == 1
    assert d2["items"][0]["policy"]["insuredObject"] == "Авто 0"
