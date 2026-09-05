import logging
import os
import re
import urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Set, Tuple, Union
import requests

from . import config
from . import pricing_extractor
from . import funding_classifier
from . import research_classifier

logger = logging.getLogger(__name__)

# Company to GitHub Org / Search query mapping
GITHUB_ORG_MAPPING: Dict[str, str] = {
    "Vercel": "vercel",
    "Netlify": "netlify",
    "Cloudflare Pages/Workers": "cloudflare",
    "Cloudflare": "cloudflare",
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
    For Cloudflare sub-products (if queried as separate entities), verify attribution.
    When queried under unified 'Cloudflare Pages/Workers', preserves unified attribution.
    """
    if queried_company not in CLOUDFLARE_SUBPRODUCTS:
        return signal  # Not a separate sub-product query; no attribution splitting needed

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
        return signal
    elif other_product:
        corrected = dict(signal)
        corrected["company"] = other_product
        return corrected
    else:
        return signal


def _fetch_news_from_currents(company: str, days: int = 7) -> List[Dict[str, Any]]:
    """Fetch recent news articles related to the company from Currents API."""
    api_key = os.getenv("CURRENTS_API_KEY")
    if not api_key:
        logger.warning("CURRENTS_API_KEY not set. Skipping Currents news fetch.")
        return []

    # If querying unified Cloudflare Pages/Workers, run targeted searches for both subproducts
    # to avoid Currents API 20-result per-query limit truncation and generic news displacement
    if company == "Cloudflare Pages/Workers":
        search_keywords = ["Cloudflare Pages", "Cloudflare Workers"]
    else:
        search_keywords = [company]

    url = "https://api.currentsapi.services/v1/search"
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    seen_urls: set[str] = set()
    signals: List[Dict[str, Any]] = []

    for kw in search_keywords:
        params = {
            "keywords": kw,
            "language": "en",
            "apiKey": api_key.strip(),
        }
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            articles = data.get("news", [])

            for article in articles:
                article_url = article.get("url", "")
                if not article_url or article_url in seen_urls:
                    continue

                published_str = article.get("published", "")
                if published_str:
                    try:
                        pub_clean = published_str.replace(" +0000", "+00:00").replace(" ", "T")
                        pub_dt = datetime.fromisoformat(pub_clean)
                        if pub_dt < cutoff_date:
                            continue
                    except Exception:
                        pass

                seen_urls.add(article_url)
                raw_signal = {
                    "source": "news",
                    "company": company,
                    "title": article.get("title", ""),
                    "url": article_url,
                    "published_at": published_str,
                    "raw_excerpt": article.get("description", "") or article.get("title", ""),
                }
                raw_signal = funding_classifier.classify_signal(raw_signal)

                # Apply sub-product attribution check if running on legacy separate entities
                checked = _check_cloudflare_attribution(raw_signal, company)
                if checked is not None:
                    signals.append(checked)

        except Exception as e:
            logger.error(f"Error fetching news for {kw} from Currents API: {e}")
            raise

    return signals


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
        raise


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


# ATS Platform Configuration Mapping
# Maps company names to (ATS platform type, board slug)
# Supported ATS platforms: "greenhouse", "lever", "ashby"
ATS_COMPANY_MAPPING: Dict[str, Tuple[str, str]] = {
    "Vercel": ("greenhouse", "vercel"),
    "Netlify": ("greenhouse", "netlify"),
    "Cloudflare Pages/Workers": ("greenhouse", "cloudflare"),
    "Cloudflare": ("greenhouse", "cloudflare"),
    "Cloudflare Pages": ("greenhouse", "cloudflare"),
    "Cloudflare Workers": ("greenhouse", "cloudflare"),
    "Stripe": ("greenhouse", "stripe"),
    "Datadog": ("greenhouse", "datadog"),
    "Supabase": ("ashby", "supabase"),
    "Sentry": ("ashby", "sentry"),
}


def _detect_ats_platform(company: str) -> Optional[Tuple[str, str]]:
    """
    Detect which public ATS platform a company uses.
    Checks known mapping first, then probes public structured APIs (Greenhouse, Ashby, Lever).
    Never scrapes bespoke careers websites.
    """
    if company in ATS_COMPANY_MAPPING:
        return ATS_COMPANY_MAPPING[company]

    slug = re.sub(r"[^a-zA-Z0-9_-]+", "", company.lower().split()[0])
    if not slug:
        return None

    # 1. Probe Greenhouse
    try:
        gh_url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"
        r = requests.get(gh_url, timeout=4)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data.get("jobs"), list) and len(data["jobs"]) > 0:
                return ("greenhouse", slug)
    except Exception:
        pass

    # 2. Probe Ashby
    try:
        ashby_url = f"https://api.ashbyhq.com/posting-api/job-board/{slug}"
        r = requests.get(ashby_url, timeout=4)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data.get("jobs"), list) and len(data["jobs"]) > 0:
                return ("ashby", slug)
    except Exception:
        pass

    # 3. Probe Lever
    try:
        lever_url = f"https://api.lever.co/v0/postings/{slug}?mode=json"
        r = requests.get(lever_url, timeout=4)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list) and len(data) > 0:
                return ("lever", slug)
    except Exception:
        pass

    return None


def _fetch_greenhouse_jobs(board_slug: str, company: str, days: int = 7) -> List[Dict[str, Any]]:
    """Fetch structured job postings from Greenhouse public boards API."""
    url = f"https://boards-api.greenhouse.io/v1/boards/{board_slug}/jobs?content=true"
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            logger.warning(f"Greenhouse API returned status {response.status_code} for board '{board_slug}'")
            return []

        data = response.json()
        jobs = data.get("jobs", [])
        if not isinstance(jobs, list):
            return []

        signals: List[Dict[str, Any]] = []
        for job in jobs:
            # Greenhouse provides `first_published` for when the job was originally posted to the public board.
            # `updated_at` is frequently bumped by administrative re-syncs, bulk edits, or metadata changes.
            posted_date_str = job.get("first_published") or job.get("updated_at") or ""
            if posted_date_str:
                try:
                    dt = datetime.fromisoformat(posted_date_str)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt < cutoff_date:
                        continue
                except Exception:
                    pass

            job_title = job.get("title", "Untitled Role").strip()
            job_url = job.get("absolute_url") or f"https://boards.greenhouse.io/{board_slug}/jobs/{job.get('id')}"
            
            departments = job.get("departments", [])
            dept_names = ", ".join(d.get("name", "") for d in departments if d.get("name"))
            location = job.get("location", {}).get("name", "Unspecified Location")

            title_display = f"Job Posting: {job_title} ({dept_names})" if dept_names else f"Job Posting: {job_title}"
            raw_excerpt = f"Department: {dept_names or 'General'} | Location: {location} | Role: {job_title}"

            signals.append({
                "source": "jobs",
                "company": company,
                "title": title_display,
                "url": job_url,
                "published_at": posted_date_str,
                "raw_excerpt": raw_excerpt,
            })

        return signals
    except Exception as e:
        logger.error(f"Error fetching Greenhouse jobs for {company} ({board_slug}): {e}")
        return []


def _fetch_lever_jobs(board_slug: str, company: str, days: int = 7) -> List[Dict[str, Any]]:
    """Fetch structured job postings from Lever public postings API."""
    url = f"https://api.lever.co/v0/postings/{board_slug}?mode=json"
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            logger.warning(f"Lever API returned status {response.status_code} for board '{board_slug}'")
            return []

        jobs = response.json()
        if not isinstance(jobs, list):
            return []

        signals: List[Dict[str, Any]] = []
        for job in jobs:
            created_at_ms = job.get("createdAt")
            created_at_str = ""
            if created_at_ms:
                try:
                    dt = datetime.fromtimestamp(created_at_ms / 1000.0, tz=timezone.utc)
                    if dt < cutoff_date:
                        continue
                    created_at_str = dt.isoformat()
                except Exception:
                    pass

            job_title = job.get("text", "Untitled Role").strip()
            job_url = job.get("hostedUrl") or job.get("applyUrl") or f"https://jobs.lever.co/{board_slug}/{job.get('id')}"
            
            categories = job.get("categories", {})
            team = categories.get("team") or categories.get("department") or ""
            location = categories.get("location") or "Unspecified Location"

            title_display = f"Job Posting: {job_title} ({team})" if team else f"Job Posting: {job_title}"
            raw_excerpt = f"Department: {team or 'General'} | Location: {location} | Role: {job_title}"

            signals.append({
                "source": "jobs",
                "company": company,
                "title": title_display,
                "url": job_url,
                "published_at": created_at_str,
                "raw_excerpt": raw_excerpt,
            })

        return signals
    except Exception as e:
        logger.error(f"Error fetching Lever jobs for {company} ({board_slug}): {e}")
        return []


def _fetch_ashby_jobs(board_slug: str, company: str, days: int = 7) -> List[Dict[str, Any]]:
    """Fetch structured job postings from Ashby public job board API."""
    url = f"https://api.ashbyhq.com/posting-api/job-board/{board_slug}"
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            logger.warning(f"Ashby API returned status {response.status_code} for board '{board_slug}'")
            return []

        data = response.json()
        jobs = data.get("jobs", [])
        if not isinstance(jobs, list):
            return []

        signals: List[Dict[str, Any]] = []
        for job in jobs:
            published_at_str = job.get("publishedAt", "")
            if published_at_str:
                try:
                    dt = datetime.fromisoformat(published_at_str.replace("Z", "+00:00"))
                    if dt < cutoff_date:
                        continue
                except Exception:
                    pass

            job_title = job.get("title", "Untitled Role").strip()
            job_url = job.get("jobUrl") or f"https://jobs.ashbyhq.com/{board_slug}/{job.get('id')}"
            
            department = job.get("department", "")
            location = job.get("location", "Unspecified Location")

            title_display = f"Job Posting: {job_title} ({department})" if department else f"Job Posting: {job_title}"
            raw_excerpt = f"Department: {department or 'General'} | Location: {location} | Role: {job_title}"

            signals.append({
                "source": "jobs",
                "company": company,
                "title": title_display,
                "url": job_url,
                "published_at": published_at_str,
                "raw_excerpt": raw_excerpt,
            })

        return signals
    except Exception as e:
        logger.error(f"Error fetching Ashby jobs for {company} ({board_slug}): {e}")
        return []


def _fetch_jobs(company: str, days: int = 7) -> List[Dict[str, Any]]:
    """
    Fetch current structured job postings for a company from its detected public ATS platform.
    If company is not on a supported structured platform, returns [] and logs honest gap (never scrapes).
    """
    ats_info = _detect_ats_platform(company)
    if not ats_info:
        logger.info(f"Job postings source not supported for '{company}' (no public Greenhouse/Lever/Ashby board found; scraping avoided).")
        return []

    ats_type, board_slug = ats_info
    logger.info(f"Fetching job postings for '{company}' via {ats_type} board '{board_slug}'...")

    if ats_type == "greenhouse":
        return _fetch_greenhouse_jobs(board_slug, company, days=days)
    elif ats_type == "lever":
        return _fetch_lever_jobs(board_slug, company, days=days)
    elif ats_type == "ashby":
        return _fetch_ashby_jobs(board_slug, company, days=days)
    else:
        return []


# Company to blog RSS/Atom feed mapping
COMPANY_FEED_URLS: Dict[str, List[str]] = {
    "Vercel": ["https://vercel.com/atom"],
    "Netlify": ["https://www.netlify.com/feed.xml"],
    "Cloudflare Pages/Workers": [
        "https://blog.cloudflare.com/rss/",
        "https://blog.cloudflare.com/tag/research/rss/",
    ],
    "Cloudflare": [
        "https://blog.cloudflare.com/rss/",
        "https://blog.cloudflare.com/tag/research/rss/",
    ],
    "Cloudflare Pages": ["https://blog.cloudflare.com/rss/"],
    "Cloudflare Workers": ["https://blog.cloudflare.com/rss/"],
}


def _fetch_arxiv_papers(company: str, days: int = 30) -> List[Dict[str, Any]]:
    """
    Query the official arXiv API (export.arxiv.org/api/query) for formal papers.
    Strictly verifies author affiliations against confirmed company research affiliations.
    Never accepts third-party papers that merely mention the company name.
    """
    search_term = company.split()[0].replace("/", "")
    encoded_query = urllib.parse.quote(f'all:"{search_term}"')
    url = f"http://export.arxiv.org/api/query?search_query={encoded_query}&max_results=25&sortBy=submittedDate&sortOrder=descending"
    headers = {"User-Agent": "PrismIQ-ResearchMonitor/1.0 (contact@prismiq.internal)"}
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code != 200:
            logger.warning(f"arXiv API returned status {response.status_code} for '{company}'")
            return []

        root = ET.fromstring(response.text)
        ns = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
        entries = root.findall("atom:entry", ns)
        signals: List[Dict[str, Any]] = []

        for entry in entries:
            pub_el = entry.find("atom:published", ns)
            pub_str = pub_el.text.strip() if pub_el is not None else ""
            if pub_str:
                try:
                    dt = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    if dt < cutoff_date:
                        continue
                except Exception:
                    pass

            # Extract authors and affiliations
            authors_display: List[str] = []
            author_affiliations: List[str] = []
            for a in entry.findall("atom:author", ns):
                name_el = a.find("atom:name", ns)
                name = name_el.text.strip() if name_el is not None and name_el.text else "Unknown"
                aff_el = a.find("arxiv:affiliation", ns)
                aff = aff_el.text.strip() if aff_el is not None and aff_el.text else ""
                authors_display.append(name)
                if aff:
                    author_affiliations.append(aff)

            # Strict author affiliation verification
            if not research_classifier.is_verified_arxiv_affiliation(company, author_affiliations):
                continue

            title_el = entry.find("atom:title", ns)
            title = title_el.text.strip().replace("\n", " ") if title_el is not None else "Untitled Paper"
            link_el = entry.find("atom:id", ns)
            link = link_el.text.strip() if link_el is not None else f"https://arxiv.org/abs/{company}"
            summary_el = entry.find("atom:summary", ns)
            summary = summary_el.text.strip().replace("\n", " ") if summary_el is not None else ""

            signals.append({
                "source": "research",
                "source_subtype": "research",
                "company": company,
                "title": f"Research Paper: {title}",
                "url": link,
                "published_at": pub_str,
                "raw_excerpt": f"Authors: {', '.join(authors_display)} (Affiliation: {', '.join(author_affiliations)}) | Abstract: {summary[:400]}",
                "research_details": {
                    "type": "arxiv_paper",
                    "authors": authors_display,
                    "affiliations": author_affiliations,
                },
            })

        return signals
    except Exception as e:
        logger.error(f"Error querying arXiv API for '{company}': {e}")
        return []


def _normalize_canonical_url(url: str) -> str:
    """Normalize article URL for reliable cross-feed and cross-source deduplication."""
    if not url:
        return ""
    clean = url.strip()
    if clean.startswith("http://"):
        clean = "https://" + clean[7:]
    clean = re.sub(r"[?#].*$", "", clean)
    clean = clean.rstrip("/")
    return clean


def _fetch_article_content_fallback(url: str) -> str:
    """
    Lightweight single-page fetch for ambiguous feed entries with truncated/empty summaries (<80 chars).
    Extracts article text or meta description to enable high-precision classification.
    """
    headers = {"User-Agent": "PrismIQ-ResearchMonitor/1.0", "Accept": "text/markdown, text/html"}
    try:
        r = requests.get(url, headers=headers, timeout=5)
        if r.status_code == 200:
            text = r.text
            if "<html" in text.lower():
                m_desc = re.search(r'<meta\s+name=["\']description["\']\s+content=["\']([^"\']+)["\']', text, re.IGNORECASE)
                meta_desc = m_desc.group(1) if m_desc else ""
                m_art = re.search(r'<(?:article|main)[^>]*>(.*?)</(?:article|main)>', text, re.DOTALL | re.IGNORECASE)
                body = m_art.group(1) if m_art else text
                clean_body = re.sub(r'<[^>]+>', ' ', body)
                clean_body = re.sub(r'\s+', ' ', clean_body).strip()
                return f"{meta_desc}. {clean_body[:2000]}".strip()
            return text[:2000].strip()
    except Exception as e:
        logger.warning(f"Failed to fetch content fallback for '{url}': {e}")
    return ""


def _fetch_blog_feed(
    company: str,
    feed_url: str,
    days: int = 14,
    seen_urls: Optional[Set[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch and parse a company's RSS/Atom blog feed.
    Applies rule-based research classification, targeted full-content fallback for truncated
    entries, and de-duplicates across all company feeds and news sources.
    """
    headers = {"User-Agent": "PrismIQ-ResearchMonitor/1.0 (contact@prismiq.internal)"}
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
    seen = seen_urls if seen_urls is not None else set()
    if seen_urls is not None:
        seen.update(_normalize_canonical_url(u) for u in list(seen) if u)

    try:
        response = requests.get(feed_url, headers=headers, timeout=10)
        if response.status_code != 200:
            logger.warning(f"Blog feed returned status {response.status_code} for URL '{feed_url}'")
            return []

        root = ET.fromstring(response.text)
        signals: List[Dict[str, Any]] = []

        # Case A: Atom Feed (<feed><entry>...)
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        atom_entries = root.findall("atom:entry", ns)
        if atom_entries:
            for entry in atom_entries:
                link_el = entry.find("atom:link", ns)
                link = link_el.attrib.get("href", "").strip() if link_el is not None else ""
                norm_link = _normalize_canonical_url(link)
                if not norm_link or norm_link in seen or link in seen:
                    continue

                pub_el = entry.find("atom:published", ns)
                if pub_el is None:
                    pub_el = entry.find("atom:updated", ns)
                pub_str = pub_el.text.strip() if pub_el is not None and pub_el.text else ""
                if pub_str:
                    try:
                        dt = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
                        if dt.tzinfo is None:
                            dt = dt.replace(tzinfo=timezone.utc)
                        if dt < cutoff_date:
                            continue
                    except Exception:
                        pass

                title_el = entry.find("atom:title", ns)
                title = title_el.text.strip().replace("\n", " ") if title_el is not None and title_el.text else "Untitled Post"
                summary_el = entry.find("atom:summary", ns)
                if summary_el is None:
                    summary_el = entry.find("atom:content", ns)
                summary = summary_el.text.strip().replace("\n", " ") if summary_el is not None and summary_el.text else ""

                # Targeted full-content fallback if feed summary is truncated/empty/stub (< 50 chars or "...")
                content_to_classify = summary
                if len(summary.strip()) < 50 or summary.strip() == "..." or summary.strip().endswith("..."):
                    fallback_text = _fetch_article_content_fallback(link)
                    if fallback_text:
                        content_to_classify = fallback_text

                is_res, reason, indicators = research_classifier.classify_research_content(
                    title, content_to_classify, url=link, source="blog"
                )
                if is_res:
                    signals.append({
                        "source": "research",
                        "source_subtype": "research",
                        "company": company,
                        "title": title,
                        "url": link,
                        "published_at": pub_str,
                        "raw_excerpt": content_to_classify[:500] if content_to_classify else title,
                        "research_details": {
                            "type": "technical_writeup",
                            "reason": reason,
                            "indicators": indicators,
                        },
                    })
                seen.add(norm_link)
            return signals

        # Case B: RSS 2.0 Feed (<rss><channel><item>...)
        channel = root.find("channel")
        if channel is not None:
            items = channel.findall("item")
            for item in items:
                link_el = item.find("link")
                link = link_el.text.strip() if link_el is not None and link_el.text else ""
                norm_link = _normalize_canonical_url(link)
                if not norm_link or norm_link in seen or link in seen:
                    continue

                pub_el = item.find("pubDate")
                pub_str = pub_el.text.strip() if pub_el is not None else ""
                if pub_str:
                    try:
                        from email.utils import parsedate_to_datetime
                        dt = parsedate_to_datetime(pub_str)
                        if dt.tzinfo is None:
                            dt = dt.replace(tzinfo=timezone.utc)
                        if dt < cutoff_date:
                            continue
                    except Exception:
                        pass

                title_el = item.find("title")
                title = title_el.text.strip().replace("\n", " ") if title_el is not None and title_el.text else "Untitled Post"
                desc_el = item.find("description")
                desc = desc_el.text.strip().replace("\n", " ") if desc_el is not None and desc_el.text else ""
                clean_desc = re.sub(r"<[^>]+>", " ", desc).strip()

                # Targeted full-content fallback if feed summary is truncated/empty/stub (< 50 chars or "...")
                content_to_classify = clean_desc
                if len(clean_desc.strip()) < 50 or clean_desc.strip() == "..." or clean_desc.strip().endswith("..."):
                    fallback_text = _fetch_article_content_fallback(link)
                    if fallback_text:
                        content_to_classify = fallback_text

                is_res, reason, indicators = research_classifier.classify_research_content(
                    title, content_to_classify, url=link, source="blog"
                )
                if is_res:
                    signals.append({
                        "source": "research",
                        "source_subtype": "research",
                        "company": company,
                        "title": title,
                        "url": link,
                        "published_at": pub_str,
                        "raw_excerpt": content_to_classify[:500] if content_to_classify else title,
                        "research_details": {
                            "type": "technical_writeup",
                            "reason": reason,
                            "indicators": indicators,
                        },
                    })
                seen.add(norm_link)
            return signals

        return []
    except Exception as e:
        logger.error(f"Error fetching blog feed for '{company}' from '{feed_url}': {e}")
        return []


def _fetch_research_signals(
    company: str,
    days: int = 14,
    seen_urls: Optional[Set[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch all research activity signals (arXiv papers + Technical Blog write-ups).
    Guarantees strict deduplication across all feeds and previous news signals.
    """
    signals: List[Dict[str, Any]] = []
    seen = seen_urls if seen_urls is not None else set()
    if seen_urls is not None:
        seen.update(_normalize_canonical_url(u) for u in list(seen) if u)

    # 1. Query arXiv papers
    arxiv_papers = _fetch_arxiv_papers(company, days=days)
    for p in arxiv_papers:
        p_url = p.get("url", "")
        norm_u = _normalize_canonical_url(p_url)
        if norm_u and norm_u not in seen and p_url not in seen:
            signals.append(p)
            seen.add(norm_u)
            seen.add(p_url)

    # 2. Query company blog feeds
    feed_urls = COMPANY_FEED_URLS.get(company, [])
    if not feed_urls and not arxiv_papers:
        logger.info(f"Research activity source not supported for '{company}' (no structured RSS feed or arXiv presence; scraping avoided).")
        return []

    for feed_url in feed_urls:
        blog_signals = _fetch_blog_feed(company, feed_url, days=days, seen_urls=seen)
        signals.extend(blog_signals)

    return signals


def fetch_source_with_retry(
    source_name: str,
    fetch_func: Any,
    max_retries: int = 1,
    backoff: float = 1.0,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Execute a source fetch function with conditional retry on failure.
    - If attempt 1 fails, logs warning, waits with backoff, and retries once.
    - If attempt 2 fails, logs error, records failure metadata, and engages graceful fallback.
    """
    import time
    attempts = 0
    last_error: Optional[str] = None
    signals: List[Dict[str, Any]] = []

    while attempts <= max_retries:
        attempts += 1
        try:
            signals = fetch_func()
            status = "healthy" if attempts == 1 else "recovered"
            health = {
                "source": source_name,
                "status": status,
                "attempts": attempts,
                "signals_count": len(signals),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            if attempts > 1:
                logger.info(f"Source '{source_name}' successfully recovered on attempt {attempts}.")
            return signals, health
        except Exception as e:
            last_error = str(e)
            if attempts <= max_retries:
                logger.warning(
                    f"Source '{source_name}' failed on attempt {attempts}/{max_retries + 1}: {e}. "
                    f"Retrying in {backoff:.1f}s..."
                )
                time.sleep(backoff)
            else:
                logger.error(
                    f"Source '{source_name}' failed after {attempts} attempts: {e}. "
                    f"Engaging fallback (continuing pipeline without {source_name})."
                )

    health = {
        "source": source_name,
        "status": "failed",
        "attempts": attempts,
        "error": last_error or "Unknown error",
        "fallback": f"continued pipeline without {source_name}",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return [], health


def run(
    companies: Optional[List[str]] = None,
    active_sources: Optional[List[str]] = None,
    supervisor_decisions: Optional[Dict[str, Any]] = None,
    return_health: bool = False,
) -> Union[List[Dict[str, Any]], Tuple[List[Dict[str, Any]], Dict[str, Dict[str, Any]]]]:
    """
    Query news, GitHub, jobs, pricing, and research sources with conditional retry & graceful fallback.
    """
    if companies is None:
        all_companies: List[str] = []
        for c in [config.TARGET_COMPANY] + config.COMPETITORS:
            if c not in all_companies:
                all_companies.append(c)
        companies = all_companies

    # Determine which sources are active
    sources_to_run = list(active_sources) if active_sources is not None else list(config.SOURCES)

    # Check supervisor skip decisions
    if supervisor_decisions:
        for src, dec in supervisor_decisions.items():
            if dec.get("action") == "skip" and src in sources_to_run:
                sources_to_run.remove(src)
                logger.info(f"Supervisor skipped source '{src}': {dec.get('reason')}")

    all_signals: List[Dict[str, Any]] = []
    source_health: Dict[str, Dict[str, Any]] = {}

    # 1. News Source
    if "news" in sources_to_run:
        def _fetch_all_news():
            sigs = []
            for c in companies:
                sigs.extend(_fetch_news_from_currents(c))
            return sigs

        news_sigs, health = fetch_source_with_retry("news", _fetch_all_news)
        all_signals.extend(news_sigs)
        source_health["news"] = health

    # 2. GitHub Source
    if "github" in sources_to_run:
        def _fetch_all_github():
            sigs = []
            for c in companies:
                sigs.extend(_fetch_github_events(c))
            return sigs

        gh_sigs, health = fetch_source_with_retry("github", _fetch_all_github)
        all_signals.extend(gh_sigs)
        source_health["github"] = health

    # 3. Jobs Source
    if "jobs" in sources_to_run:
        def _fetch_all_jobs():
            sigs = []
            for c in companies:
                sigs.extend(_fetch_jobs(c))
            return sigs

        job_sigs, health = fetch_source_with_retry("jobs", _fetch_all_jobs)
        all_signals.extend(job_sigs)
        source_health["jobs"] = health

    # 4. Pricing Source
    if "pricing" in sources_to_run:
        def _fetch_all_pricing():
            return pricing_extractor.fetch_pricing_signals(companies)

        price_sigs, health = fetch_source_with_retry("pricing", _fetch_all_pricing)
        all_signals.extend(price_sigs)
        source_health["pricing"] = health

    # 5. Research Source (arXiv Papers & In-Depth Technical Blog Write-ups)
    if "research" in sources_to_run:
        seen_news_urls = set(_normalize_canonical_url(s.get("url", "")) for s in all_signals if s.get("url"))

        def _fetch_all_research():
            sigs = []
            for c in companies:
                sigs.extend(_fetch_research_signals(c, days=14, seen_urls=seen_news_urls))
            return sigs

        res_sigs, health = fetch_source_with_retry("research", _fetch_all_research)
        all_signals.extend(res_sigs)
        source_health["research"] = health

    consolidated = consolidate_signals(all_signals)
    if return_health:
        return consolidated, source_health
    return consolidated
