import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import pricing_extractor


# Sample HTML Fixtures
VERCEL_SAMPLE_HTML = """
<html>
<body>
  <div>
    <div>
      <h3>Hobby</h3>
      <div>$0</div>
      <div>/mo.</div>
      <p>The perfect starting place for your web app or personal project.</p>
      <ul>
        <li>Import your repo, deploy in seconds</li>
        <li>Automatic CI/CD</li>
        <li>Web Application Firewall</li>
      </ul>
    </div>
    <div>
      <h3>Pro</h3>
      <div>Popular</div>
      <div>$20</div>
      <div>/mo.</div>
      <p>Everything you need to build and scale your app.</p>
      <ul>
        <li>$20 of included usage credit</li>
        <li>Advanced spend management</li>
        <li>Team collaboration</li>
      </ul>
    </div>
    <div>
      <h3>Enterprise</h3>
      <div>Custom</div>
      <p>Critical security, performance, observability, platform SLAs, and support.</p>
      <ul>
        <li>Guest & Team access controls</li>
        <li>SCIM & Directory Sync</li>
        <li>99.99% SLA</li>
      </ul>
    </div>
  </div>
</body>
</html>
"""

NETLIFY_SAMPLE_HTML = """
<html>
<body>
  <div>
    <div>
      <h3>Free</h3>
      <div>$0</div>
      <div>forever</div>
      <ul>
        <li>Build and deploy free forever</li>
        <li>Deploy from AI, Git, or API</li>
      </ul>
    </div>
    <div>
      <h3>Personal</h3>
      <div>$9</div>
      <div>/month</div>
      <ul>
        <li>Smart secret detection</li>
        <li>Priority email support</li>
      </ul>
    </div>
    <div>
      <h3>Pro</h3>
      <div>$20</div>
      <div>/month with unlimited members</div>
      <ul>
        <li>Private organization repos</li>
        <li>3+ concurrent builds</li>
      </ul>
    </div>
    <div>
      <h3>Enterprise</h3>
      <div>Custom</div>
      <p>Scale with confidence</p>
      <ul>
        <li>99.99% SLA</li>
        <li>SSO & SCIM</li>
      </ul>
    </div>
  </div>
</body>
</html>
"""

CLOUDFLARE_SAMPLE_HTML = """
<html>
<body>
  <div>
    <div>
      <h3>Free</h3>
      <p>For personal or hobby projects that aren't business-critical.</p>
      <div>$0</div>
      <div>/month</div>
    </div>
    <div>
      <h3>Pro</h3>
      <p>For professional websites that aren't business-critical.</p>
      <div>$20</div>
      <div>/mo billed annually, or $25/mo billed monthly</div>
    </div>
    <div>
      <h3>Business</h3>
      <p>For small businesses operating online.</p>
      <div>$200</div>
      <div>/mo billed annually, or $250/mo billed monthly</div>
    </div>
    <div>
      <h3>Contract</h3>
      <p>For mission-critical applications that are core to your business.</p>
      <div>Custom</div>
      <div>Annual price per user</div>
    </div>
  </div>
</body>
</html>
"""


def test_extract_vercel_pricing_structure():
    plans = pricing_extractor.extract_vercel_pricing(VERCEL_SAMPLE_HTML)
    assert len(plans) == 3
    
    hobby = next(p for p in plans if p["plan_name"] == "Hobby")
    assert hobby["price_monthly"] == "$0"
    assert hobby["price_annual"] == "$0"
    assert hobby["billing_period"] == "monthly"
    assert hobby["currency"] == "USD"
    assert hobby["is_custom"] is False
    assert "Import your repo, deploy in seconds" in hobby["features"]
    
    pro = next(p for p in plans if p["plan_name"] == "Pro")
    assert pro["price_monthly"] == "$20"
    assert pro["price_annual"] == "$20"
    assert pro["billing_period"] == "monthly"
    assert pro["currency"] == "USD"
    assert pro["is_custom"] is False
    assert "$20 of included usage credit" in pro["features"]
    
    ent = next(p for p in plans if p["plan_name"] == "Enterprise")
    assert ent["price_monthly"] is None
    assert ent["price_annual"] is None
    assert ent["billing_period"] == "custom"
    assert ent["currency"] is None
    assert ent["is_custom"] is True


