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


def _seed_open_task(client, headers: dict[str, str]) -> tuple[str, str, str]:
    comp = client.post("/api/v1/insurance-companies", json={"name": "СК Продление"}, headers=headers).json()
    product = client.post(
        f"/api/v1/insurance-companies/{comp['id']}/products",
        json={"name": "КАСКО"},
        headers=headers,
    ).json()
    person = client.post(
        "/api/v1/clients",
        json={"lastName": "Новиков", "firstName": "Анна", "phone": "+79001112299"},
        headers=headers,
    ).json()
    end_date = (utcnow() + timedelta(days=12)).strftime("%Y-%m-%d")
    pol = client.post(
        "/api/v1/policies",
        json={
            "clientId": person["id"],
            "companyId": comp["id"],
            "productId": product["id"],
            "number": "OLD-001",
            "insuredObject": "Авто",
            "premiumRubles": "1000",
            "endDate": end_date,
        },
        headers=headers,
    ).json()
    tasks = client.get("/api/v1/home/renewal-tasks", headers=headers).json()
    assert len(tasks) >= 1
    task_id = tasks[0]["taskId"]
    return task_id, person["id"], pol["id"]


def test_feedback_postpone_requires_and_stores_comment(client):
    headers = _auth_headers(client)
    task_id, _, _ = _seed_open_task(client, headers)
    until = (utcnow() + timedelta(days=2)).replace(microsecond=0).isoformat() + "Z"
    bad = client.post(
        f"/api/v1/home/renewal-tasks/{task_id}/postpone",
        json={"mode": "feedback", "until": until},
        headers=headers,
    )
    assert bad.status_code == 400
    ok = client.post(
        f"/api/v1/home/renewal-tasks/{task_id}/postpone",
        json={"mode": "feedback", "until": until, "comment": "Ждём сканы паспорта"},
        headers=headers,
    )
    assert ok.status_code == 200
    tasks = client.get("/api/v1/home/renewal-tasks", headers=headers).json()
    row = next(x for x in tasks if x["taskId"] == task_id)
    assert row["status"] == "AWAITING_FEEDBACK"
    assert row["feedbackComment"] == "Ждём сканы паспорта"
    assert len(row["commentHistory"]) == 1
    assert row["commentHistory"][0]["text"] == "Ждём сканы паспорта"


def test_simple_postpone_requires_and_stores_comment(client):
    headers = _auth_headers(client)
    task_id, _, _ = _seed_open_task(client, headers)
    until = (utcnow() + timedelta(days=3)).replace(microsecond=0).isoformat() + "Z"
    bad = client.post(
        f"/api/v1/home/renewal-tasks/{task_id}/postpone",
        json={"mode": "simple", "until": until},
        headers=headers,
    )
    assert bad.status_code == 400
    ok = client.post(
        f"/api/v1/home/renewal-tasks/{task_id}/postpone",
        json={"mode": "simple", "until": until, "comment": "Перезвонить в понедельник"},
        headers=headers,
    )
    assert ok.status_code == 200
    tasks = client.get("/api/v1/home/renewal-tasks", headers=headers).json()
    row = next(x for x in tasks if x["taskId"] == task_id)
    assert row["status"] == "POSTPONED"
    assert row["postponeComment"] == "Перезвонить в понедельник"
    assert row["commentHistory"][0]["kind"] == "POSTPONE"


def test_postpone_twice_appends_comment_history(client):
    headers = _auth_headers(client)
    task_id, _, _ = _seed_open_task(client, headers)
    until = (utcnow() + timedelta(days=3)).replace(microsecond=0).isoformat() + "Z"
    client.post(
        f"/api/v1/home/renewal-tasks/{task_id}/postpone",
        json={"mode": "simple", "until": until, "comment": "Первый"},
        headers=headers,
    )
    client.post(
        f"/api/v1/home/renewal-tasks/{task_id}/postpone",
        json={"mode": "feedback", "until": until, "comment": "Второй"},
        headers=headers,
    )
    registry = client.get("/api/v1/home/tasks?page=1&limit=50", headers=headers).json()
    row = next(x for x in registry["items"] if x["taskId"] == task_id)
    assert len(row["commentHistory"]) == 2
    assert row["commentHistory"][0]["text"] == "Первый"
    assert row["commentHistory"][1]["text"] == "Второй"


