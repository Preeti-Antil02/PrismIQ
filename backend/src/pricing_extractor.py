"""
Pricing page signal source for PrismIQ.

Extracts structured pricing plans from tracked competitors (Vercel, Netlify, Cloudflare),
persists timestamped snapshots, diffs against prior baselines, and emits structured
raw signals on price or structural plan changes.

Schema captures both monthly-billed and annual-billed prices explicitly to eliminate
toggle-state rendering ambiguities.
"""

import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

PRICING_URLS = {
    "Vercel": "https://vercel.com/pricing",
    "Netlify": "https://www.netlify.com/pricing/",
    "Cloudflare Pages/Workers": "https://www.cloudflare.com/plans/",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _get_company_slug(company: str) -> str:
    """Normalize company name to a safe filename slug."""
    slug = company.lower()
    slug = re.sub(r"[^a-z0-9]+", "_", slug).strip("_")
    return slug


# ---------------------------------------------------------------------------
# 1. Structured Extractors per Company (Dual Cadence & Standardized Custom)
# ---------------------------------------------------------------------------


def extract_vercel_pricing(html: str) -> List[Dict[str, Any]]:
    """Extract structured pricing plans from Vercel's pricing page."""
    soup = BeautifulSoup(html, "html.parser")
    plans: List[Dict[str, Any]] = []

    pricing_grid = None
    for section in soup.find_all(["div", "section"]):
        txt = section.get_text(separator=" ", strip=True)
        if "Hobby" in txt and "Pro" in txt and "Enterprise" in txt and "$0" in txt and "$20" in txt and len(txt) < 4000:
            pricing_grid = section
            break

    if not pricing_grid:
        pricing_grid = soup

    plan_configs = [
        ("Hobby", "$0", "$0", "monthly", "USD", False),
        ("Pro", "$20", "$20", "monthly", "USD", False),
        ("Enterprise", None, None, "custom", None, True),
    ]

    for plan_name, default_monthly, default_annual, default_period, default_curr, is_custom in plan_configs:
        matches = pricing_grid.find_all(
            lambda t: t.name in ["h2", "h3", "h4", "div", "span", "p"] and t.get_text(strip=True) == plan_name
        )
        target_card = None
        for m in matches:
            card = m
            for _ in range(5):
                if card:
                    ctxt = card.get_text(separator=" ", strip=True)
                    if (
                        (plan_name == "Hobby" and "$0" in ctxt and ("starting" in ctxt.lower() or "deploy" in ctxt.lower()))
                        or (plan_name == "Pro" and "$20" in ctxt and ("everything" in ctxt.lower() or "popular" in ctxt.lower()))
                        or (plan_name == "Enterprise" and ("custom" in ctxt.lower() or "critical" in ctxt.lower() or "sla" in ctxt.lower()))
                    ):
                        target_card = card
                        break
                    card = card.parent
            if target_card:
                break

        if not target_card:
            continue

        strings = list(target_card.stripped_strings)

        features: List[str] = []
        for li in target_card.find_all("li"):
            ft = li.get_text(strip=True)
            if ft and len(ft) < 120 and ft not in features:
                features.append(ft)
        if not features:
            for s in strings:
                if len(s) > 15 and len(s) < 120 and not s.startswith("$") and s != plan_name and s not in features:
                    features.append(s)

        if is_custom:
            plans.append({
                "plan_name": plan_name,
                "price_monthly": None,
                "price_annual": None,
                "billing_period": "custom",
                "currency": None,
                "is_custom": True,
                "features": features[:6],
            })
        else:
            # Parse price if visible in card
            price_val = default_monthly
            for s in strings:
                if s.startswith("$") and any(c.isdigit() for c in s):
                    price_val = s
                    break

            plans.append({
                "plan_name": plan_name,
                "price_monthly": price_val,
                "price_annual": price_val,
                "billing_period": default_period,
                "currency": default_curr,
                "is_custom": False,
                "features": features[:6],
            })

    return plans


def extract_netlify_pricing(html: str) -> List[Dict[str, Any]]:
    """Extract structured pricing plans from Netlify's pricing page."""
    soup = BeautifulSoup(html, "html.parser")
    plans: List[Dict[str, Any]] = []

    plan_configs = [
        ("Free", "$0", "$0", "forever", "USD", False),
        ("Personal", "$9", "$9", "monthly", "USD", False),
        ("Pro", "$20", "$20", "monthly", "USD", False),
        ("Enterprise", None, None, "custom", None, True),
    ]

    for plan_name, default_monthly, default_annual, default_period, default_curr, is_custom in plan_configs:
        matches = soup.find_all(
            lambda t: t.name in ["h2", "h3", "h4", "div", "span", "p"] and t.get_text(strip=True) == plan_name
        )
        target_card = None
        for m in matches:
            card = m
            for _ in range(4):
                if card:
                    ctxt = card.get_text(separator=" ", strip=True)
                    if (
                        (plan_name == "Free" and "$0" in ctxt and ("forever" in ctxt.lower() or "deploy" in ctxt.lower()))
                        or (plan_name == "Personal" and "$9" in ctxt and ("month" in ctxt.lower() or "traffic" in ctxt.lower()))
                        or (plan_name == "Pro" and "$20" in ctxt and ("team" in ctxt.lower() or "month" in ctxt.lower() or "unlimited" in ctxt.lower()))
                        or (plan_name == "Enterprise" and ("custom" in ctxt.lower() or "scale" in ctxt.lower() or "sla" in ctxt.lower()))
                    ):
                        target_card = card
                        break
                    card = card.parent
            if target_card:
                break

        if not target_card:
            continue

        strings = list(target_card.stripped_strings)

        features: List[str] = []
        for li in target_card.find_all("li"):
            ft = li.get_text(strip=True)
            if ft and len(ft) < 120 and ft not in features:
                features.append(ft)
        if not features:
            for s in strings:
                if len(s) > 15 and len(s) < 120 and not s.startswith("$") and s != plan_name and s not in features:
                    features.append(s)

        if is_custom:
            plans.append({
                "plan_name": plan_name,
                "price_monthly": None,
                "price_annual": None,
                "billing_period": "custom",
                "currency": None,
                "is_custom": True,
                "features": features[:6],
            })
        else:
            price_val = default_monthly
            for s in strings:
                if s.startswith("$") and any(c.isdigit() for c in s):
                    price_val = s
                    break

            plans.append({
                "plan_name": plan_name,
                "price_monthly": price_val,
                "price_annual": price_val,
                "billing_period": default_period,
                "currency": default_curr,
                "is_custom": False,
                "features": features[:6],
            })

    return plans


def extract_cloudflare_pricing(html: str) -> List[Dict[str, Any]]:
    """Extract structured pricing plans from Cloudflare's plans page."""
    soup = BeautifulSoup(html, "html.parser")
    plans: List[Dict[str, Any]] = []

    plan_configs = [
        ("Free", ["Free"], "$0", "$0", "monthly", "USD", False),
        ("Pro", ["Pro"], "$25", "$20", "monthly/annual", "USD", False),
        ("Business", ["Business"], "$250", "$200", "monthly/annual", "USD", False),
        ("Enterprise", ["Enterprise", "Contract"], None, None, "custom", None, True),
    ]

    for plan_name, target_headers, default_monthly, default_annual, default_period, default_curr, is_custom in plan_configs:
        target_card = None
        for th in target_headers:
            matches = soup.find_all(
                lambda t: t.name in ["h2", "h3", "h4", "div", "span", "p"] and t.get_text(strip=True) == th
            )
            for m in matches:
                card = m
                for _ in range(5):
                    if card:
                        ctxt = card.get_text(separator=" ", strip=True)
                        if (
                            (plan_name == "Free" and "$0" in ctxt and ("personal" in ctxt.lower() or "hobby" in ctxt.lower()))
                            or (plan_name == "Pro" and "$20" in ctxt and ("professional" in ctxt.lower() or "websites" in ctxt.lower()))
                            or (plan_name == "Business" and "$200" in ctxt and ("small business" in ctxt.lower() or "operating" in ctxt.lower()))
                            or (plan_name == "Enterprise" and ("contract" in ctxt.lower() or "custom" in ctxt.lower() or "mission-critical" in ctxt.lower() or "security" in ctxt.lower()))
                        ):
                            target_card = card
                            break
                        card = card.parent
                if target_card:
                    break
            if target_card:
                break

        if not target_card:
            continue

        strings = list(target_card.stripped_strings)

        features: List[str] = []
        for li in target_card.find_all("li"):
            ft = li.get_text(strip=True)
            if ft and len(ft) < 120 and ft not in features:
                features.append(ft)
        if not features:
            for s in strings:
                if len(s) > 15 and len(s) < 140 and not s.startswith("$") and s not in [plan_name, "Contract", "Get started", "See packages"] and s not in features:
                    features.append(s)

        if is_custom:
            plans.append({
                "plan_name": plan_name,
                "price_monthly": None,
                "price_annual": None,
                "billing_period": "custom",
                "currency": None,
                "is_custom": True,
                "features": features[:6],
            })
        else:
            # Check for explicitly listed monthly and annual numbers in text
            # E.g. "$20 /mo billed annually, or $25/mo billed monthly"
            card_text = " ".join(strings)
            m_monthly = re.search(r"\$(\d+)\s*/?\s*mo\s+billed\s+monthly", card_text, re.I)
            m_annual = re.search(r"\$(\d+)\s*/?\s*mo\s+billed\s+annually", card_text, re.I)

            price_m = f"${m_monthly.group(1)}" if m_monthly else default_monthly
            price_a = f"${m_annual.group(1)}" if m_annual else default_annual

            plans.append({
                "plan_name": plan_name,
                "price_monthly": price_m,
                "price_annual": price_a,
                "billing_period": default_period,
                "currency": default_curr,
                "is_custom": False,
                "features": features[:6],
            })

    return plans


def extract_pricing_for_company(company: str, html: str) -> List[Dict[str, Any]]:
    """Route company to appropriate structured extractor."""
    comp_lower = company.lower()
    if "vercel" in comp_lower:
        return extract_vercel_pricing(html)
    elif "netlify" in comp_lower:
        return extract_netlify_pricing(html)
    elif "cloudflare" in comp_lower:
        return extract_cloudflare_pricing(html)
    else:
        logger.warning(f"No dedicated pricing extractor found for company '{company}'")
        return []


# ---------------------------------------------------------------------------
# 2. Snapshot Persistence & Diff Engine
# ---------------------------------------------------------------------------


def get_latest_pricing_snapshot(company: str, data_dir: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    """Load the most recent pricing snapshot for a company from disk."""
    if data_dir is None:
        data_dir = DATA_DIR

    slug = _get_company_slug(company)
    latest_file = data_dir / f"pricing_latest_{slug}.json"
    if not latest_file.exists():
        return None

    try:
        with open(latest_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error reading latest pricing snapshot for {company}: {e}")
        return None


def save_pricing_snapshot(
    company: str,
    plans: List[Dict[str, Any]],
    url: str,
    data_dir: Optional[Path] = None,
    timestamp: Optional[str] = None,
) -> Path:
    """Persist a timestamped pricing snapshot (dual-writing to PostgreSQL and flat JSON)."""
    from src import storage
    return storage.save_pricing_snapshot(
        company=company,
        plans=plans,
        url=url,
        data_dir=data_dir,
        timestamp=timestamp,
    )


def diff_pricing_snapshots(
    company: str,
    old_snapshot: Optional[Dict[str, Any]],
    new_plans: List[Dict[str, Any]],
    url: str,
) -> Tuple[List[Dict[str, Any]], bool]:
    """
    Diff new extracted plans against baseline snapshot.
    Diffs monthly and annual pricing independently to eliminate toggle rendering false positives.
    
    Returns:
        (signals_list, is_extraction_failure)
    """
    # 1. First run / No baseline check
    if not old_snapshot or not old_snapshot.get("plans"):
        logger.info(f"Establishing initial pricing baseline for {company} with {len(new_plans)} plans.")
        return [], False

    old_plans: List[Dict[str, Any]] = old_snapshot.get("plans", [])

    # 2. Extraction Failure Self-Check Guardrail
    if len(old_plans) >= 2 and len(new_plans) == 0:
        logger.warning(
            f"Extraction failure detected for {company}: extracted 0 plans vs {len(old_plans)} in baseline. "
            "Flagging as extraction breakdown needing human review; suppressing signals."
        )
        return [], True

    if len(old_plans) >= 3 and len(new_plans) < (len(old_plans) / 2):
        logger.warning(
            f"Extraction failure detected for {company}: extracted {len(new_plans)} plans vs {len(old_plans)} baseline. "
            "Suppressing signals."
        )
        return [], True

    # 3. Plan-by-Plan Diffing
    signals: List[Dict[str, Any]] = []
    old_by_name = {p["plan_name"].lower(): p for p in old_plans}
    new_by_name = {p["plan_name"].lower(): p for p in new_plans}

    for name_lower, old_p in old_by_name.items():
        plan_name = old_p["plan_name"]
        if name_lower in new_by_name:
            new_p = new_by_name[name_lower]

            # Handle backward compatibility for legacy snapshots with single "price" field
            old_m = old_p.get("price_monthly") or old_p.get("price")
            new_m = new_p.get("price_monthly") or new_p.get("price")
            old_a = old_p.get("price_annual") or old_p.get("price")
            new_a = new_p.get("price_annual") or new_p.get("price")

            # Check Price Changes
            monthly_changed = (old_m != new_m)
            annual_changed = (old_a != new_a)

            if monthly_changed and annual_changed:
                title = f"Pricing Change: {company} {plan_name} plan changed (Monthly: {old_m}->{new_m}, Annual: {old_a}->{new_a})"
                raw_excerpt = (
                    f"{company} updated its {plan_name} plan pricing on {url}. "
                    f"Monthly price: {old_m} -> {new_m}; Annual price: {old_a} -> {new_a}."
                )
                signals.append({
                    "source": "pricing",
                    "company": company,
                    "title": title,
                    "url": url,
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "raw_excerpt": raw_excerpt,
                })
            elif monthly_changed:
                title = f"Pricing Change (Monthly): {company} {plan_name} monthly price changed from {old_m} to {new_m}"
                raw_excerpt = (
                    f"{company} updated its {plan_name} monthly pricing on {url} from {old_m} to {new_m}."
                )
                signals.append({
                    "source": "pricing",
                    "company": company,
                    "title": title,
                    "url": url,
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "raw_excerpt": raw_excerpt,
                })
            elif annual_changed:
                title = f"Pricing Change (Annual): {company} {plan_name} annual price changed from {old_a} to {new_a}"
                raw_excerpt = (
                    f"{company} updated its {plan_name} annual pricing on {url} from {old_a} to {new_a}."
                )
                signals.append({
                    "source": "pricing",
                    "company": company,
                    "title": title,
                    "url": url,
                    "published_at": datetime.now(timezone.utc).isoformat(),
                    "raw_excerpt": raw_excerpt,
                })
        else:
            # Plan Discontinued / Removed
            old_price = old_p.get("price_monthly") or old_p.get("price") or "Custom"
            title = f"Pricing Plan Discontinued: {company} removed {plan_name} plan (previously {old_price})"
            raw_excerpt = (
                f"{company} removed the {plan_name} plan (previously listed at {old_price}) "
                f"from its public pricing page on {url}."
            )
            signals.append({
                "source": "pricing",
                "company": company,
                "title": title,
                "url": url,
                "published_at": datetime.now(timezone.utc).isoformat(),
                "raw_excerpt": raw_excerpt,
            })

    # Check for Newly Introduced Plans
    for name_lower, new_p in new_by_name.items():
        if name_lower not in old_by_name:
            plan_name = new_p["plan_name"]
            price_m = new_p.get("price_monthly") or "Custom"
            price_a = new_p.get("price_annual") or "Custom"
            display_price = price_m if price_m == price_a else f"{price_m}/mo (or {price_a}/mo annual)"
            title = f"New Pricing Plan: {company} introduced {plan_name} plan at {display_price}"
            raw_excerpt = (
                f"{company} added a new {plan_name} plan at {display_price} "
                f"on its public pricing page {url}."
            )
            signals.append({
                "source": "pricing",
                "company": company,
                "title": title,
                "url": url,
                "published_at": datetime.now(timezone.utc).isoformat(),
                "raw_excerpt": raw_excerpt,
            })

    return signals, False


# ---------------------------------------------------------------------------
# 3. Main Fetch and Diff Orchestrator
# ---------------------------------------------------------------------------


def fetch_pricing_signals(companies: Optional[List[str]] = None, data_dir: Optional[Path] = None) -> List[Dict[str, Any]]:
    """
    Fetch live pricing pages for specified companies, diff against snapshots,
    update snapshot storage, and return newly detected pricing signals.
    """
    if companies is None:
        from . import config
        companies = config.COMPETITORS + [config.TARGET_COMPANY]

    if data_dir is None:
        data_dir = DATA_DIR

    all_signals: List[Dict[str, Any]] = []

    for company in companies:
        url = PRICING_URLS.get(company)
        if not url:
            for k, u in PRICING_URLS.items():
                if k.lower() in company.lower() or company.lower() in k.lower():
                    url = u
                    break

        if not url:
            logger.info(f"No configured pricing URL for '{company}', skipping pricing monitor.")
            continue

        try:
            logger.info(f"Fetching pricing page for {company}: {url}")
            response = requests.get(url, headers=HEADERS, timeout=12)
            if response.status_code != 200:
                logger.warning(f"HTTP {response.status_code} fetching pricing page for {company} ({url})")
                continue

            html = response.text
            new_plans = extract_pricing_for_company(company, html)

            old_snapshot = get_latest_pricing_snapshot(company, data_dir=data_dir)
            signals, is_failure = diff_pricing_snapshots(company, old_snapshot, new_plans, url)

            if is_failure:
                logger.warning(f"Preserving existing baseline for {company} due to extraction failure.")
            else:
                if new_plans:
                    save_pricing_snapshot(company, new_plans, url, data_dir=data_dir)
                all_signals.extend(signals)

        except Exception as e:
            logger.error(f"Error executing pricing monitor for {company} ({url}): {e}")

    return all_signals


def check_pricing_freshness(
    companies: Optional[List[str]] = None,
    threshold_hours: float = 24.0,
    data_dir: Optional[Path] = None,
) -> Tuple[bool, str, Dict[str, float]]:
    """
    Check if pricing snapshots for all specified companies are fresh (< threshold_hours old).
    Returns:
        (is_fresh, reason, ages_dict)
    """
    if companies is None:
        from . import config
        companies = config.COMPETITORS + [config.TARGET_COMPANY]

    now = datetime.now(timezone.utc)
    ages: Dict[str, float] = {}
    stale_or_missing: List[str] = []

    for comp in companies:
        snap = get_latest_pricing_snapshot(comp, data_dir=data_dir)
        if not snap:
            stale_or_missing.append(f"{comp} (no prior snapshot)")
            continue

        fetched_at_str = snap.get("fetched_at")
        dt = None
        if fetched_at_str:
            try:
                dt = datetime.fromisoformat(fetched_at_str.replace("Z", "+00:00"))
            except Exception:
                pass

        if dt is None:
            ts_str = snap.get("timestamp", "")
            try:
                dt = datetime.strptime(ts_str, "%Y%m%d_%H%M%S").replace(tzinfo=timezone.utc)
            except Exception:
                stale_or_missing.append(f"{comp} (unparseable timestamp)")
                continue

        age_hours = (now - dt).total_seconds() / 3600.0
        ages[comp] = round(age_hours, 2)
        if age_hours >= threshold_hours:
            stale_or_missing.append(f"{comp} (age: {age_hours:.1f}h >= {threshold_hours:.1f}h)")

    if not stale_or_missing and ages:
        max_age = max(ages.values())
        min_age = min(ages.values())
        return True, f"All pricing snapshots fresh (last scraped {min_age:.1f}h - {max_age:.1f}h ago; threshold: {threshold_hours:.1f}h)", ages
    else:
        missing_str = ", ".join(stale_or_missing) if stale_or_missing else "no snapshots found"
        return False, f"Pricing refresh needed for: {missing_str}", ages
