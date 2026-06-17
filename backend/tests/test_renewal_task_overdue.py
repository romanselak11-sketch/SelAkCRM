"""Просроченные задачи продления: не удаляются синхронизацией, отображаются на главной."""

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


def _seed_policy_and_task(client, headers: dict[str, str]) -> tuple[str, str]:
    comp = client.post("/api/v1/insurance-companies", json={"name": "СК Просрочка"}, headers=headers).json()
    product = client.post(
        f"/api/v1/insurance-companies/{comp['id']}/products",
        json={"name": "ОСАГО"},
        headers=headers,
    ).json()
    person = client.post(
        "/api/v1/clients",
        json={"lastName": "Петров", "firstName": "Пётр", "phone": "+79003334455"},
        headers=headers,
    ).json()
    end_date = (utcnow() + timedelta(days=12)).strftime("%Y-%m-%d")
    pol = client.post(
        "/api/v1/policies",
        json={
            "clientId": person["id"],
            "companyId": comp["id"],
            "productId": product["id"],
            "number": "P-OVD-12",
            "insuredObject": "Дом",
            "premiumRubles": "500",
            "endDate": end_date,
        },
        headers=headers,
    ).json()
    tasks = client.get("/api/v1/home/renewal-tasks", headers=headers).json()
    assert len(tasks) >= 1
    task_id = next(t["taskId"] for t in tasks if t["policyId"] == pol["id"])
    return task_id, pol["id"]


def test_overdue_task_stays_on_home_with_overdue_display(client):
    headers = _auth_headers(client)
    task_id, policy_id = _seed_policy_and_task(client, headers)
    expired_end = (utcnow() - timedelta(days=3)).strftime("%Y-%m-%d")
    patch = client.patch(
        f"/api/v1/policies/{policy_id}",
        json={"endDate": expired_end},
        headers=headers,
    )
    assert patch.status_code == 200

    home = client.get("/api/v1/home/renewal-tasks", headers=headers).json()
    row = next(x for x in home if x["taskId"] == task_id)
    assert row["display"]["kind"] == "overdue"
    assert "дн." in row["display"]["value"] or "ч" in row["display"]["value"]

    registry = client.get("/api/v1/home/tasks?page=1&limit=50", headers=headers).json()
    reg = next(x for x in registry["items"] if x["taskId"] == task_id)
    assert reg["display"]["kind"] == "overdue"


def test_manual_task_for_existing_policy(client):
    headers = _auth_headers(client)
    comp = client.post("/api/v1/insurance-companies", json={"name": "СК Ручная"}, headers=headers).json()
    product = client.post(
        f"/api/v1/insurance-companies/{comp['id']}/products",
        json={"name": "КАСКО"},
        headers=headers,
    ).json()
    person = client.post(
        "/api/v1/clients",
        json={"lastName": "Сидоров", "firstName": "Сидор", "phone": "+79005556677"},
        headers=headers,
    ).json()
    end_date = (utcnow() + timedelta(days=12)).strftime("%Y-%m-%d")
    pol = client.post(
        "/api/v1/policies",
        json={
            "clientId": person["id"],
            "companyId": comp["id"],
            "productId": product["id"],
            "number": "MAN-001",
            "insuredObject": "Авто",
            "premiumRubles": "1000",
            "endDate": end_date,
        },
        headers=headers,
    ).json()
    auto_tasks = client.get("/api/v1/home/renewal-tasks", headers=headers).json()
    auto = next(t for t in auto_tasks if t["policyId"] == pol["id"])
    client.post(
        f"/api/v1/home/renewal-tasks/{auto['taskId']}/decline",
        json={"reason": "тест"},
        headers=headers,
    )

    created = client.post(
        "/api/v1/home/tasks",
        json={"policyId": pol["id"]},
        headers=headers,
    )
    assert created.status_code == 200
    assert created.json()["status"] == "IN_PROGRESS"
    assert created.json()["policy"]["number"] == "MAN-001"

    dup = client.post(
        "/api/v1/home/tasks",
        json={"policyId": pol["id"]},
        headers=headers,
    )
    assert dup.status_code == 409


def test_sync_recreates_task_for_expired_policy_via_api(client):
    headers = _auth_headers(client)
    comp = client.post("/api/v1/insurance-companies", json={"name": "СК Восст"}, headers=headers).json()
    product = client.post(
        f"/api/v1/insurance-companies/{comp['id']}/products",
        json={"name": "ОСАГО"},
        headers=headers,
    ).json()
    person = client.post(
        "/api/v1/clients",
        json={"lastName": "Козлов", "firstName": "Козел", "phone": "+79006667788"},
        headers=headers,
    ).json()
    end_date = (utcnow() - timedelta(days=45)).strftime("%Y-%m-%d")
    pol = client.post(
        "/api/v1/policies",
        json={
            "clientId": person["id"],
            "companyId": comp["id"],
            "productId": product["id"],
            "number": "REC-001",
            "insuredObject": "Квартира",
            "premiumRubles": "800",
            "endDate": end_date,
        },
        headers=headers,
    ).json()
    home = client.get("/api/v1/home/renewal-tasks", headers=headers).json()
    row = next((t for t in home if t["policyId"] == pol["id"]), None)
    assert row is not None
    assert row["display"]["kind"] == "overdue"