def test_postponed_task_can_be_postponed_again(client):
    headers = _auth_headers(client)
    task_id, _, _ = _seed_open_task(client, headers)
    until = (utcnow() + timedelta(days=3)).replace(microsecond=0).isoformat() + "Z"
    r1 = client.post(
        f"/api/v1/home/renewal-tasks/{task_id}/postpone",
        json={"mode": "simple", "until": until, "comment": "Первый комментарий"},
        headers=headers,
    )
    assert r1.status_code == 200
    r2 = client.post(
        f"/api/v1/home/renewal-tasks/{task_id}/postpone",
        json={"mode": "simple", "until": until, "comment": "Второй комментарий"},
        headers=headers,
    )
    assert r2.status_code == 200


def test_renew_task_stores_renewed_policy(client):
    headers = _auth_headers(client)
    task_id, client_id, _old_policy_id = _seed_open_task(client, headers)
    comp2 = client.post("/api/v1/insurance-companies", json={"name": "СК Новая"}, headers=headers).json()
    product2 = client.post(
        f"/api/v1/insurance-companies/{comp2['id']}/products",
        json={"name": "ОСАГО"},
        headers=headers,
    ).json()
    end_date = (utcnow() + timedelta(days=365)).strftime("%Y-%m-%d")
    renew = client.post(
        f"/api/v1/home/renewal-tasks/{task_id}/renew",
        json={
            "clientId": client_id,
            "companyId": comp2["id"],
            "productId": product2["id"],
            "number": "NEW-777",
            "insuredObject": "Дом",
            "premiumRubles": "2500",
            "endDate": end_date,
        },
        headers=headers,
    )
    assert renew.status_code == 200
    assert renew.json()["number"] == "NEW-777"

    registry = client.get("/api/v1/home/tasks?page=1&limit=50", headers=headers).json()
    row = next(x for x in registry["items"] if x["taskId"] == task_id)
    assert row["status"] == "RENEWED"
    assert row["renewedPolicy"] is not None
    assert row["renewedPolicy"]["number"] == "NEW-777"
    assert row["renewedPolicy"]["companyName"] == "СК Новая"


def test_policy_patch_updates_client_and_company(client):
    headers = _auth_headers(client)
    comp_a = client.post("/api/v1/insurance-companies", json={"name": "СК А"}, headers=headers).json()
    comp_b = client.post("/api/v1/insurance-companies", json={"name": "СК Б"}, headers=headers).json()
    prod_a = client.post(
        f"/api/v1/insurance-companies/{comp_a['id']}/products",
        json={"name": "Продукт А"},
        headers=headers,
    ).json()
    prod_b = client.post(
        f"/api/v1/insurance-companies/{comp_b['id']}/products",
        json={"name": "Продукт Б"},
        headers=headers,
    ).json()
    c1 = client.post(
        "/api/v1/clients",
        json={"lastName": "Ivanov", "firstName": "Ivan", "phone": "+79001110001"},
        headers=headers,
    ).json()
    c2 = client.post(
        "/api/v1/clients",
        json={"lastName": "Petrov", "firstName": "Petr", "phone": "+79001110002"},
        headers=headers,
    ).json()
    end_date = (utcnow() + timedelta(days=200)).strftime("%Y-%m-%d")
    pol = client.post(
        "/api/v1/policies",
        json={
            "clientId": c1["id"],
            "companyId": comp_a["id"],
            "productId": prod_a["id"],
            "number": "X-1",
            "insuredObject": "Квартира",
            "premiumRubles": "1000",
            "endDate": end_date,
        },
        headers=headers,
    ).json()

    patched = client.patch(
        f"/api/v1/policies/{pol['id']}",
        json={
            "clientId": c2["id"],
            "companyId": comp_b["id"],
            "productId": prod_b["id"],
        },
        headers=headers,
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["client"]["lastName"] == "Petrov"
    assert body["company"]["name"] == "СК Б"
    assert body["product"]["name"] == "Продукт Б"
