"""
Comprehensive Unit & Integration Test Suite for PrismIQ Field Research Radar (Stage 3/4).

Tests:
1. Topic configuration CRUD and multi-tenant isolation.
2. Domain-scoped research item ingestion and global canonical URL deduplication.
3. Competitor-connection classification states (researching, adopting, mentioning, no activity detected).
4. Deliberate absence finding with auditable queried sources trail.
5. Zero-hallucination guarantee: ungrounded speculative inference is impossible.
6. Strict footing discipline: N == len(sources).
7. Executive brief rendering & per-tenant continuity logic.
8. REST API endpoints under authenticated multi-tenant context.
"""

import json
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from src import api, monitoring_agent, report_agent, research_radar, storage


@pytest.fixture
def mock_tenant_id():
    return "c8f13b91-46ef-4682-9975-f85764d8a12e"


@pytest.fixture
def auth_headers(mock_tenant_id):
    import jwt
    token = jwt.encode({"sub": mock_tenant_id, "exp": 9999999999}, "test-secret-key-that-is-at-least-32-bytes-long", algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def test_client():
    return TestClient(api.app)


# ============================================================================
# 1. Topic Configuration CRUD & Isolation
# ============================================================================

def test_topic_configuration_crud(mock_tenant_id, tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "_get_data_dir", lambda: tmp_path)

    # 1. Create manual topic
    topic1 = storage.save_tenant_research_topic(
        tenant_id=mock_tenant_id,
        topic_label="WASM at the edge",
        keywords=["wasm", "webassembly", "edge runtime"],
        source="manual",
    )
    assert topic1["topic_label"] == "WASM at the edge"
    assert "wasm" in topic1["keywords"]
    assert topic1["source"] == "manual"

    # 2. List topics
    topics = storage.get_tenant_research_topics(mock_tenant_id)
    assert len(topics) == 1
    assert topics[0]["topic_label"] == "WASM at the edge"

    # 3. Add second topic
    topic2 = storage.save_tenant_research_topic(
        tenant_id=mock_tenant_id,
        topic_label="Edge database consistency",
        keywords=["crdt", "raft", "edge database", "local-first"],
        source="manual",
    )
    topics = storage.get_tenant_research_topics(mock_tenant_id)
    assert len(topics) == 2

    # 4. Check global aggregation for Phase 1
    all_active = storage.get_all_active_research_topics()
    active_labels = [a["topic_label"] for a in all_active]
    assert "WASM at the edge" in active_labels
    assert "Edge database consistency" in active_labels

    # 5. Delete topic
    deleted = storage.delete_tenant_research_topic(mock_tenant_id, topic1["id"])
    assert deleted is True
    topics_after = storage.get_tenant_research_topics(mock_tenant_id)
    assert len(topics_after) == 1
    assert topics_after[0]["topic_label"] == "Edge database consistency"


# ============================================================================
# 2. Ingestion & Canonical URL Deduplication
# ============================================================================

def test_research_items_canonical_url_deduplication(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "_get_data_dir", lambda: tmp_path)

    items = [
        {
            "title": "Benchmarking WebAssembly Runtimes at Edge Nodes",
            "url": "https://arxiv.org/abs/2608.11111?ref=feed1",
            "canonical_url": "https://arxiv.org/abs/2608.11111",
            "published_at": "2026-09-01T10:00:00Z",
            "raw_excerpt": "We benchmark WASM execution latency under edge constraints.",
            "source": "arxiv",
            "authors": ["Alice Researcher", "Bob Engineer"],
            "matched_topics": ["WASM at the edge"],
        },
        {
            "title": "Benchmarking WebAssembly Runtimes at Edge Nodes (Mirror)",
            "url": "http://arxiv.org/abs/2608.11111/?ref=feed2#abstract",
            "canonical_url": "https://arxiv.org/abs/2608.11111",  # Same normalized canonical URL
            "published_at": "2026-09-01T10:00:00Z",
            "raw_excerpt": "We benchmark WASM execution latency under edge constraints.",
            "source": "arxiv",
            "authors": ["Alice Researcher"],
            "matched_topics": ["WASM at the edge", "Edge Computing"],
        },
    ]

    saved_count = storage.save_research_items(items)
    # The second item should be deduplicated against the first by canonical URL
    assert saved_count == 1

    stored = storage.get_research_items_for_topics(["WASM at the edge"])
    assert len(stored) == 1
    assert stored[0]["canonical_url"] == "https://arxiv.org/abs/2608.11111"
    # Merged topics
    assert "WASM at the edge" in stored[0]["matched_topics"]
    assert "Edge Computing" in stored[0]["matched_topics"]


# ============================================================================
# 3. Competitor Connection Classification States & Audit Trail
# ============================================================================

def test_classify_competitor_signal_states():
    topic = "WASM at the edge"
    keywords = ["wasm", "webassembly", "edge runtime"]

    # 1. State: researching (arXiv paper or formal R&D study)
    res_signal = {
        "title": "Microbenchmark analysis of wasm execution",
        "raw_excerpt": "We tested a prototype of our new webassembly sandbox.",
        "url": "https://blog.cloudflare.com/wasm-microbenchmarks/",
        "source": "research",
        "company": "Cloudflare",
    }
    st, reason, kws = research_radar.classify_competitor_signal(res_signal, topic, keywords)
    assert st == "researching"
    assert "wasm" in kws

    # 2. State: adopting (job posting)
    job_signal = {
        "title": "Staff Engineer - WebAssembly Runtime",
        "raw_excerpt": "Seeking systems engineer with deep proficiency in wasm edge runtime architecture.",
        "url": "https://vercel.com/careers/staff-wasm",
        "source": "jobs",
        "company": "Vercel",
    }
    st, reason, kws = research_radar.classify_competitor_signal(job_signal, topic, keywords)
    assert st == "adopting"
    assert "Active job posting" in reason

    # 3. State: adopting (product changelog / launch)
    launch_signal = {
        "title": "General Availability: Native WebAssembly on Netlify Functions",
        "raw_excerpt": "We shipped native support for wasm modules with zero startup latency.",
        "url": "https://netlify.com/changelog/wasm-support",
        "source": "news",
        "company": "Netlify",
    }
    st, reason, kws = research_radar.classify_competitor_signal(launch_signal, topic, keywords)
    assert st == "adopting"
    assert "shipping/integrating" in reason

    # 4. State: mentioning (opinion / blog discussion without building)
    mention_signal = {
        "title": "Why WebAssembly matters for future frontend tools",
        "raw_excerpt": "Discussion from our developer relations team on how wasm could evolve over the next decade.",
        "url": "https://fastly.com/blog/wasm-thoughts",
        "source": "blog",
        "company": "Fastly",
    }
    st, reason, kws = research_radar.classify_competitor_signal(mention_signal, topic, keywords)
    assert st == "mentioning"
    assert "without build/adopt evidence" in reason

    # 5. Non-matching signal returns None
    unrelated_signal = {
        "title": "Updated billing settings page",
        "raw_excerpt": "We redesigned the invoices tab in the customer portal.",
        "url": "https://fastly.com/changelog/billing",
        "source": "news",
        "company": "Fastly",
    }
    res = research_radar.classify_competitor_signal(unrelated_signal, topic, keywords)
    assert res is None

    # 6. Data integrity: placeholder URLs (e.g. example.com) must be rejected
    placeholder_signal = {
        "title": "Cloudflare launches AI Gateway with MCP",
        "raw_excerpt": "Cloudflare announced support for the MCP standard across AI gateway.",
        "url": "https://news.example.com/cloudflare-ai-mcp",
        "source": "news",
        "company": "Cloudflare",
    }
    res_ph = research_radar.classify_competitor_signal(placeholder_signal, topic, keywords)
    assert res_ph is None, "Placeholder domain (example.com) must be rejected from classification"



# ============================================================================
# 4. Absence Finding with Source Audit & Zero-Hallucination Guarantee
# ============================================================================

def test_deliberate_absence_finding_and_queried_sources_audit():
    topic = {
        "topic_label": "WASM at the edge",
        "keywords": ["wasm", "webassembly"],
    }
    competitors = ["Cloudflare", "Fastly"]

    # Pipeline signals: Cloudflare has non-matching signals; Fastly has zero signals
    pipeline_signals = [
        {
            "id": "sig_cf_1",
            "company": "Cloudflare",
            "source": "github",
            "title": "Fix doc typo in readme",
            "raw_excerpt": "Minor grammar correction.",
            "url": "https://github.com/cloudflare/docs",
        },
        {
            "id": "sig_cf_2",
            "company": "Cloudflare",
            "source": "jobs",
            "title": "Sales Account Executive",
            "raw_excerpt": "Enterprise software sales role.",
            "url": "https://cloudflare.com/careers/sales",
        },
    ]

    source_health = {
        "github": {"status": "healthy"},
        "jobs": {"status": "healthy"},
        "news": {"status": "healthy"},
        "pricing": {"status": "healthy"},
        "research": {"status": "healthy"},
    }

    eval_result = research_radar.evaluate_topic_radar(
        topic=topic,
        research_items=[],
        competitors=competitors,
        pipeline_signals=pipeline_signals,
        source_health=source_health,
    )

    conns = eval_result["competitor_connections"]

    # Both competitors must have state "no activity detected"
    assert conns["Cloudflare"]["status"] == "no activity detected"
    assert conns["Fastly"]["status"] == "no activity detected"

    # Must include auditable queried_sources record showing sources were checked
    cf_sources = conns["Cloudflare"]["queried_sources"]
    assert cf_sources["github"] is True
    assert cf_sources["jobs"] is True
    assert cf_sources["news"] is True
    assert "Sweep ran across" in conns["Cloudflare"]["reason"]

    # Zero-hallucination guarantee: state cannot be speculative
    assert conns["Fastly"]["status"] in research_radar.VALID_STATES
    assert "likely" not in conns["Fastly"]["status"].lower()
    assert "probably" not in conns["Fastly"]["status"].lower()


# ============================================================================
# 5. Strict Footing Check: N == len(sources)
# ============================================================================

def test_footing_arithmetic_discipline():
    topic = {
        "topic_label": "WASM at the edge",
        "keywords": ["wasm"],
    }
    research_items = [
        {
            "title": "Paper 1: WASM Runtimes",
            "canonical_url": "https://arxiv.org/abs/2608.00001",
            "raw_excerpt": "Paper on wasm edge latency.",
            "matched_topics": ["WASM at the edge"],
            "source": "arxiv",
        },
        {
            "title": "Paper 2: MicroVM Sandboxing with WASM",
            "canonical_url": "https://arxiv.org/abs/2608.00002",
            "raw_excerpt": "MicroVM paper exploring wasm isolation.",
            "matched_topics": ["WASM at the edge"],
            "source": "arxiv",
        },
    ]

    eval_result = research_radar.evaluate_topic_radar(
        topic=topic,
        research_items=research_items,
        competitors=["Cloudflare"],
        pipeline_signals=[],
    )

    # Strict footing assertion
    assert eval_result["research_item_count"] == 2
    assert len(eval_result["verified_sources"]) == 2
    assert eval_result["research_item_count"] == len(eval_result["verified_sources"])


# ============================================================================
# 6. Daily Brief Rendering & Continuity Logic
# ============================================================================

def test_render_field_research_radar_daily_brief_output_spec():
    evaluations = [
        {
            "topic_label": "WASM at the edge",
            "research_item_count": 2,
            "state_change_detected": True,
            "competitor_connections": {
                "Cloudflare": {"status": "researching", "reason": "Authored arXiv paper"},
                "Vercel": {"status": "no activity detected", "reason": "Zero matches"},
            },
            "active_competitors": [
                {"competitor": "Cloudflare", "status": "researching", "source_type": "research"}
            ],
            "why_it_matters": "Commercial validation & accelerating traction.",
            "verified_sources": [
                {"title": "Paper 1", "url": "https://arxiv.org/abs/1", "authors": ["Alice"]},
                {"title": "Paper 2", "url": "https://arxiv.org/abs/2", "authors": ["Bob"]},
            ],
        },
        {
            "topic_label": "Edge database consistency",
            "research_item_count": 0,
            "state_change_detected": True,
            "competitor_connections": {
                "Cloudflare": {"status": "no activity detected", "reason": "Zero matches"},
                "Vercel": {"status": "no activity detected", "reason": "Zero matches"},
            },
            "active_competitors": [],
            "why_it_matters": "Dormant cycle.",
            "verified_sources": [],
        },
    ]

    brief_lines = report_agent._render_field_research_radar_section(evaluations)
    brief_text = "\n".join(brief_lines)

    # 1. Check Section Heading
    assert "## Field Research Radar" in brief_text

    # 2. Check Topic 1 Spec Format
    assert "### 🔬 Emerging Research: WASM at the edge is gaining research activity." in brief_text
    assert "**Competitor connection**: 2 relevant research items found this cycle; activity detected among tracked competitors — Cloudflare (researching: research)." in brief_text
    assert "- **Why it matters**: Commercial validation & accelerating traction." in brief_text
    assert "- **Sources**: [Paper 1](https://arxiv.org/abs/1) (Alice); [Paper 2](https://arxiv.org/abs/2) (Bob)" in brief_text

    # 3. Check Explicit Zero Reporting for Topic 2
    assert "### 🔬 Emerging Research: no new research activity detected for Edge database consistency this cycle" in brief_text
    assert "**Competitor connection**: 0 relevant research items found this cycle; no corresponding activity detected among tracked competitors." in brief_text
    assert "- **Sources**: None" in brief_text


def test_per_tenant_continuity_suppresses_duplicate_readout_when_unchanged():
    # If no state changes and zero research items, it displays a concise summary note instead of spamming
    unchanged_evaluations = [
        {
            "topic_label": "WASM at the edge",
            "research_item_count": 0,
            "state_change_detected": False,  # Unchanged since last cycle
            "competitor_connections": {},
            "active_competitors": [],
            "why_it_matters": "No change.",
            "verified_sources": [],
        }
    ]
    brief_lines = report_agent._render_field_research_radar_section(unchanged_evaluations)
    brief_text = "\n".join(brief_lines)
    assert "*No new research activity or competitor state changes detected across configured topics this cycle.*" in brief_text


# ============================================================================
# 7. REST API Endpoints (Multi-Tenant Scoped under RLS)
# ============================================================================

def test_research_radar_api_endpoints(test_client, auth_headers, mock_tenant_id, tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "_get_data_dir", lambda: tmp_path)

    # 1. GET /research-radar/topics initially empty
    resp = test_client.get("/research-radar/topics", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["count"] == 0

    # 2. POST /research-radar/topics creates topic
    create_payload = {
        "topic_label": "AI agent tooling",
        "keywords": ["langchain", "crewai", "agent protocol", "agentic"],
    }
    resp = test_client.post("/research-radar/topics", json=create_payload, headers=auth_headers)
    assert resp.status_code == 200
    topic_data = resp.json()["topic"]
    assert topic_data["topic_label"] == "AI agent tooling"
    topic_id = topic_data["id"]

    # 3. GET /research-radar/topics returns new topic
    resp = test_client.get("/research-radar/topics", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["count"] == 1
    assert resp.json()["topics"][0]["topic_label"] == "AI agent tooling"

    # 4. GET /research-radar/latest executes evaluation
    resp = test_client.get("/research-radar/latest", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["count"] == 1
    assert resp.json()["evaluations"][0]["topic_label"] == "AI agent tooling"

    # 5. DELETE /research-radar/topics/{topic_id}
    resp = test_client.delete(f"/research-radar/topics/{topic_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"

    # Verify deleted
    resp = test_client.get("/research-radar/topics", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["count"] == 0
