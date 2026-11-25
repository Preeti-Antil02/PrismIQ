#!/usr/bin/env python3
"""
Comprehensive Live On-Site Verification Script for PrismIQ.
Validates the live running application (Frontend on :3000, Backend on :8000):
- All 4 enterprise tenant overviews (Vercel, OpenAI, Flipkart, Meesho)
- Full 6-month stacked bar chart data volume (Jun - Nov 2026)
- Strict competitor exclusion (Zero Apple Inc./Google LLC on Vercel)
- Emerging strategic pattern cards and Next Best Action items
- Executive 6-Dimension Strategic Intelligence Profile detail pages
- All 16 frontend workspace subpages returning HTTP 200 OK
"""

import sys
import json
import urllib.request
import urllib.error
from typing import Dict, Any, List

FRONTEND_BASE = "http://localhost:3000"
BACKEND_BASE = "http://127.0.0.1:8000"

TENANTS = [
    {
        "name": "Vercel",
        "tenant_id": "c8f13b91-46ef-4682-9975-f85764d8a12e",
        "expected_competitors": ["Cloudflare", "Netlify", "AWS Amplify"],
        "forbidden_competitors": ["Apple Inc.", "Google LLC", "Google Workspace"],
        "min_events": 200,
        "test_detail_id": "cloudflare",
    },
    {
        "name": "OpenAI",
        "tenant_id": "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f",
        "expected_competitors": ["Anthropic", "Google DeepMind", "Mistral AI"],
        "forbidden_competitors": ["Apple Inc.", "Google LLC"],
        "min_events": 100,
        "test_detail_id": "anthropic",
    },
    {
        "name": "Flipkart",
        "tenant_id": "7b90477d-2524-4cf9-8e47-f389ec890ff7",
        "expected_competitors": ["Amazon India", "Meesho", "Reliance Retail"],
        "forbidden_competitors": ["Apple Inc."],
        "min_events": 15,
        "test_detail_id": "amazon",
    },
    {
        "name": "Meesho",
        "tenant_id": "8553449a-c998-4727-be01-9aeb724038cb",
        "expected_competitors": ["Amazon India", "Flipkart", "Shopsy"],
        "forbidden_competitors": ["Apple Inc."],
        "min_events": 50,
        "test_detail_id": "flipkart",
    },
]

FRONTEND_SUBPAGES = [
    "/app/overview",
    "/app/intelligence/evt_00828218ce22c9bf",
    "/app/brief",
    "/app/events",
    "/app/signals",
    "/app/trends",
    "/app/competitors",
    "/app/compare",
    "/app/intelligence-explorer",
    "/app/win-loss",
    "/app/deal-room",
    "/app/actions",
    "/app/evidence",
    "/app/impact",
    "/app/research-radar",
    "/app/workspace/settings",
]


def http_get(url: str, timeout: int = 15) -> tuple[int, bytes, Dict[str, str]]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "PrismIQ-LiveTest/1.0",
            "Accept": "*/*",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            headers = {k.lower(): v for k, v in resp.headers.items()}
            return resp.status, resp.read(), headers
    except urllib.error.HTTPError as e:
        headers = {k.lower(): v for k, v in e.headers.items()}
        return e.code, e.read(), headers
    except Exception as e:
        print(f"Connection failed to {url}: {e}")
        return 0, b"", {}


