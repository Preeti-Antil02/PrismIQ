import pytest
from fastapi.testclient import TestClient
from src.api import app, _create_jwt_token
from src import storage

client = TestClient(app)

def test_dynamic_onboarding_and_company_switching():
    # 1. Onboard Nike with Adidas and Puma
    nike_tid = "11111111-2222-3333-4444-555555555555"
    token_nike = _create_jwt_token(nike_tid, "director@nike.com")

    res_onboard = client.post(
        "/api/onboarding/confirm",
        json={
            "target_company": "Nike",
            "confirmed_competitors": ["Adidas", "Puma"]
        },
        headers={"Authorization": f"Bearer {token_nike}"}
    )
    assert res_onboard.status_code == 200
    body = res_onboard.json()
    assert body["target_company"] == "Nike"

    # 2. Verify Point 5: "Why Should I Care?" Decision Support
    res_ds = client.get("/decision-support", headers={"Authorization": f"Bearer {token_nike}"})
    assert res_ds.status_code == 200
    ds_data = res_ds.json()
    assert ds_data["count"] == 2
    ds_companies = [d["company_name"] for d in ds_data["items"]]
    assert "Adidas" in ds_companies
    assert "Puma" in ds_companies
    assert "Vercel" not in ds_companies
    assert "Netlify" not in ds_companies
    # Verify counter-playbook mentions Nike
    assert any("Nike" in d["why_it_matters"] or "Nike" in d["what_should_we_do"] for d in ds_data["items"])

    # 3. Verify Point 2: Historical Timeline Sequences
    res_seq = client.get("/timeline/sequences", headers={"Authorization": f"Bearer {token_nike}"})
    assert res_seq.status_code == 200
    seq_data = res_seq.json()
    seq_companies = [s["company_name"] for s in seq_data["sequences"]]
    assert "Adidas" in seq_companies
    assert "Puma" in seq_companies
    assert "Netlify" not in seq_companies

    # 4. Verify Point 3: 5 High-Impact Changes
    res_hic = client.get("/changes/detection", headers={"Authorization": f"Bearer {token_nike}"})
    assert res_hic.status_code == 200
    hic_data = res_hic.json()
    hic_companies = set(c["company_name"] for c in hic_data["changes"])
    assert "Adidas" in hic_companies or "Puma" in hic_companies
    assert "Vercel" not in hic_companies

    # 5. Verify Point 4: Signal Correlations
    res_corr = client.get("/signals/correlations", headers={"Authorization": f"Bearer {token_nike}"})
    assert res_corr.status_code == 200
    corr_data = res_corr.json()
    corr_companies = [c["company_name"] for c in corr_data["correlations"]]
    assert "Adidas" in corr_companies
    assert "Puma" in corr_companies
    assert "Vercel" not in corr_companies

    # 6. Now set up another completely different company: Stripe with Adyen and PayPal
    stripe_tid = "22222222-3333-4444-5555-666666666666"
    token_stripe = _create_jwt_token(stripe_tid, "founder@stripe.com")

    res_onboard_stripe = client.post(
        "/api/onboarding/confirm",
        json={
            "target_company": "Stripe",
            "confirmed_competitors": ["Adyen", "PayPal"]
        },
        headers={"Authorization": f"Bearer {token_stripe}"}
    )
    assert res_onboard_stripe.status_code == 200

    # Verify Stripe workspace returns ONLY Adyen and PayPal
    res_stripe_ds = client.get("/decision-support", headers={"Authorization": f"Bearer {token_stripe}"})
    assert res_stripe_ds.status_code == 200
    stripe_ds = res_stripe_ds.json()
    assert stripe_ds["count"] == 2
    stripe_companies = [d["company_name"] for d in stripe_ds["items"]]
    assert "Adyen" in stripe_companies
    assert "PayPal" in stripe_companies
    assert "Adidas" not in stripe_companies
    assert "Vercel" not in stripe_companies
    assert any("Stripe" in d["why_it_matters"] or "Stripe" in d["what_should_we_do"] for d in stripe_ds["items"])