def test_extract_netlify_pricing_structure():
    plans = pricing_extractor.extract_netlify_pricing(NETLIFY_SAMPLE_HTML)
    assert len(plans) == 4
    
    free = next(p for p in plans if p["plan_name"] == "Free")
    assert free["price_monthly"] == "$0"
    assert free["price_annual"] == "$0"
    assert free["billing_period"] == "forever"
    assert free["is_custom"] is False
    
    personal = next(p for p in plans if p["plan_name"] == "Personal")
    assert personal["price_monthly"] == "$9"
    assert personal["price_annual"] == "$9"
    assert personal["billing_period"] == "monthly"
    assert personal["is_custom"] is False
    
    pro = next(p for p in plans if p["plan_name"] == "Pro")
    assert pro["price_monthly"] == "$20"
    assert pro["price_annual"] == "$20"
    assert pro["billing_period"] == "monthly"
    assert pro["is_custom"] is False
    
    ent = next(p for p in plans if p["plan_name"] == "Enterprise")
    assert ent["price_monthly"] is None
    assert ent["price_annual"] is None
    assert ent["billing_period"] == "custom"
    assert ent["currency"] is None
    assert ent["is_custom"] is True


def test_extract_cloudflare_pricing_structure():
    plans = pricing_extractor.extract_cloudflare_pricing(CLOUDFLARE_SAMPLE_HTML)
    assert len(plans) == 4
    
    free = next(p for p in plans if p["plan_name"] == "Free")
    assert free["price_monthly"] == "$0"
    assert free["price_annual"] == "$0"
    
    pro = next(p for p in plans if p["plan_name"] == "Pro")
    # Pro has both $25/mo monthly and $20/mo annual
    assert pro["price_monthly"] == "$25"
    assert pro["price_annual"] == "$20"
    assert pro["billing_period"] == "monthly/annual"
    assert pro["is_custom"] is False
    
    biz = next(p for p in plans if p["plan_name"] == "Business")
    # Business has both $250/mo monthly and $200/mo annual
    assert biz["price_monthly"] == "$250"
    assert biz["price_annual"] == "$200"
    assert biz["billing_period"] == "monthly/annual"
    assert biz["is_custom"] is False
    
    ent = next(p for p in plans if p["plan_name"] == "Enterprise")
    assert ent["price_monthly"] is None
    assert ent["price_annual"] is None
    assert ent["billing_period"] == "custom"
    assert ent["currency"] is None
    assert ent["is_custom"] is True


def test_first_run_no_baseline_produces_zero_change_signals(tmp_path):
    plans = [
        {"plan_name": "Hobby", "price_monthly": "$0", "price_annual": "$0", "billing_period": "monthly", "currency": "USD"},
        {"plan_name": "Pro", "price_monthly": "$20", "price_annual": "$20", "billing_period": "monthly", "currency": "USD"},
    ]
    
    signals, is_failure = pricing_extractor.diff_pricing_snapshots(
        "Vercel", None, plans, "https://vercel.com/pricing"
    )
    
    assert signals == []
    assert is_failure is False


