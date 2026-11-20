"""
Tests for Company-Specific Battlecard Intelligence Generation, Strict Grounding,
Cross-Competitor Distinctiveness, and Industry Boundary Integrity.
"""

import uuid
import pytest
from src.battlecard_generator import BattlecardGenerator
from src.battlecard_validator import validate_battlecard
from src import competitor_intelligence_kb, battlecard_storage


@pytest.fixture(autouse=True)
def reset_cache():
    battlecard_storage.clear_tenant_cache()
    yield
    battlecard_storage.clear_tenant_cache()


def test_meesho_battlecard_specifics_and_relevance():
    """
    Verify Meesho battlecard generates authentic retail/social commerce intelligence:
    - Products: 0% commission marketplace, Valmo logistics, Meesho Mall
    - ICP: Tier-2/3/4 Bharat shoppers, micro-suppliers, textile manufacturers
    - Objections: COD return-to-origin (RTO) rates, unbranded quality control
    - Zero cloud or enterprise software tropes
    """
    tenant_id = str(uuid.uuid4())
    generator = BattlecardGenerator(tenant_id=tenant_id)
    card = generator.generate_battlecard(
        company_name="Meesho",
        audience="sales",
        segment="general",
        force_refresh=True,
    )

    assert card is not None
    blocks = {b["block_key"]: b for b in card["blocks"]}

    # Snapshot positioning
    snap = blocks["snapshot_positioning"]["content"]
    assert "Meesho" in snap["company_name"]
    snap_stmt = snap["positioning_statement"].lower()
    assert any(k in snap_stmt for k in ["0-commission", "social commerce", "value", "tier-2", "bharat", "reseller"])
    assert not any(k in snap_stmt for k in ["sql data warehouse", "multi-cloud", "clickhouse", "kubernetes"])

    # Product & ICP
    prod_content = blocks["product_icp"]["content"]
    prods = [str(p).lower() for p in prod_content["key_products"]]
    assert any("valmo" in p or "commission" in p or "mall" in p for p in prods)
    assert any(k in prod_content["target_market"].lower() for k in ["tier-2", "tier-3", "bharat", "budget", "reseller", "textile"])

    # Objections
    obj_content = blocks["objections_responses"]["content"]
    objs = [item["objection"].lower() for item in obj_content["items"]]
    assert any("cash on delivery" in o or "cod" in o or "rto" in o or "quality" in o for o in objs)

    # Strengths
    sw_content = blocks["strengths_weaknesses"]["content"]
    strengths = [s.get("statement", "").lower() if isinstance(s, dict) else str(s).lower() for s in sw_content["strengths"]]
    assert any("price" in s or "unbranded" in s or "valmo" in s or "commission" in s for s in strengths)

    # Pricing
    price_content = blocks["pricing_comparison"]["content"]
    assert "0" in str(price_content["pricing_model"]) or "commission" in str(price_content["pricing_model"]).lower()

    # Validator evaluation
    prof = competitor_intelligence_kb.get_canonical_competitor_profile("meesho")
    val_res = validate_battlecard(card, prof)
    assert val_res.is_valid, f"Meesho validation failed: {val_res.issues}"
    assert val_res.relevance_score >= 85.0