def run_live_tests():
    print("=" * 75)
    print("  PRISMIQ LIVE END-TO-END APPLICATION VERIFICATION GATES")
    print("=" * 75)
    passed = 0
    failed = 0

    def record(name: str, success: bool, msg: str = ""):
        nonlocal passed, failed
        if success:
            passed += 1
            print(f"  [PASS] {name} {msg}")
        else:
            failed += 1
            print(f"  [FAIL] {name} - ERROR: {msg}")

    # Gate 1: Check Backend & Frontend Health
    print("\n--- Gate 1: Server Process Health ---")
    st, body, _ = http_get(f"{BACKEND_BASE}/health")
    record("Backend /health", st == 200, f"(Status: {st})")

    st, body, _ = http_get(f"{FRONTEND_BASE}/app/overview")
    record("Frontend /app/overview HTML", st == 200, f"(Status: {st}, Bytes: {len(body)})")

    # Gate 2: Multi-Tenant Overview API Checks
    print("\n--- Gate 2: Multi-Tenant Overview Data & Competitor Isolation ---")
    for t in TENANTS:
        url = f"{FRONTEND_BASE}/api/overview?company={t['name']}&range=6m&tenant_id={t['tenant_id']}"
        st, body, _ = http_get(url)
        if st != 200:
            record(f"Tenant {t['name']} Overview API", False, f"HTTP {st}: {body[:200].decode('utf-8', 'ignore')}")
            continue

        data = json.loads(body.decode("utf-8"))

        # Verify Verified Events
        v_events = data.get("metrics", {}).get("verified_events", {}).get("value", 0)
        record(
            f"Tenant {t['name']} Verified Events (>= {t['min_events']})",
            v_events >= t["min_events"],
            f"Actual: {v_events}",
        )

        # Verify Tracked Competitors
        tracked_count = data.get("metrics", {}).get("tracked_competitors", {}).get("value", 0)
        record(
            f"Tenant {t['name']} Tracked Competitors Count (> 0)",
            tracked_count > 0,
            f"Actual: {tracked_count}",
        )

        # Verify High Priority Developments
        hp_count = data.get("metrics", {}).get("high_priority_developments", {}).get("value", 0)
        record(
            f"Tenant {t['name']} High Priority Developments (> 0)",
            hp_count > 0,
            f"Actual: {hp_count}",
        )

        # Verify Pending Actions
        pending_count = data.get("metrics", {}).get("pending_actions", {}).get("value", 0)
        record(
            f"Tenant {t['name']} Pending Actions (>= 3)",
            pending_count >= 3,
            f"Actual: {pending_count}",
        )

        # Verify Competitive Landscape Competitors
        landscape = data.get("competitive_landscape", {})
        chart_comps = landscape.get("competitors", [])
        has_data = landscape.get("has_data", False)
        record(
            f"Tenant {t['name']} Landscape has_data == True",
            has_data is True,
            f"Competitors in chart: {chart_comps}",
        )

        # Check Expected Competitors
        for exp in t["expected_competitors"]:
            record(
                f"Tenant {t['name']} includes expected competitor '{exp}'",
                exp in chart_comps,
                f"Competitors list: {chart_comps}",
            )

        # STRICT NEGATIVE TEST: Check Forbidden Competitors (Zero Apple Inc./Google LLC)
        for forbidden in t["forbidden_competitors"]:
            record(
                f"Tenant {t['name']} STRICTLY EXCLUDES '{forbidden}'",
                forbidden not in chart_comps,
                f"Competitors list: {chart_comps}",
            )

        # Verify 6-Month Chart Buckets
        months = landscape.get("months", [])
        chart_data = landscape.get("chart_data", [])
        record(
            f"Tenant {t['name']} 6-Month Distribution Columns",
            len(months) == 6 and len(chart_data) == 6,
            f"Months: {months}",
        )

        # Verify Emerging Strategic Patterns
        patterns = data.get("emerging_strategic_patterns", [])
        record(
            f"Tenant {t['name']} Emerging Strategic Patterns (>= 2)",
            len(patterns) >= 2,
            f"Actual count: {len(patterns)} - Titles: {[p.get('title') for p in patterns]}",
        )

        # Verify Next Best Actions
        actions = data.get("next_best_actions", [])
        record(
            f"Tenant {t['name']} Next Best Actions (>= 3)",
            len(actions) >= 3,
            f"Actual count: {len(actions)} - Titles: {[a.get('title')[:35] for a in actions]}",
        )

        # Verify What Deserves Attention
        attention = data.get("what_deserves_attention", [])
        record(
            f"Tenant {t['name']} What Deserves Attention (>= 4)",
            len(attention) >= 4,
            f"Actual count: {len(attention)}",
        )

    # Gate 3: Intelligence Detail View 6-Dimension Contract Checks
    print("\n--- Gate 3: Intelligence Detail View (6 Dimensions) ---")
    detail_checks = [
        ("evt_00828218ce22c9bf", "Flipkart", "7b90477d-2524-4cf9-8e47-f389ec890ff7"),
        ("cloudflare", "Vercel", "c8f13b91-46ef-4682-9975-f85764d8a12e"),
        ("anthropic", "OpenAI", "6a4703ac-0b04-436a-b3b9-ef2bb4b7fa3f"),
        ("amazon", "Flipkart", "7b90477d-2524-4cf9-8e47-f389ec890ff7"),
    ]

    for det_id, target, tid in detail_checks:
        url = f"{FRONTEND_BASE}/api/intelligence/{det_id}?target_company={target}&tenant_id={tid}"
        st, body, _ = http_get(url)
        if st != 200:
            record(f"Detail API for {det_id} ({target})", False, f"HTTP {st}: {body[:200].decode('utf-8', 'ignore')}")
            continue

        ddata = json.loads(body.decode("utf-8"))

        # Dimension 1: What Happened
        wh = ddata.get("what_happened", {})
        has_wh = bool(wh.get("headline") and wh.get("published_date") and wh.get("paragraph"))
        record(f"Detail {det_id} Dim 1: What Happened", has_wh, f"Headline: {wh.get('headline')[:50]}...")

        # Dimension 2: Why It Matters
        wim = ddata.get("why_it_matters", {})
        matrix = wim.get("strategic_matrix") or wim.get("strategic_lens") or {}
        has_matrix = bool(matrix.get("affected_products") and matrix.get("business_risk"))
        record(f"Detail {det_id} Dim 2: Why It Matters Matrix", has_matrix, f"Callout: {wim.get('callout_impact', '')[:45]}...")

        # Dimension 3: Who Is Affected
        depts = ddata.get("who_is_affected", {}).get("departments", [])
        has_depts = len(depts) == 4
        record(f"Detail {det_id} Dim 3: Who Is Affected (4 Depts)", has_depts, f"Depts: {[d.get('department') for d in depts]}")

        # Dimension 4: What Should We Do
        actions = ddata.get("what_should_we_do", {}).get("actions", [])
        has_actions = len(actions) >= 3 and all(a.get("next_step") for a in actions)
        record(f"Detail {det_id} Dim 4: What Should We Do (Actions + Next Steps)", has_actions, f"Actions: {len(actions)}")

        # Dimension 5: Urgency & Time Horizon
        urg = ddata.get("urgency_and_time_horizon", {})
        has_urg = bool(urg.get("time_horizon") and urg.get("priority_tier") and urg.get("cycle_review_due"))
        record(f"Detail {det_id} Dim 5: Urgency & Time Horizon", has_urg, f"Tier: {urg.get('priority_tier')}")

        # Dimension 6: Verification & Confidence
        verif = ddata.get("verification_and_confidence", {})
        has_verif = verif.get("confidence_score", 0) > 0 and verif.get("verified_sources_count", 0) >= 1
        record(f"Detail {det_id} Dim 6: Verification & Confidence Guarantee", has_verif, f"Score: {verif.get('confidence_score')}%")

    # Gate 4: Frontend Subpages Live HTTP 200 Rendering
    print("\n--- Gate 4: Frontend Subpages Live HTTP Status Check ---")
    for page in FRONTEND_SUBPAGES:
        url = f"{FRONTEND_BASE}{page}"
        st, body, _ = http_get(url)
        is_ok = st == 200 and len(body) > 2000
        record(f"Subpage {page}", is_ok, f"Status: {st}, Size: {len(body)} bytes")

    # Final Summary
    print("\n" + "=" * 75)
    print(f"  TOTAL GATES EXECUTED: {passed + failed} | PASSED: {passed} | FAILED: {failed}")
    print("=" * 75)

    if failed > 0:
        sys.exit(1)
    else:
        print("\nALL LIVE APPLICATION GATES PASSED WITH ZERO ERRORS!")


if __name__ == "__main__":
    run_live_tests()
