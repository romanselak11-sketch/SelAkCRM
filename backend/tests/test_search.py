from selakcrm.domain.search import search_normalize


def test_search_normalize_lowercases_cyrillic() -> None:
    assert search_normalize("Новиков") == "новиков"


def test_search_normalize_maps_yo_to_e() -> None:
    assert search_normalize("Фёдорова") == "федорова"


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


def _create_policy(client, headers: dict[str, str], last_name: str, first_name: str, number: str) -> None:
    company = client.post("/api/v1/insurance-companies", json={"name": f"СК {number}"}, headers=headers).json()
    product = client.post(
        f"/api/v1/insurance-companies/{company['id']}/products",
        json={"name": "ОСАГО"},
        headers=headers,
    ).json()
    person = client.post(
        "/api/v1/clients",
        json={"lastName": last_name, "firstName": first_name, "phone": "+79001112233"},
        headers=headers,
    ).json()
    r = client.post(
        "/api/v1/policies",
        json={
            "clientId": person["id"],
            "companyId": company["id"],
            "productId": product["id"],
            "number": number,
            "insuredObject": "Авто",
            "premiumRubles": "5000",
            "issueDate": "2026-01-01",
            "endDate": "2027-01-01",
        },
        headers=headers,
    )
    assert r.status_code == 200


def test_policy_search_partial_last_name(client) -> None:
    headers = _bootstrap_super_admin(client)
    _create_policy(client, headers, "Новиков", "Анна", "POL-NOV-1")
    _create_policy(client, headers, "Сидоров", "Сергей", "POL-SID-1")

    res = client.get("/api/v1/policies?q=нови&page=1&limit=10", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["number"] == "POL-NOV-1"


def test_client_search_partial_last_name(client) -> None:
    headers = _bootstrap_super_admin(client)
    client.post(
        "/api/v1/clients",
        json={"lastName": "Новиков", "firstName": "Павел", "phone": "+79003334455"},
        headers=headers,
    )
    client.post(
        "/api/v1/clients",
        json={"lastName": "Михайлов", "firstName": "Дмитрий", "phone": "+79004445566"},
        headers=headers,
    )

    res = client.get("/api/v1/clients?q=нови&page=1&limit=10", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["lastName"] == "Новиков"
