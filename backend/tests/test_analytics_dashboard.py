"""Analytics attribution, filters, breakdowns, renewals."""

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


_phone_seq = 0


def _seed_policy(client, headers, *, number: str, premium: str, issue: str, end: str) -> dict:
    global _phone_seq
    _phone_seq += 1
    phone = f"+7901{_phone_seq:07d}"
    company = client.post("/api/v1/insurance-companies", json={"name": f"СК {number}"}, headers=headers).json()
    product = client.post(
        f"/api/v1/insurance-companies/{company['id']}/products",
        json={"name": f"Прод {number}"},
        headers=headers,
    ).json()
    customer = client.post(
        "/api/v1/clients",
        json={"lastName": "Тест", "firstName": number.replace("-", ""), "phone": phone},
        headers=headers,
    ).json()
    pol = client.post(
        "/api/v1/policies",
        json={
            "clientId": customer["id"],
            "companyId": company["id"],
            "productId": product["id"],
            "number": number,
            "insuredObject": "Объект",
            "premiumRubles": premium,
            "issueDate": issue,
            "endDate": end,
        },
        headers=headers,
    )
    assert pol.status_code == 200, pol.text
    return pol.json()


def test_policy_create_sets_created_by_user(client):
    headers = _auth_headers(client)
    me = client.get("/api/v1/auth/me", headers=headers).json()
    pol = _seed_policy(
        client,
        headers,
        number="ATTR-1",
        premium="100.00",
        issue="2026-03-01",
        end="2027-03-01",
    )
    assert pol["createdByUserId"] == me["id"]


def test_analytics_filter_by_user(client):
    headers = _auth_headers(client)
    me = client.get("/api/v1/auth/me", headers=headers).json()
    _seed_policy(
        client,
        headers,
        number="USR-1",
        premium="200.00",
        issue="2026-03-10",
        end="2027-03-10",
    )
    summary = client.get(
        "/api/v1/analytics/summary",
        params={"from": "2026-03-01", "to": "2026-03-31", "userId": me["id"]},
        headers=headers,
    )
    assert summary.status_code == 200
    body = summary.json()
    assert body["policiesCount"] == 1
    assert body["avgAgentIncome"] is not None

    empty = client.get(
        "/api/v1/analytics/summary",
        params={"from": "2026-03-01", "to": "2026-03-31", "userId": "nobody"},
        headers=headers,
    )
    assert empty.status_code == 200
    assert empty.json()["policiesCount"] == 0


def test_analytics_user_and_unattributed_conflict(client):
    headers = _auth_headers(client)
    r = client.get(
        "/api/v1/analytics/summary",
        params={"from": "2026-01-01", "to": "2026-01-31", "userId": "x", "unattributed": "true"},
        headers=headers,
    )
    assert r.status_code == 400


def test_analytics_from_after_to_rejected(client):
    headers = _auth_headers(client)
    r = client.get(
        "/api/v1/analytics/summary",
        params={"from": "2026-02-01", "to": "2026-01-01"},
        headers=headers,
    )
    assert r.status_code == 400


def test_analytics_period_over_367_days_rejected(client):
    headers = _auth_headers(client)
    r = client.get(
        "/api/v1/analytics/summary",
        params={"from": "2025-01-01", "to": "2026-01-04"},
        headers=headers,
    )
    assert r.status_code == 400
    assert "367" in r.json()["message"]


def test_analytics_breakdowns_and_renewals(client):
    headers = _auth_headers(client)
    end = (utcnow() + timedelta(days=12)).strftime("%Y-%m-%d")
    issue = utcnow().strftime("%Y-%m-%d")
    _seed_policy(client, headers, number="BRK-1", premium="50.00", issue=issue, end=end)

    br = client.get(
        "/api/v1/analytics/breakdowns",
        params={"from": issue, "to": issue},
        headers=headers,
    )
    assert br.status_code == 200
    data = br.json()
    assert len(data["byCompany"]) >= 1
    assert len(data["byProduct"]) >= 1
    assert len(data["byUser"]) >= 1

    rn = client.get(
        "/api/v1/analytics/renewals",
        params={"from": issue, "to": issue},
        headers=headers,
    )
    assert rn.status_code == 200
    body = rn.json()
    assert body["openCount"] >= 1
    assert "overdueCount" in body
    assert "conversionPct" in body