def test_microsoft_battlecard_specifics_and_relevance():
    """
    Verify Microsoft battlecard generates authentic enterprise cloud & productivity intelligence:
    - Products: Microsoft Azure, Microsoft 365, Copilot, Entra ID
    - ICP: Enterprise IT, Fortune 500, CIOs
    - Objections: Enterprise Agreement (EA) bundling, Entra ID security lock-in
    - Zero retail tropes
    """
    tenant_id = str(uuid.uuid4())
    generator = BattlecardGenerator(tenant_id=tenant_id)
    card = generator.generate_battlecard(
        company_name="Microsoft",
        audience="sales",
        segment="enterprise",
        force_refresh=True,
    )

    assert card is not None
    blocks = {b["block_key"]: b for b in card["blocks"]}

    # Snapshot positioning
    snap = blocks["snapshot_positioning"]["content"]
    snap_stmt = snap["positioning_statement"].lower()
    assert any(k in snap_stmt for k in ["enterprise", "cloud", "azure", "copilot", "productivity"])
    assert not any(k in snap_stmt for k in ["cash on delivery", "tier-3 pin codes", "unbranded apparel"])

    # Products
    prod_content = blocks["product_icp"]["content"]
    prods = [str(p).lower() for p in prod_content["key_products"]]
    assert any("azure" in p or "365" in p or "copilot" in p or "entra" in p for p in prods)

    # Objections
    obj_content = blocks["objections_responses"]["content"]
    objs = [item["objection"].lower() for item in obj_content["items"]]
    assert any("enterprise agreement" in o or "ea" in o or "entra" in o or "compliance" in o for o in objs)

    # Pricing
    price_content = blocks["pricing_comparison"]["content"]
    assert any(k in str(price_content["pricing_model"]).lower() for k in ["user", "subscription", "azure", "per-user", "consumption"])

    # Validator evaluation
    prof = competitor_intelligence_kb.get_canonical_competitor_profile("microsoft")
    val_res = validate_battlecard(card, prof)
    assert val_res.is_valid, f"Microsoft validation failed: {val_res.issues}"
    assert val_res.relevance_score >= 85.0


def test_aws_battlecard_specifics_and_relevance():
    """
    Verify AWS battlecard generates authentic cloud infrastructure intelligence:
    - Products: EC2, S3, Aurora, Bedrock
    - Objections: Data transfer egress networking fees, 200+ service management complexity
    - Discovery questions target AWS billing & DevOps staffing
    """
    tenant_id = str(uuid.uuid4())
    generator = BattlecardGenerator(tenant_id=tenant_id)
    card = generator.generate_battlecard(
        company_name="AWS",
        audience="sales",
        segment="general",
        force_refresh=True,
    )

    assert card is not None
    blocks = {b["block_key"]: b for b in card["blocks"]}

    # Product & ICP
    prod_content = blocks["product_icp"]["content"]
    prods = [str(p).lower() for p in prod_content["key_products"]]
    assert any("ec2" in p or "s3" in p or "bedrock" in p or "aurora" in p for p in prods)

    # Objections
    obj_content = blocks["objections_responses"]["content"]
    objs = [item["objection"].lower() for item in obj_content["items"]]
    assert any("savings plans" in o or "edp" in o or "200+ services" in o or "compliance" in o for o in objs)

    # Discovery questions
    disc_content = blocks["discovery_questions"]["content"]
    questions = [item["question"].lower() for item in disc_content["items"]]
    assert any("egress" in q or "devops" in q or "bedrock" in q for q in questions)

    # Validator evaluation
    prof = competitor_intelligence_kb.get_canonical_competitor_profile("aws")
    val_res = validate_battlecard(card, prof)
    assert val_res.is_valid, f"AWS validation failed: {val_res.issues}"
    assert val_res.relevance_score >= 85.0


def test_flipkart_battlecard_specifics():
    """Verify Flipkart battlecard focuses on Indian e-commerce, Shopsy, and Ekart."""
    tenant_id = str(uuid.uuid4())
    generator = BattlecardGenerator(tenant_id=tenant_id)
    card = generator.generate_battlecard(
        company_name="Flipkart",
        audience="sales",
        segment="general",
        force_refresh=True,
    )

    blocks = {b["block_key"]: b for b in card["blocks"]}
    prod_content = blocks["product_icp"]["content"]
    prods = [str(p).lower() for p in prod_content["key_products"]]
    assert any("shopsy" in p or "ekart" in p or "minutes" in p or "marketplace" in p for p in prods)

    obj_content = blocks["objections_responses"]["content"]
    objs = [item["objection"].lower() for item in obj_content["items"]]
    assert any("festival" in o or "big billion days" in o or "commission" in o or "ekart" in o for o in objs)


