import pytest
import json
from pathlib import Path
from fastapi.testclient import TestClient
from src.api import app, _create_jwt_token
from src import storage

client = TestClient(app)

@pytest.fixture(autouse=True)
def preserve_decision_support():
    data_dir = storage._get_data_dir()
    ds_file = data_dir / "decision_support.json"
    backup = None
    if ds_file.exists():
        with open(ds_file, "r", encoding="utf-8") as f:
            backup = f.read()
    yield
    if backup is not None:
        with open(ds_file, "w", encoding="utf-8") as f:
            f.write(backup)

def test_get_decision_support_authenticated():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/decision-support", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert data["count"] >= 5

    # Verify 6 core dimensions on Vercel item
    vercel = next((d for d in data["items"] if d["company_name"] == "Vercel"), None)
    assert vercel is not None
    # 1. What happened?
    assert "AI-powered workflow automation" in vercel["what_happened"]
    # 2. Why does it matter?
    assert "Directly overlaps" in vercel["why_it_matters"]
    # 3. Who is affected?
    assert "Product" in vercel["who_is_affected"]
    assert "Sales" in vercel["who_is_affected"]
    # 4. What should we do?
    assert "counter" in vercel["what_should_we_do"].lower() or "battlecards" in vercel["what_should_we_do"].lower() or "roadmap" in vercel["what_should_we_do"].lower()
    # 5. Urgency & calibrated confidence
    assert vercel["urgency"] == "High"
    assert vercel["confidence"] >= 80.0
    # 6. Evidence (3+ independent sources)
    assert len(vercel["evidence_sources"]) >= 4
    for src in vercel["evidence_sources"]:
        assert "source" in src
        assert "title" in src
        assert "url" in src
        assert "http" in src["url"]

def test_get_decision_support_filter_by_company():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/decision-support?company=Netlify", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert all(d["company_name"].lower() == "netlify" for d in data["items"])
    assert data["count"] >= 1
    item = data["items"][0]
    assert "enterprise" in item["what_happened"].lower() or "billing" in item["what_happened"].lower()

def test_get_decision_support_filter_by_department():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/decision-support?department=Sales", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["count"] >= 2
    for item in data["items"]:
        assert any(dept.lower() == "sales" for dept in item["who_is_affected"])

def test_get_decision_support_filter_by_urgency():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/decision-support?urgency=High", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["count"] >= 3
    for item in data["items"]:
        assert item["urgency"].lower() == "high"

