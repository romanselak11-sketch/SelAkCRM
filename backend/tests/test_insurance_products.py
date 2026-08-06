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


def test_create_product_with_default_premium_rubles(client):
    headers = _bootstrap_super_admin(client)
    company = client.post(
        "/api/v1/insurance-companies",
        json={"name": "СК Тест"},
        headers=headers,
    ).json()

    r = client.post(
        f"/api/v1/insurance-companies/{company['id']}/products",
        json={
            "name": "ОСАГО",
            "defaultPremiumPct": "12.5",
            "defaultPremiumRubles": "500.00",
        },
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "ОСАГО"
    assert body["defaultPremiumPct"] == "12.5"
    assert body["defaultPremiumRubles"] == "500.00"

    listed = client.get(
        f"/api/v1/insurance-companies/{company['id']}/products",
        headers=headers,
    ).json()
    assert len(listed) == 1
    assert listed[0]["defaultPremiumRubles"] == "500.00"


def test_update_product_default_premium_rubles(client):
    headers = _bootstrap_super_admin(client)
    company = client.post(
        "/api/v1/insurance-companies",
        json={"name": "СК Тест 2"},
        headers=headers,
    ).json()
    product = client.post(
        f"/api/v1/insurance-companies/{company['id']}/products",
        json={"name": "КАСКО", "defaultPremiumPct": "15"},
        headers=headers,
    ).json()
    assert product.get("defaultPremiumRubles") is None

    r = client.patch(
        f"/api/v1/insurance-products/{product['id']}",
        json={"defaultPremiumRubles": "250.50"},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["defaultPremiumRubles"] == "250.50"
    assert r.json()["defaultPremiumPct"] == "15"

    cleared = client.patch(
        f"/api/v1/insurance-products/{product['id']}",
        json={"defaultPremiumRubles": None},
        headers=headers,
    )
    assert cleared.status_code == 200
    assert cleared.json()["defaultPremiumRubles"] is None