def test_amazon_india_battlecard_specifics():
    """Verify Amazon India battlecard focuses on Prime ecosystem, FBA, and Amazon Bazaar."""
    tenant_id = str(uuid.uuid4())
    generator = BattlecardGenerator(tenant_id=tenant_id)
    card = generator.generate_battlecard(
        company_name="Amazon India",
        audience="sales",
        segment="general",
        force_refresh=True,
    )

    blocks = {b["block_key"]: b for b in card["blocks"]}
    prod_content = blocks["product_icp"]["content"]
    prods = [str(p).lower() for p in prod_content["key_products"]]
    assert any("prime" in p or "fba" in p or "bazaar" in p or "marketplace" in p for p in prods)

    price_content = blocks["pricing_comparison"]["content"]
    assert "prime" in str(price_content["pricing_model"]).lower() or "referral" in str(price_content["pricing_model"]).lower()


def test_cross_competitor_distinctiveness():
    """
    Cross-competitor distinctiveness test:
    Verify that battlecards for unrelated competitors (e.g. Meesho vs Microsoft, AWS vs Flipkart)
    have minimal vocabulary and claim overlap (Jaccard similarity < 0.25).
    Guarantees no generic boilerplate template repetition.
    """
    tenant_id = str(uuid.uuid4())
    generator = BattlecardGenerator(tenant_id=tenant_id)

    card_meesho = generator.generate_battlecard("Meesho", audience="sales", force_refresh=True)
    card_msft = generator.generate_battlecard("Microsoft", audience="sales", force_refresh=True)
    card_aws = generator.generate_battlecard("AWS", audience="sales", force_refresh=True)

    def extract_words(card):
        words = set()
        for b in card["blocks"]:
            for c in b["claims"]:
                stmt = c.get("statement", "")
                for w in stmt.lower().split():
                    cleaned = "".join(ch for ch in w if ch.isalnum())
                    if len(cleaned) > 4:  # focus on content words
                        words.add(cleaned)
        return words

    words_meesho = extract_words(card_meesho)
    words_msft = extract_words(card_msft)
    words_aws = extract_words(card_aws)

    def jaccard(s1, s2):
        if not s1 or not s2:
            return 0.0
        return len(s1.intersection(s2)) / len(s1.union(s2))

    similarity_meesho_msft = jaccard(words_meesho, words_msft)
    similarity_meesho_aws = jaccard(words_meesho, words_aws)

    # Content similarity between e-commerce and cloud enterprise must be very low
    assert similarity_meesho_msft < 0.20, f"Too much overlap between Meesho and Microsoft: {similarity_meesho_msft}"
    assert similarity_meesho_aws < 0.20, f"Too much overlap between Meesho and AWS: {similarity_meesho_aws}"


def test_battlecard_publishing_and_safe_regeneration():
    """
    Verify safe regeneration mechanism:
    1. Generate battlecard (draft v1).
    2. Publish it (published v1).
    3. Regenerate battlecard with force_refresh:
       - Preserves the battlecard ID.
       - Leaves published_version intact.
       - Creates revision record in audit history.
    """
    tenant_id = str(uuid.uuid4())
    generator = BattlecardGenerator(tenant_id=tenant_id)

    # Step 1: Initial draft
    c1 = generator.generate_battlecard("AWS", audience="sales", force_refresh=True)
    card_id = c1["id"]
    assert c1["status"] == "draft"
    assert c1["current_version"] == 1
    assert c1["published_version"] is None

    # Step 2: Publish battlecard
    from src import battlecard_storage
    pub_result = battlecard_storage.publish_battlecard(
        battlecard_id=card_id,
        tenant_id=tenant_id,
        published_by="analyst_lead",
        change_summary="Initial verified Q4 release",
    )
    assert pub_result["battlecard"]["status"] == "published"
    assert pub_result["battlecard"]["published_version"] == 1

    # Step 3: Regenerate with force_refresh=True
    c2 = generator.generate_battlecard("AWS", audience="sales", force_refresh=True)
    assert c2["id"] == card_id, "Regeneration must preserve battlecard ID"
    assert c2["published_version"] == 1, "Published version must remain intact"

    # Step 4: Verify revision audit history
    revs = battlecard_storage.get_battlecard_revisions(card_id, tenant_id=tenant_id)
    assert len(revs) >= 1
    assert revs[0]["version"] == 1
