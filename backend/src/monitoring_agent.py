import logging
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import requests

from src import config

logger = logging.getLogger(__name__)

# Company to GitHub Org / Search query mapping
GITHUB_ORG_MAPPING: Dict[str, str] = {
    "Vercel": "vercel",
    "Netlify": "netlify",
    "Cloudflare Pages": "cloudflare",
    "Cloudflare Workers": "cloudflare",
}


# Cloudflare sub-products that share the same parent brand in search results
CLOUDFLARE_SUBPRODUCTS: Dict[str, str] = {
    "Cloudflare Pages": "pages",
    "Cloudflare Workers": "workers",
}


def _check_cloudflare_attribution(signal: Dict[str, Any], queried_company: str) -> Optional[Dict[str, Any]]:
    """
    For Cloudflare sub-products, verify that a news signal actually mentions
    the specific sub-product it was fetched under. If it mentions the OTHER
    Cloudflare sub-product but NOT the queried one, re-attribute it.
    If it mentions neither specifically, keep it under the queried company.
    Returns the signal (possibly with corrected company) or None if it should
    be dropped (not currently used — we always keep or re-attribute).
    """
    if queried_company not in CLOUDFLARE_SUBPRODUCTS:
        return signal  # Not a Cloudflare sub-product query; no filtering needed

    queried_keyword = CLOUDFLARE_SUBPRODUCTS[queried_company]
    text = (signal.get("title", "") + " " + signal.get("raw_excerpt", "")).lower()

    mentions_queried = queried_keyword in text

    # Check if it mentions any OTHER Cloudflare sub-product
    other_product = None
    for product_name, keyword in CLOUDFLARE_SUBPRODUCTS.items():
        if product_name != queried_company and keyword in text:
            other_product = product_name
            break

    if mentions_queried:
        # Signal does mention the queried product — keep it as-is
        return signal
    elif other_product:
        # Signal mentions a DIFFERENT Cloudflare sub-product but NOT the queried one
        # Re-attribute to the correct sub-product
        corrected = dict(signal)
        corrected["company"] = other_product
        return corrected
    else:
        # Signal mentions neither specifically (just "Cloudflare" generically)
        # Keep it under the queried company — generic Cloudflare news is relevant to both
        return signal


def _fetch_news_from_currents(company: str, days: int = 7) -> List[Dict[str, Any]]:
    """Fetch recent news articles related to the company from Currents API."""
    api_key = os.getenv("CURRENTS_API_KEY")
    if not api_key:
        logger.warning("CURRENTS_API_KEY not set. Skipping Currents news fetch.")
        return []

    url = "https://api.currentsapi.services/v1/search"
    params = {
        "keywords": company,
        "language": "en",
        "apiKey": api_key.strip(),
    }

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        articles = data.get("news", [])
        
        signals: List[Dict[str, Any]] = []
        for article in articles:
            published_str = article.get("published", "")
            if published_str:
                try:
                    pub_clean = published_str.replace(" +0000", "+00:00").replace(" ", "T")
                    pub_dt = datetime.fromisoformat(pub_clean)
                    if pub_dt < cutoff_date:
                        continue
                except Exception:
                    pass

            raw_signal = {
                "source": "news",
                "company": company,
                "title": article.get("title", ""),
                "url": article.get("url", ""),
                "published_at": published_str,
                "raw_excerpt": article.get("description", "") or article.get("title", ""),
            }

            # Apply Cloudflare sub-product attribution check
            checked = _check_cloudflare_attribution(raw_signal, company)
            if checked is not None:
                signals.append(checked)

        return signals
    except Exception as e:
        logger.error(f"Error fetching news for {company} from Currents API: {e}")
        return []


