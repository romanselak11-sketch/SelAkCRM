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


def test_analytics_uses_policy_issue_date(client):
    headers = _auth_headers(client)
    company = client.post("/api/v1/insurance-companies", json={"name": "СК Дата"}, headers=headers).json()
    product = client.post(
        f"/api/v1/insurance-companies/{company['id']}/products",
        json={"name": "Каско"},
        headers=headers,
    ).json()
    customer = client.post(
        "/api/v1/clients",
        json={
            "lastName": "Иванов",
            "firstName": "Иван",
            "phone": "+79001112233",
        },
        headers=headers,
    ).json()

    create_resp = client.post(
        "/api/v1/policies",
        json={
            "clientId": customer["id"],
            "companyId": company["id"],
            "productId": product["id"],
            "number": "DATE-1",
            "insuredObject": "Квартира",
            "premiumRubles": "1234.50",
            "issueDate": "2026-01-15",
            "endDate": "2027-01-15",
        },
        headers=headers,
    )
    assert create_resp.status_code == 200

    summary_resp = client.get(
        "/api/v1/analytics/summary",
        params={"from": "2026-01-15", "to": "2026-01-15"},
        headers=headers,
    )
    assert summary_resp.status_code == 200
    summary = summary_resp.json()
    assert summary["revenue"] == "1234.50"
    assert summary["policiesCount"] == 1

    daily_resp = client.get(
        "/api/v1/analytics/daily",
        params={"from": "2026-01-15", "to": "2026-01-15"},
        headers=headers,
    )
    assert daily_resp.status_code == 200
    points = daily_resp.json()["points"]
    assert len(points) == 1
    assert points[0]["day"] == "2026-01-15"
    assert points[0]["revenue"] == "1234.5"
    assert points[0]["policiesCount"] == 1
