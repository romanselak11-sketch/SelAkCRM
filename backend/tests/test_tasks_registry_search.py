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


def test_tasks_registry_search_by_client_name(client):
    headers = _auth_headers(client)
    comp = client.post("/api/v1/insurance-companies", json={"name": "СК Поиск"}, headers=headers).json()
    product = client.post(
        f"/api/v1/insurance-companies/{comp['id']}/products",
        json={"name": "Продукт"},
        headers=headers,
    ).json()
    end_date = (utcnow() + timedelta(days=12)).strftime("%Y-%m-%d")
    phones = ("+79001110001", "+79001110002")
    for (last, first), phone in zip(
        (("Васильев", "Елена"), ("Иванов", "Пётр")),
        phones,
        strict=True,
    ):
        person = client.post(
            "/api/v1/clients",
            json={"lastName": last, "firstName": first, "phone": phone},
            headers=headers,
        ).json()
        client.post(
            "/api/v1/policies",
            json={
                "clientId": person["id"],
                "companyId": comp["id"],
                "productId": product["id"],
                "number": f"POL-{last}",
                "insuredObject": "Объект",
                "premiumRubles": "1000",
                "endDate": end_date,
            },
            headers=headers,
        )

    all_rows = client.get("/api/v1/home/tasks?page=1&limit=50", headers=headers).json()["items"]
    assert len(all_rows) >= 2

    filtered = client.get(
        "/api/v1/home/tasks?page=1&limit=50&q=Васильев",
        headers=headers,
    ).json()
    assert filtered["total"] >= 1
    assert all("Васильев" in x["client"]["lastName"] for x in filtered["items"])
    assert all("Иванов" not in x["client"]["lastName"] for x in filtered["items"])