def _fetch_github_events(company: str, days: int = 7) -> List[Dict[str, Any]]:
    """Fetch recent public repository events or releases from GitHub REST API."""
    token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token.strip()}"

    org = GITHUB_ORG_MAPPING.get(company, company.lower().replace(" ", "-"))
    url = f"https://api.github.com/orgs/{org}/events"
    params = {"per_page": 30}

    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        events = response.json()
        if not isinstance(events, list):
            return []

        signals: List[Dict[str, Any]] = []
        for event in events:
            created_at_str = event.get("created_at", "")
            if created_at_str:
                try:
                    event_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
                    if event_dt < cutoff_date:
                        continue
                except ValueError:
                    pass

            event_type = event.get("type", "Event")
            repo_name = event.get("repo", {}).get("name", org)
            
            payload = event.get("payload", {})
            action = payload.get("action", "")
            description = ""
            if event_type == "ReleaseEvent":
                release_info = payload.get("release", {})
                title = f"GitHub Release in {repo_name}: {release_info.get('name') or release_info.get('tag_name', 'Release')}"
                description = release_info.get("body", "") or release_info.get("name", "")
            elif event_type == "PushEvent":
                commits = payload.get("commits", [])
                commit_msgs = "; ".join(c.get("message", "") for c in commits[:3])
                title = f"GitHub Push to {repo_name}"
                description = f"{len(commits)} commits: {commit_msgs}"
            elif event_type == "CreateEvent":
                ref_type = payload.get("ref_type", "branch/tag")
                ref = payload.get("ref", "")
                title = f"GitHub Created {ref_type} {ref} in {repo_name}"
                description = payload.get("description", "") or f"Created {ref_type} {ref}"
            elif event_type == "IssuesEvent":
                issue = payload.get("issue", {})
                title = f"GitHub Issue {action} in {repo_name}: {issue.get('title', '')}"
                description = issue.get("body", "")[:300] if issue.get("body") else title
            else:
                title = f"GitHub {event_type} {action} in {repo_name}".strip()
                description = f"Activity on repository {repo_name} by {event.get('actor', {}).get('login', 'user')}"

            event_url = f"https://github.com/{repo_name}"

            signals.append({
                "source": "github",
                "company": company,
                "title": title,
                "url": event_url,
                "published_at": created_at_str,
                "raw_excerpt": description[:500] if description else title,
            })
        return signals
    except Exception as e:
        logger.error(f"Error fetching GitHub events for {company} ({org}): {e}")
        return []


def consolidate_signals(signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Consolidate raw signals:
    1. Deduplicate exact duplicates (identical source, company, url, title).
    2. Aggregate repetitive low-information GitHub event types (WatchEvent, ForkEvent)
       on the same repo into a single summary signal with an accurate count.
    3. Retain other GitHub event types (Issues, PRs, PR Reviews, Pushes, etc.) individually.
    """
    consolidated: List[Dict[str, Any]] = []
    seen_exact = set()

    # Track watch events: (company, url) -> list of signals
    watch_events_by_repo: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
    # Track fork events: (company, url) -> list of signals
    fork_events_by_repo: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}

    for s in signals:
        source = s.get("source", "")
        company = s.get("company", "")
        url = s.get("url", "")
        title = s.get("title", "")
        title_lower = title.lower()

        # Check for WatchEvent
        if source == "github" and ("watchevent" in title_lower or "started watching" in title_lower):
            key = (company, url)
            if key not in watch_events_by_repo:
                watch_events_by_repo[key] = []
            watch_events_by_repo[key].append(s)
            continue

        # Check for ForkEvent
        if source == "github" and ("forkevent" in title_lower or "forked in" in title_lower):
            key = (company, url)
            if key not in fork_events_by_repo:
                fork_events_by_repo[key] = []
            fork_events_by_repo[key].append(s)
            continue

        # Exact deduplication for all other signals
        exact_key = (source, company, url, title)
        if exact_key in seen_exact:
            continue
        seen_exact.add(exact_key)
        consolidated.append(s)

    # Aggregate WatchEvents
    for (company, url), event_list in watch_events_by_repo.items():
        count = len(event_list)
        repo_name = url.replace("https://github.com/", "")
        latest_date = max((e.get("published_at", "") for e in event_list), default="")
        plural = "users" if count != 1 else "user"
        consolidated.append({
            "source": "github",
            "company": company,
            "title": f"{count} {plural} started watching {repo_name} this week",
            "url": url,
            "published_at": latest_date,
            "raw_excerpt": f"{count} developer(s) starred/watched repository {repo_name} on GitHub in the last 7 days.",
        })

    # Aggregate ForkEvents
    for (company, url), event_list in fork_events_by_repo.items():
        count = len(event_list)
        repo_name = url.replace("https://github.com/", "")
        latest_date = max((e.get("published_at", "") for e in event_list), default="")
        plural = "users" if count != 1 else "user"
        consolidated.append({
            "source": "github",
            "company": company,
            "title": f"{count} {plural} forked {repo_name} this week",
            "url": url,
            "published_at": latest_date,
            "raw_excerpt": f"{count} new fork(s) created for repository {repo_name} on GitHub in the last 7 days.",
        })

    return consolidated


def run(companies: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Query both news and GitHub sources for each target and competitor company.
    Normalizes all outputs and applies signal deduplication/aggregation.
    """
    if companies is None:
        all_companies: List[str] = []
        for c in [config.TARGET_COMPANY] + config.COMPETITORS:
            if c not in all_companies:
                all_companies.append(c)
        companies = all_companies

    all_signals: List[Dict[str, Any]] = []

    for company in companies:
        if "news" in config.SOURCES:
            news_signals = _fetch_news_from_currents(company)
            all_signals.extend(news_signals)
        
        if "github" in config.SOURCES:
            github_signals = _fetch_github_events(company)
            all_signals.extend(github_signals)

    return consolidate_signals(all_signals)