def test_get_company_decision_support_direct():
    token = _create_jwt_token("00000000-0000-0000-0000-000000000000", "tester@prismiq.dev")
    res = client.get("/decision-support/Amazon", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["company_name"] == "Amazon"
    assert len(data["items"]) >= 1
    amz = data["items"][0]
    assert "nuclear" in amz["what_happened"].lower() or "datacenter" in amz["what_happened"].lower() or "power" in amz["what_happened"].lower()

def test_create_decision_support_endpoint():
    token = _create_jwt_token("77777777-8888-9999-aaaa-bbbbbbbbbbbb", "exec_vp@prismiq.dev")
    payload = {
        "company_name": "Cloudflare",
        "event_id": "ev_cf_workers_ai_vector",
        "what_happened": "Cloudflare launched Zero-Latency Vectorize indexing alongside Workers AI multi-region inference.",
        "why_it_matters": "Provides sub-10ms similarity search directly inside edge request workers, disrupting standalone vector databases.",
        "who_is_affected": ["Product", "Engineering", "Sales"],
        "what_should_we_do": "Publish latency benchmarks demonstrating our sub-5ms caching tier and reinforce SOC2 enterprise compliance.",
        "urgency": "High",
        "confidence": 93.5,
        "corroboration_sources_count": 3,
        "evidence_sources": [
            {
                "source": "blog.cloudflare.com",
                "title": "Vectorize: High-Performance Vector Database at the Edge",
                "url": "https://blog.cloudflare.com/vectorize-vector-database",
                "excerpt": "Global distributed vector index accessible directly from Cloudflare Workers.",
                "detected_at": "2026-10-18T14:00:00Z"
            },
            {
                "source": "cloudflare.com/changelog",
                "title": "Workers AI General Availability & SLA Upgrade",
                "url": "https://developers.cloudflare.com/changelog",
                "excerpt": "Serverless GPUs in over 150 global data center locations.",
                "detected_at": "2026-10-19T09:30:00Z"
            },
            {
                "source": "LinkedIn Talent Insights",
                "title": "Cloudflare Edge AI Team Expansion",
                "url": "https://www.linkedin.com/company/cloudflare/jobs",
                "excerpt": "Hiring 15 Distributed Systems Engineers for Edge Compute.",
                "detected_at": "2026-10-15T11:00:00Z"
            }
        ]
    }
    res = client.post("/decision-support", json=payload, headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "success"
    assert body["decision_support_item"]["company_name"] == "Cloudflare"

def test_decision_support_security_unauthenticated():
    # Fail-closed with 401 without Authorization header
    res = client.get("/decision-support")
    assert res.status_code == 401
    assert "Missing Authorization" in res.json().get("detail", "")

    res_co = client.get("/decision-support/Vercel")
    assert res_co.status_code == 401
    assert "Missing Authorization" in res_co.json().get("detail", "")

    res_post = client.post("/decision-support", json={"company_name": "Intruder"})
    assert res_post.status_code == 401


def test_decision_support_executive_6_dimension_matrix():
    token = _create_jwt_token('8553449a-c998-4727-be01-9aeb724038cb', 'vp@meesho.dev')
    res = client.get('/decision-support', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    data = res.json()
    items = data['items']
    assert len(items) >= 4

    for item in items:
        # Dimension 1: What Happened (Inflection point summary)
        assert item.get('what_happened') and len(item['what_happened']) >= 20
        # Dimension 2: Why It Matters (Market & margin implications)
        assert item.get('why_it_matters') and len(item['why_it_matters']) >= 20
        # Dimension 3: Who Is Affected (Department routing)
        assert isinstance(item.get('who_is_affected'), list) and len(item['who_is_affected']) >= 1
        # Dimension 4: What Should We Do (Prescriptive counter-action playbook)
        assert item.get('what_should_we_do') and len(item['what_should_we_do']) >= 20
        # Dimension 5: Urgency & Time Horizon
        assert item.get('urgency') in ['Critical', 'High', 'Medium', 'Low']
        assert item.get('time_horizon') and any(h in item['time_horizon'] for h in ['Immediate', 'Tactical', 'Strategic'])
        # Dimension 6: Verification & Confidence
        assert item.get('confidence') and item['confidence'] >= 80.0
        assert item.get('corroboration_sources_count') and item['corroboration_sources_count'] >= 3
        assert len(item.get('evidence_sources', [])) >= 3
        for src in item['evidence_sources']:
            assert 'source' in src and 'title' in src and 'url' in src


def test_decision_support_actionable_counter_playbook_checklist():
    token = _create_jwt_token('8553449a-c998-4727-be01-9aeb724038cb', 'vp@meesho.dev')
    res = client.get('/decision-support', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    items = res.json()['items']

    for item in items:
        checklist = item.get('action_checklist')
        assert checklist is not None and isinstance(checklist, list)
        assert len(checklist) >= 4
        for action in checklist:
            assert 'id' in action
            assert 'text' in action and len(action['text']) >= 15
            assert 'department' in action


def test_decision_support_department_filtering_all_5_departments():
    token = _create_jwt_token('8553449a-c998-4727-be01-9aeb724038cb', 'vp@meesho.dev')
    for dept in ['Product', 'Sales', 'Marketing', 'Engineering', 'Leadership']:
        res = client.get(f'/decision-support?department={dept}', headers={'Authorization': f'Bearer {token}'})
        assert res.status_code == 200
        dept_data = res.json()
        assert dept_data['count'] >= 1, f'Expected at least 1 decision item for department: {dept}'


def test_meesho_bespoke_competitor_counter_strategies():
    token = _create_jwt_token('8553449a-c998-4727-be01-9aeb724038cb', 'vp@meesho.dev')
    res = client.get('/decision-support', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    items = res.json()['items']
    by_comp = {i['company_name']: i for i in items}

    # 1. Flipkart (quick commerce / Minutes dark stores / 15-min delivery)
    assert 'Flipkart' in by_comp
    fk = by_comp['Flipkart']
    assert 'minutes' in fk['what_happened'].lower() or 'dark-store' in fk['what_happened'].lower()
    assert '3pl' in fk['what_should_we_do'].lower() or 'margin' in fk['what_should_we_do'].lower() or 'cost advantage' in fk['what_should_we_do'].lower()
    assert any('minutes' in a['text'].lower() or 'grouped-delivery' in a['text'].lower() for a in fk['action_checklist'])

    # 2. Amazon India (Prime Lite / Bazaar low-cost / rail & air freight)
    assert 'Amazon India' in by_comp
    amz = by_comp['Amazon India']
    assert 'prime lite' in amz['what_happened'].lower() or 'bazaar' in amz['what_happened'].lower()
    assert 'upi' in amz['what_should_we_do'].lower() or 'settlement' in amz['what_should_we_do'].lower() or 'air cargo' in amz['what_should_we_do'].lower()
    assert any('prime lite' in a['text'].lower() or 'upi' in a['text'].lower() or 'bazaar' in a['text'].lower() for a in amz['action_checklist'])

    # 3. Shopsy (0-commission clone / WhatsApp team-buying / Ekart rural integration)
    assert 'Shopsy' in by_comp
    sh = by_comp['Shopsy']
    assert 'whatsapp' in sh['what_happened'].lower() or 'team-buying' in sh['what_happened'].lower() or '0%' in sh['what_happened'].lower()
    assert 'payout' in sh['what_should_we_do'].lower() or 'reseller' in sh['what_should_we_do'].lower()
    assert any('reseller' in a['text'].lower() or 'whatsapp' in a['text'].lower() or 'working capital' in a['text'].lower() for a in sh['action_checklist'])

    # 4. Ajio (Reliance Trends omnichannel 2500 stores / fast-fashion / Ajio Street)
    assert 'Ajio' in by_comp
    aj = by_comp['Ajio']
    assert 'reliance trends' in aj['what_happened'].lower() or '2,500' in aj['what_happened'].lower() or 'omnichannel' in aj['what_happened'].lower()
    assert 'budget' in aj['what_should_we_do'].lower() or 'mill' in aj['what_should_we_do'].lower() or 'direct-from-mill' in aj['what_should_we_do'].lower()
    assert any('ajio street' in a['text'].lower() or 'budget apparel' in a['text'].lower() or 'vernacular' in a['text'].lower() for a in aj['action_checklist'])


def test_ai_competitors_are_distinct_uncopied():
    """Verify Anthropic, Google DeepMind, and Meta AI display completely distinct, un-copied intelligence."""
    token = _create_jwt_token('6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f', 'sam@openai.dev')
    res = client.get('/decision-support', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    items = res.json()['items']
    by_comp = {i['company_name']: i for i in items}

    assert 'Anthropic' in by_comp
    assert 'Google DeepMind' in by_comp
    assert 'Meta AI' in by_comp

    anth = by_comp['Anthropic']
    deep = by_comp['Google DeepMind']
    meta = by_comp['Meta AI']

    # 1. Distinct What Happened
    assert 'computer use' in anth['what_happened'].lower()
    assert '2-million' in deep['what_happened'].lower() or 'context window' in deep['what_happened'].lower()
    assert 'llama 3.1' in meta['what_happened'].lower() or 'open weights' in meta['what_happened'].lower()

    # 2. Distinct Impact Categories
    categories = {anth['impact_category'], deep['impact_category'], meta['impact_category']}
    assert len(categories) >= 2, f"Expected distinct categories across AI competitors, got {categories}"

    # 3. Dynamic Department Routing (not universal 4 departments for all)
    assert 'Research' in deep['who_is_affected']
    assert 'Partnerships' in meta['who_is_affected'] or 'Marketing' in meta['who_is_affected']

    # 4. Bespoke actions (not copies)
    anth_actions = [a.get('text', '') or a.get('title', '') for a in anth['action_checklist']]
    deep_actions = [a.get('text', '') or a.get('title', '') for a in deep['action_checklist']]
    meta_actions = [a.get('text', '') or a.get('title', '') for a in meta['action_checklist']]

    assert anth_actions != deep_actions
    assert deep_actions != meta_actions


def test_cloud_and_streaming_competitors_distinct():
    """Verify AWS, Cloudflare, and Netflix each receive distinct, grounded intelligence."""
    from src import decision_support_engine
    aws_item = decision_support_engine.synthesize_decision_support_record("Cloudflare", "AWS")
    cf_item = decision_support_engine.synthesize_decision_support_record("AWS", "Cloudflare")
    nflx_item = decision_support_engine.synthesize_decision_support_record("Disney", "Netflix")

    assert aws_item['company_name'] == "AWS"
    assert cf_item['company_name'] == "Cloudflare"
    assert nflx_item['company_name'] == "Netflix"

    # Distinct categories
    assert "bedrock" in aws_item['what_happened'].lower() or "cloud" in aws_item['what_happened'].lower()
    assert "workers" in cf_item['what_happened'].lower() or "ai" in cf_item['what_happened'].lower()
    assert "ad-supported" in nflx_item['what_happened'].lower() or "advertiser" in nflx_item['what_happened'].lower()

    # Neither shows 94.5% confidence
    assert aws_item['confidence'] != 94.5
    assert cf_item['confidence'] != 94.5
    assert nflx_item['confidence'] != 94.5


def test_unknown_competitor_honest_empty_state():
    """When a new/unknown competitor is requested, engine returns an honest empty state with zero fabricated data."""
    from src import decision_support_engine
    item = decision_support_engine.synthesize_decision_support_record("OpenAI", "UnknownStartupXYZ")

    assert item['insufficient_evidence'] is True
    assert item['action_checklist'] == []
    assert item['execution_progress']['total'] == 0
    assert item['response_deadline_label'] == "No fixed response deadline established"
    assert item['deadline_at'] is None
    assert "monitoring active" in item['what_happened'].lower() or "no verified" in item['what_happened'].lower()


def test_action_status_transition_and_history():
    """Verify action checklist PATCH transitions status, updates progress, and records audit history."""
    token = _create_jwt_token('6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f', 'sam@openai.dev')
    res = client.get('/decision-support', headers={'Authorization': f'Bearer {token}'})
    assert res.status_code == 200
    items = res.json()['items']
    assert len(items) > 0
    item = items[0]
    item_id = item['id']
    actions = item['action_checklist']
    assert len(actions) > 0
    action_id = actions[0]['id']

    # Update to In Progress
    patch_res = client.patch(
        f'/decision-support/{item_id}/actions/{action_id}',
        headers={'Authorization': f'Bearer {token}'},
        json={'status': 'In Progress', 'notes': 'Assigned to technical product lead'}
    )
    assert patch_res.status_code == 200
    pdata = patch_res.json()
    assert pdata['status'] == 'success'
    assert pdata['new_status'] == 'In Progress'

    # Update to Accepted
    patch_res2 = client.patch(
        f'/decision-support/{item_id}/actions/{action_id}',
        headers={'Authorization': f'Bearer {token}'},
        json={'status': 'Accepted', 'notes': 'Leadership approved budget'}
    )
    assert patch_res2.status_code == 200
    pdata2 = patch_res2.json()
    assert pdata2['new_status'] == 'Accepted'
    assert pdata2['execution_progress']['accepted'] >= 1
    assert pdata2['execution_progress']['percent_complete'] >= 25

    # Check history
    hist_res = client.get(
        f'/decision-support/{item_id}/actions/history',
        headers={'Authorization': f'Bearer {token}'}
    )
    assert hist_res.status_code == 200
    hdata = hist_res.json()
    assert 'history' in hdata
    assert len(hdata['history']) >= 2
    assert hdata['history'][0]['new_status'] in ['Accepted', 'In Progress']


def test_on_demand_research_endpoint():
    """Verify POST /decision-support/research triggers dynamic synthesis on demand."""
    token = _create_jwt_token('6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f', 'sam@openai.dev')
    res = client.post(
        '/decision-support/research',
        headers={'Authorization': f'Bearer {token}'},
        json={'competitor_name': 'Anthropic', 'target_company': 'OpenAI'}
    )
    assert res.status_code == 200
    data = res.json()
    assert data['status'] == 'success'
    assert 'item' in data
    item = data['item']
    assert item['company_name'] == 'Anthropic'
    assert item['target_company'] == 'OpenAI'
    assert len(item['who_is_affected']) >= 3
    assert len(item['action_checklist']) >= 4


def test_dyadic_target_switching():
    """Verify analysis recalculates specifically when target company changes."""
    from src import decision_support_engine

    # Target: OpenAI vs Competitor: Anthropic
    openai_anth = decision_support_engine.synthesize_decision_support_record("OpenAI", "Anthropic")
    assert "chatgpt" in openai_anth['why_it_matters'].lower() or "openai" in openai_anth['why_it_matters'].lower()

    # Target: Cloudflare vs Competitor: AWS
    cf_aws = decision_support_engine.synthesize_decision_support_record("Cloudflare", "AWS")
    assert "workers" in cf_aws['why_it_matters'].lower() or "cloudflare" in cf_aws['why_it_matters'].lower()


def test_competitor_differentiation_anthropic_deepmind_meta():
    """Verify Anthropic, Google DeepMind, and Meta AI produce genuinely unique, differentiated intelligence."""
    from src import decision_support_engine

    anth = decision_support_engine.synthesize_decision_support_record("OpenAI", "Anthropic")
    deep = decision_support_engine.synthesize_decision_support_record("OpenAI", "Google DeepMind")
    meta = decision_support_engine.synthesize_decision_support_record("OpenAI", "Meta AI")

    # 1. What Happened must be completely different
    assert anth["what_happened"] != deep["what_happened"]
    assert deep["what_happened"] != meta["what_happened"]
    assert "computer use" in anth["what_happened"].lower()
    assert "2-million" in deep["what_happened"].lower() or "context window" in deep["what_happened"].lower()
    assert "405b" in meta["what_happened"].lower() or "llama" in meta["what_happened"].lower()

    # 2. Why It Matters must be bespoke and not copied
    assert anth["why_it_matters"] != deep["why_it_matters"]
    assert deep["why_it_matters"] != meta["why_it_matters"]
    assert "os-level" in anth["why_it_matters"].lower()
    assert "rag" in deep["why_it_matters"].lower() or "needle" in deep["why_it_matters"].lower()
    assert "open-weights" in meta["why_it_matters"].lower() or "commodit" in meta["why_it_matters"].lower()

    # 3. Affected Departments must be dynamically distinct
    assert anth["who_is_affected"] != deep["who_is_affected"]
    assert "Security" in anth["who_is_affected"]
    assert "Research" in deep["who_is_affected"]

    # 4. Action Checklists must be bespoke
    anth_acts = [a["title"] for a in anth["action_checklist"]]
    deep_acts = [a["title"] for a in deep["action_checklist"]]
    meta_acts = [a["title"] for a in meta["action_checklist"]]
    assert set(anth_acts).isdisjoint(set(deep_acts))
    assert set(deep_acts).isdisjoint(set(meta_acts))

    # 5. Confidence must be calculated independently (not hardcoded 94.5%)
    assert anth["confidence"] != 94.5 or deep["confidence"] != 94.5
    assert anth["confidence_breakdown"]["score"] == anth["confidence"]


def test_competitor_differentiation_aws_cloudflare_netflix():
    """Verify AWS, Cloudflare, and Netflix each have unique event grounding and counter-actions."""
    from src import decision_support_engine

    aws = decision_support_engine.synthesize_decision_support_record("OpenAI", "AWS")
    cf = decision_support_engine.synthesize_decision_support_record("OpenAI", "Cloudflare")
    nflx = decision_support_engine.synthesize_decision_support_record("OpenAI", "Netflix")

    assert "bedrock" in aws["what_happened"].lower() or "nuclear" in aws["what_happened"].lower()
    assert "vectorize" in cf["what_happened"].lower() or "workers" in cf["what_happened"].lower()
    assert "70 million" in nflx["what_happened"].lower() or "ad-supported" in nflx["what_happened"].lower()

    assert aws["why_it_matters"] != cf["why_it_matters"]
    assert cf["why_it_matters"] != nflx["why_it_matters"]

    # Unique actions
    aws_acts = [a["title"] for a in aws["action_checklist"]]
    cf_acts = [a["title"] for a in cf["action_checklist"]]
    nflx_acts = [a["title"] for a in nflx["action_checklist"]]
    assert set(aws_acts).isdisjoint(set(cf_acts))
    assert set(cf_acts).isdisjoint(set(nflx_acts))


def test_competitor_differentiation_meesho_rivals():
    """Verify Meesho rivals (Flipkart, Amazon India, Shopsy, Ajio) produce bespoke value commerce playbooks."""
    from src import decision_support_engine

    fk = decision_support_engine.synthesize_decision_support_record("Meesho", "Flipkart")
    amz = decision_support_engine.synthesize_decision_support_record("Meesho", "Amazon India")
    shop = decision_support_engine.synthesize_decision_support_record("Meesho", "Shopsy")
    ajio = decision_support_engine.synthesize_decision_support_record("Meesho", "Ajio")

    # What Happened
    assert "minutes" in fk["what_happened"].lower()
    assert "bazaar" in amz["what_happened"].lower() or "prime lite" in amz["what_happened"].lower()
    assert "whatsapp" in shop["what_happened"].lower() or "team-buying" in shop["what_happened"].lower() or "commission" in shop["what_happened"].lower()
    assert "reliance trends" in ajio["what_happened"].lower() or "ajio street" in ajio["what_happened"].lower()

    # Bespoke actions
    assert any("3pl" in a["title"].lower() or "minutes" in a["title"].lower() for a in fk["action_checklist"])
    assert any("upi" in a["title"].lower() or "prime" in a["title"].lower() for a in amz["action_checklist"])
    assert any("reseller" in a["title"].lower() or "whatsapp" in a["title"].lower() for a in shop["action_checklist"])
    assert any("apparel" in a["title"].lower() or "trends" in a["title"].lower() or "street" in a["title"].lower() for a in ajio["action_checklist"])


def test_honest_empty_state_for_unknown_competitor():
    """Verify unknown competitor returns honest surveillance empty state without fabricating intelligence."""
    from src import decision_support_engine

    unknown = decision_support_engine.synthesize_decision_support_record("OpenAI", "Acme Future AI Corp")

    assert unknown["insufficient_evidence"] is True
    assert unknown["dimension"] == "Market Surveillance"
    assert "No verified high-impact announcements detected" in unknown["what_happened"]
    assert "acmefutureaicorp.com" in unknown["why_it_matters"]
    assert unknown["action_checklist"] == []
    assert unknown["deadline_at"] is None
    assert unknown["response_deadline_label"] == "No fixed response deadline established"
    assert unknown["confidence"] == 70.0
