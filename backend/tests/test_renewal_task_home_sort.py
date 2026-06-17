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


def test_home_renewal_tasks_sorted_overdue_first(client):
    headers = _auth_headers(client)
    comp = client.post("/api/v1/insurance-companies", json={"name": "СК Сорт"}, headers=headers).json()
    product = client.post(
        f"/api/v1/insurance-companies/{comp['id']}/products",
        json={"name": "Продукт"},
        headers=headers,
    ).json()
    person = client.post(
        "/api/v1/clients",
        json={"lastName": "Сортов", "firstName": "Игорь", "phone": "+79009998877"},
        headers=headers,
    ).json()
    today = utcnow()

    for number, days in (("OVER-10", -10), ("OK-5", 5), ("OVER-3", -3)):
        end = (today + timedelta(days=days)).strftime("%Y-%m-%d")
        client.post(
            "/api/v1/policies",
            json={
                "clientId": person["id"],
                "companyId": comp["id"],
                "productId": product["id"],
                "number": number,
                "insuredObject": "Объект",
                "premiumRubles": "1000",
                "endDate": end,
            },
            headers=headers,
        )

    tasks = client.get("/api/v1/home/renewal-tasks", headers=headers).json()
    numbers = [t["policy"]["number"] for t in tasks if t["client"]["lastName"] == "Сортов"]
    assert numbers.index("OVER-10") < numbers.index("OVER-3")
    assert numbers.index("OVER-3") < numbers.index("OK-5")