def test_genuine_price_change_detection_dual_cadence():
    old_snapshot = {
        "company": "Vercel",
        "url": "https://vercel.com/pricing",
        "plans": [
            {"plan_name": "Hobby", "price_monthly": "$0", "price_annual": "$0", "billing_period": "monthly", "currency": "USD"},
            {"plan_name": "Pro", "price_monthly": "$20", "price_annual": "$20", "billing_period": "monthly", "currency": "USD"},
            {"plan_name": "Enterprise", "price_monthly": None, "price_annual": None, "billing_period": "custom", "currency": None},
        ],
    }
    
    # 1. Simulate monthly price increase from $20 to $25 while annual remains unchanged
    new_plans_monthly_bump = [
        {"plan_name": "Hobby", "price_monthly": "$0", "price_annual": "$0", "billing_period": "monthly", "currency": "USD"},
        {"plan_name": "Pro", "price_monthly": "$25", "price_annual": "$20", "billing_period": "monthly", "currency": "USD"},
        {"plan_name": "Enterprise", "price_monthly": None, "price_annual": None, "billing_period": "custom", "currency": None},
    ]
    
    signals_m, is_failure_m = pricing_extractor.diff_pricing_snapshots(
        "Vercel", old_snapshot, new_plans_monthly_bump, "https://vercel.com/pricing"
    )
    
    assert is_failure_m is False
    assert len(signals_m) == 1
    assert "Pricing Change (Monthly): Vercel Pro monthly price changed from $20 to $25" in signals_m[0]["title"]

    # 2. Simulate general price increase across both monthly and annual ($20->$25 monthly, $20->$22 annual)
    new_plans_both_bump = [
        {"plan_name": "Hobby", "price_monthly": "$0", "price_annual": "$0", "billing_period": "monthly", "currency": "USD"},
        {"plan_name": "Pro", "price_monthly": "$25", "price_annual": "$22", "billing_period": "monthly", "currency": "USD"},
        {"plan_name": "Enterprise", "price_monthly": None, "price_annual": None, "billing_period": "custom", "currency": None},
    ]
    signals_b, is_failure_b = pricing_extractor.diff_pricing_snapshots(
        "Vercel", old_snapshot, new_plans_both_bump, "https://vercel.com/pricing"
    )
    assert is_failure_b is False
    assert len(signals_b) == 1
    assert "Pricing Change: Vercel Pro plan changed" in signals_b[0]["title"]


def test_structural_plan_add_and_remove():
    old_snapshot = {
        "company": "Netlify",
        "url": "https://www.netlify.com/pricing/",
        "plans": [
            {"plan_name": "Free", "price_monthly": "$0", "price_annual": "$0", "billing_period": "forever", "currency": "USD"},
            {"plan_name": "Personal", "price_monthly": "$9", "price_annual": "$9", "billing_period": "monthly", "currency": "USD"},
            {"plan_name": "Legacy Pro", "price_monthly": "$19", "price_annual": "$19", "billing_period": "monthly", "currency": "USD"},
        ],
    }
    
    # Discontinued 'Legacy Pro', added 'Pro Max' at $35
    new_plans = [
        {"plan_name": "Free", "price_monthly": "$0", "price_annual": "$0", "billing_period": "forever", "currency": "USD"},
        {"plan_name": "Personal", "price_monthly": "$9", "price_annual": "$9", "billing_period": "monthly", "currency": "USD"},
        {"plan_name": "Pro Max", "price_monthly": "$35", "price_annual": "$35", "billing_period": "monthly", "currency": "USD"},
    ]
    
    signals, is_failure = pricing_extractor.diff_pricing_snapshots(
        "Netlify", old_snapshot, new_plans, "https://www.netlify.com/pricing/"
    )
    
    assert is_failure is False
    assert len(signals) == 2
    
    titles = [s["title"] for s in signals]
    assert any("removed Legacy Pro plan" in t for t in titles)
    assert any("introduced Pro Max plan at $35" in t for t in titles)


def test_extraction_failure_guardrail_suppresses_false_alerts():
    old_snapshot = {
        "company": "Cloudflare Pages/Workers",
        "url": "https://www.cloudflare.com/plans/",
        "plans": [
            {"plan_name": "Free", "price_monthly": "$0", "price_annual": "$0", "billing_period": "monthly", "currency": "USD"},
            {"plan_name": "Pro", "price_monthly": "$25", "price_annual": "$20", "billing_period": "monthly/annual", "currency": "USD"},
            {"plan_name": "Business", "price_monthly": "$250", "price_annual": "$200", "billing_period": "monthly/annual", "currency": "USD"},
            {"plan_name": "Enterprise", "price_monthly": None, "price_annual": None, "billing_period": "custom", "currency": None},
        ],
    }
    
    # Broken page returning empty list of plans
    new_plans = []
    
    signals, is_failure = pricing_extractor.diff_pricing_snapshots(
        "Cloudflare Pages/Workers", old_snapshot, new_plans, "https://www.cloudflare.com/plans/"
    )
    
    # Must flag extraction failure and emit ZERO signals
    assert is_failure is True
    assert signals == []
