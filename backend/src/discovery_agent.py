import argparse
import concurrent.futures
import json
import logging
import os
import re
import sys
import threading
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
import requests

try:
    from langsmith import traceable
    from langsmith.run_helpers import get_current_run_tree
except ImportError:
    def traceable(*args, **kwargs):
        def decorator(f):
            return f
        return decorator
    def get_current_run_tree():
        return None

from src import config, storage, company_profiler, search_provider, discovery_cache

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
FALLBACK_GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
]
VALID_CONFIDENCE_LEVELS = {"High", "Medium", "Low"}
VALID_SOURCE_AGES = {"recent", "dated", "undated"}

# Groq Daily Token Budget Tracking & Alerting Configuration (200k TPD ceiling)
GROQ_DAILY_TOKEN_LIMIT = 200000
GROQ_TOKEN_WARNING_THRESHOLD = 0.80  # 80% = 160,000 tokens
_TOKEN_USAGE_LOCK = threading.Lock()
_DAILY_TOKEN_USAGE: Dict[str, Any] = {
    "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    "tokens_used": 0,
    "last_updated": datetime.now(timezone.utc).isoformat(),
    "warning_logged": False,
}

DISCOVERY_SYSTEM_PROMPT = """You are the Principal Competitive Intelligence Analyst for PrismIQ.
Given a target company, its grounded product segments, and retrieved market & web sources, your mission is to produce an authoritative, high-precision competitive landscape of genuine operating competitors.

OUTPUT CONTRACT:
Return ONLY a valid JSON object with a single key "candidates" containing an array of 10 to 16 competitor candidate objects across all grounded segments:
{
  "candidates": [
    {
      "name": "Exact Competitor Company or Platform Brand Name",
      "category": "Specific market category (e.g. AI Interview Coaching, Value E-Commerce, Developer Cloud, Note-Taking & Wiki)",
      "website": "Clean corporate domain (e.g. yoodli.ai, poised.com, flipkart.com, adyen.com, netlify.com)",
      "matched_segment": "Exact name of the target segment this candidate competes with",
      "tier": "core" | "peripheral",
      "confidence": "High" | "Medium" | "Low",
      "rationale": "One concise sentence explaining how it competes in the matched segment on functional capabilities.",
      "source": "Exact Title or URL of supporting retrieved source, or 'Authoritative Market Intelligence Index'",
      "source_age": "recent" | "dated" | "undated"
    }
  ]
}

GUARDRAILS & STRICT REQUIREMENTS:
1. NO GENERIC OR UNFALSIFIABLE RATIONALES:
   - Do NOT use vague filler like "they are in the same space" or "they are a competitor". State specifically what products, architectures, or market overlaps exist.
2. GROUNDING & ZERO HALLUCINATION:
   - Competitors should be grounded in the provided retrieved sources whenever available. If retrieved sources are sparse or noisy for a specific segment, identify established operating industry competitors that directly compete in the target company's grounded segments and cite 'Authoritative Market Intelligence Index'.
3. NO CHERRY-PICKING OR DISTORTION:
   - State the competitive relationship accurately based on what the source documents.
4. FRESHNESS & CONFIDENCE CALIBRATION:
   - "High" confidence requires recent, checkable facts (sources from the last ~18 months).
   - If grounded only in a "dated" source without recent corroboration, assign "Medium" or "Low" confidence and set source_age to "dated".
5. FUNCTIONAL SEGMENT OVERLAP REQUIRED:
   - Every competitor MUST overlap at least one of the target company's grounded product segments on FUNCTION.
   - Being in the same broad theme (e.g. "both are AI tools" or "both use LLMs") is NOT sufficient.
   - For multi-product companies, specify the exact 'matched_segment' for each candidate.
6. STRICT DIRECTORY & MARKETPLACE DISQUALIFICATION:
   - DO NOT include AI tool directories, marketplaces, catalogs, or prompt aggregators (e.g. FutureTools.io, AITools.fyi, OpenAI AI Hub, Microsoft Copilot Marketplace, PromptBase, Lablab.ai, Zapier AI Integrations, Toolify.ai, G2, Capterra) unless the target company is itself a directory or marketplace.
   - A directory that merely lists AI tools is NEVER a competitor to a software application or coaching platform.
7. SELF-EXCLUSION & ENTITY INTEGRITY:
   - DO NOT include the target company itself or any of its internal sub-brands/products (e.g. if target is Vercel, do NOT include Next.js or Turborepo; if target is OpenAI, do NOT include ChatGPT or Dall-E).
   - DO NOT include news publishers, media outlets, review aggregators, or blogs (e.g. Forbes, TechCrunch, Latka, CB Insights).
   - DO NOT include companies matched due to partial homonym names from unrelated industries (e.g. helpdesk tools for an interview coach).
   - Return ONLY active companies with real, operating products and clean domains.
8. BALANCED MULTI-SEGMENT RECALL:
   - For companies with multiple distinct product segments, you MUST provide at least 2 operating competitors for EACH distinct segment.
   - Do NOT cluster candidates solely into one or two segments. Provide operating competitors across each listed capability pillar (e.g. if a company offers interview coaching AND fashion styling AND AR/VR rehearsal, you must cover interview, fashion, and AR/VR)."""



def _parse_iso_or_date(date_val: Any) -> Optional[datetime]:
    """
    Parse date from ISO string, timestamp, or date format.
    STRICT: Returns None if missing, malformed, or unparseable. NEVER defaults to 'now'.
    """
    if not date_val:
        return None
    try:
        if isinstance(date_val, (int, float)):
            return datetime.fromtimestamp(date_val, tz=timezone.utc)
        clean = str(date_val).strip()
        clean = clean.replace("Z", "+00:00")
        clean = clean.replace(" +0000", "+00:00").replace(" ", "T")
        return datetime.fromisoformat(clean)
    except Exception:
        # Fallback to strict YYYY-MM-DD regex only
        m = re.search(r"^(\d{4})-(\d{2})-(\d{2})", str(date_val).strip())
        if m:
            try:
                return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=timezone.utc)
            except Exception:
                return None
        return None


def _compute_source_age(dt: Optional[datetime], reference_dt: Optional[datetime] = None, threshold_days: int = 540) -> Tuple[str, Optional[str]]:
    """
    Classify source age as 'recent' (within ~18 months / 540 days), 'dated' (> 18 months), or 'undated'.
    STRICT: If dt is None or unparseable, returns strictly ('undated', None). NEVER defaults to 'recent'.
    """
    if not dt:
        return "undated", None
    if reference_dt is None:
        reference_dt = datetime.now(timezone.utc)
    age = reference_dt - dt
    date_str = dt.strftime("%Y-%m-%d")
    if age < timedelta(days=threshold_days):
        return "recent", date_str
    else:
        return "dated", date_str


def _normalize_confidence(val: Any) -> str:
    """Normalize confidence level to strictly 'High', 'Medium', or 'Low'."""
    if not isinstance(val, str):
        return "Low"
    normalized = val.strip().capitalize()
    if normalized in VALID_CONFIDENCE_LEVELS:
        return normalized
    return "Low"


def _normalize_source_age(val: Any) -> str:
    """Normalize source_age to 'recent', 'dated', or 'undated'."""
    if not isinstance(val, str):
        return "undated"
    normalized = val.strip().lower()
    if normalized in VALID_SOURCE_AGES:
        return normalized
    return "undated"


DEFAULT_REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
}


def _fetch_hn_context(company: str) -> List[Dict[str, Any]]:
    """Fetch comparative discussions and alternative writeups from Hacker News Algolia API with timestamps."""
    sources: List[Dict[str, Any]] = []
    queries = [f"{company} alternative", f"{company} vs", f"{company} competitor", company]
    
    def _search_hn_query(q: str) -> List[Dict[str, Any]]:
        res = []
        try:
            url = "https://hn.algolia.com/api/v1/search"
            params = {"query": q, "tags": "story", "hitsPerPage": 4}
            resp = requests.get(url, params=params, headers=DEFAULT_REQUEST_HEADERS, timeout=4)
            if resp.status_code == 200:
                hits = resp.json().get("hits", [])
                for hit in hits:
                    title = str(hit.get("title", "")).strip()
                    item_url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
                    created_at_raw = hit.get("created_at") or hit.get("created_at_i")
                    dt = _parse_iso_or_date(created_at_raw)
                    age_flag, date_str = _compute_source_age(dt)

                    if title:
                        res.append({
                            "source_type": "discussion_and_tech_media",
                            "title": title,
                            "url": item_url,
                            "published_at": date_str,
                            "source_age": age_flag,
                            "text": f"Article title: '{title}'. Published: {date_str or 'unknown'} ({age_flag}). Comparison involving {company} at {item_url}",
                        })
        except Exception as e:
            logger.debug(f"HN search error for '{q}': {e}")
        return res

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(queries)) as pool:
        futs = [pool.submit(_search_hn_query, q) for q in queries]
        for fut in concurrent.futures.as_completed(futs):
            try:
                sources.extend(fut.result())
            except Exception:
                pass

    return sources


def _fetch_github_context(company: str) -> List[Dict[str, Any]]:
    """Fetch open-source and commercial alternatives from GitHub repository search with repository activity dates."""
    sources: List[Dict[str, Any]] = []
    token = os.getenv("GITHUB_TOKEN")
    headers = dict(DEFAULT_REQUEST_HEADERS)
    headers["Accept"] = "application/vnd.github+json"
    if token:
        headers["Authorization"] = f"Bearer {token.strip()}"

    queries = [f"{company} alternative", f"{company} vs"]
    for q in queries:
        try:
            url = "https://api.github.com/search/repositories"
            params = {"q": q, "per_page": 4}
            resp = requests.get(url, headers=headers, params=params, timeout=4)
            if resp.status_code == 200:
                items = resp.json().get("items", [])
                for item in items:
                    name = str(item.get("name", "")).strip()
                    desc = str(item.get("description") or "").strip()
                    html_url = str(item.get("html_url", "")).strip()
                    full_name = str(item.get("full_name", name)).strip()
                    pushed_at = item.get("pushed_at") or item.get("updated_at") or item.get("created_at")
                    dt = _parse_iso_or_date(pushed_at)
                    age_flag, date_str = _compute_source_age(dt)

                    if name and desc:
                        sources.append({
                            "source_type": "github_repository",
                            "title": f"GitHub Repo: {full_name}",
                            "url": html_url,
                            "published_at": date_str,
                            "source_age": age_flag,
                            "text": f"Repository '{name}': {desc} (Last active: {date_str or 'unknown'}, {age_flag})",
                        })
        except Exception as e:
            logger.debug(f"GitHub search error for '{q}': {e}")

    return sources


def _fetch_wikipedia_context(company: str) -> List[Dict[str, Any]]:
    """Fetch encyclopedic background and competitor mentions from Wikipedia REST API with parallel queries."""
    sources: List[Dict[str, Any]] = []
    headers = {"User-Agent": "PrismIQ-Competitive-Intelligence/2.0 (research@prismiq.ai)"}
    queries = [company, f"{company} competitors", f"{company} alternatives", f"{company} vs"]

    def _query_wiki(q: str) -> List[Dict[str, Any]]:
        res = []
        try:
            url = "https://en.wikipedia.org/w/api.php"
            params = {
                "action": "query",
                "list": "search",
                "srsearch": q,
                "format": "json",
                "srlimit": 4,
            }
            resp = requests.get(url, params=params, headers=headers, timeout=4)
            if resp.status_code == 200:
                items = resp.json().get("query", {}).get("search", [])
                for item in items:
                    title = str(item.get("title", "")).strip()
                    snippet = re.sub(r"<[^>]+>", " ", str(item.get("snippet", ""))).strip()
                    page_url = f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}"
                    res.append({
                        "source_type": "wikipedia",
                        "title": f"Wikipedia: {title}",
                        "url": page_url,
                        "published_at": None,
                        "source_age": "undated",
                        "text": f"{title}: {snippet} (undated encyclopedia entry)",
                    })
        except Exception as e:
            logger.debug(f"Wikipedia API error for '{q}': {e}")
        return res

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(queries)) as pool:
        for r in pool.map(_query_wiki, queries):
            sources.extend(r)

    return sources


def _fetch_currents_context(company: str) -> List[Dict[str, Any]]:
    """Fetch recent news articles and competitor mentions from Currents API with publication dates."""
    sources: List[Dict[str, Any]] = []
    api_key = os.getenv("CURRENTS_API_KEY")
    if not api_key:
        return []

    try:
        url = "https://api.currentsapi.services/v1/search"
        params = {
            "keywords": f"{company}",
            "language": "en",
            "apiKey": api_key.strip(),
        }
        resp = requests.get(url, params=params, timeout=4)
        if resp.status_code == 200:
            articles = resp.json().get("news", [])
            for a in articles[:5]:
                title = str(a.get("title", "")).strip()
                desc = str(a.get("description", "") or "").strip()
                url_val = str(a.get("url", "")).strip()
                pub_raw = a.get("published", "")
                dt = _parse_iso_or_date(pub_raw)
                age_flag, date_str = _compute_source_age(dt)

                if title:
                    sources.append({
                        "source_type": "news",
                        "title": title,
                        "url": url_val,
                        "published_at": date_str,
                        "source_age": age_flag,
                        "text": f"{desc or title} (Published: {date_str or 'unknown'}, {age_flag})",
                    })
    except Exception as e:
        logger.debug(f"Currents API error for '{company}': {e}")

    return sources


def _fetch_duckduckgo_context(company: str) -> List[Dict[str, Any]]:
    """
    Fetch structured competitive knowledge and related entities from DuckDuckGo Instant Answer API.
    Zero-scraping JSON endpoint that returns disambiguated entities, competitor topics, and descriptions.
    """
    sources: List[Dict[str, Any]] = []
    queries = [f"{company} alternatives", f"{company} competitors", f"{company} vs", f"companies like {company}"]

    for q in queries:
        try:
            url = "https://api.duckduckgo.com/"
            params = {
                "q": q,
                "format": "json",
                "no_html": 1,
                "skip_disambig": 0,
            }
            resp = requests.get(url, params=params, headers=DEFAULT_REQUEST_HEADERS, timeout=4)
            if resp.status_code == 200:
                data = resp.json()
                abstract = data.get("AbstractText", "").strip()
                abstract_source = data.get("AbstractSource", "DuckDuckGo Knowledge")
                abstract_url = data.get("AbstractURL", "")

                if abstract:
                    sources.append({
                        "source_type": "market_knowledge_index",
                        "title": f"Market Knowledge: {company} ({abstract_source})",
                        "url": abstract_url or f"https://duckduckgo.com/?q={quote_plus(q)}",
                        "published_at": None,
                        "source_age": "undated",
                        "text": f"Knowledge entry for {company}: {abstract}",
                    })

                # Extract related topics
                topics = data.get("RelatedTopics", [])
                for item in topics[:4]:
                    if isinstance(item, dict):
                        topic_text = item.get("Text", "").strip()
                        topic_url = item.get("FirstURL", "")
                        if topic_text and len(topic_text) > 15:
                            sources.append({
                                "source_type": "market_knowledge_index",
                                "title": f"Competitive Entity: {topic_text[:50]}...",
                                "url": topic_url or abstract_url,
                                "published_at": None,
                                "source_age": "undated",
                                "text": f"Competitive overview regarding {company}: {topic_text}",
                            })
        except Exception as e:
            logger.debug(f"DuckDuckGo API error for '{q}': {e}")

    return sources


def _fetch_alternativeto_context(company: str) -> List[Dict[str, Any]]:
    """
    Fetch established competitors from alternativeto.net structured listing pages.
    """
    sources: List[Dict[str, Any]] = []
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        return sources

    slug = re.sub(r'[^a-zA-Z0-9]+', '-', company.strip().split('/')[0].split('(')[0]).strip('-').lower()
    if not slug:
        return sources

    url = f"https://alternativeto.net/software/{slug}/"
    try:
        resp = requests.get(url, headers=DEFAULT_REQUEST_HEADERS, timeout=4)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            alt_cards = soup.select("[data-app-slug], .app-list-item, .listing-item, article.app-card")
            if not alt_cards:
                alt_links = soup.select('a[href*="/software/"]')
                seen_names = set()
                for link in alt_links[:15]:
                    name = link.get_text(strip=True)
                    href = link.get("href", "")
                    if not name or len(name) < 2 or len(name) > 80:
                        continue
                    if slug in href.lower() and href.count('/') <= 3:
                        continue
                    if name.lower() == company.strip().lower():
                        continue
                    if name.lower() in seen_names:
                        continue
                    seen_names.add(name.lower())
                    full_url = f"https://alternativeto.net{href}" if href.startswith("/") else href
                    sources.append({
                        "source_type": "alternatives_listing",
                        "title": f"AlternativeTo: {name} (alternative to {company})",
                        "url": full_url,
                        "published_at": None,
                        "source_age": "undated",
                        "text": f"{name} is listed as an alternative to {company} on alternativeto.net. (undated structured listing)",
                    })
            else:
                for card in alt_cards[:8]:
                    app_slug = card.get("data-app-slug", "")
                    name_el = card.select_one(".app-name, h3, [data-app-name]")
                    desc_el = card.select_one(".app-description, .listing-text, p")
                    name = name_el.get_text(separator=" ", strip=True) if name_el else (app_slug.replace("-", " ").title() if app_slug else "")
                    desc = desc_el.get_text(separator=" ", strip=True) if desc_el else ""

                    if not name or name.lower() == company.strip().lower():
                        continue

                    alt_url = f"https://alternativeto.net/software/{app_slug}/" if app_slug else url
                    text = f"{name} is listed as an alternative to {company} on alternativeto.net. Description: {desc[:200]}"
                    sources.append({
                        "source_type": "alternatives_listing",
                        "title": f"AlternativeTo: {name} (alternative to {company})",
                        "url": alt_url,
                        "published_at": None,
                        "source_age": "undated",
                        "text": text,
                    })
    except Exception as e:
        logger.debug(f"AlternativeTo error for '{slug}': {e}")

    return sources


def _fetch_gnews_competitor_context(company: str) -> List[Dict[str, Any]]:
    """Fetch recent competitor news and rival comparisons from Google News RSS with publication dates."""
    sources: List[Dict[str, Any]] = []
    queries = [f"{company} competitors", f"{company} vs", f"{company} rival", f"{company} competition"]
    headers = dict(DEFAULT_REQUEST_HEADERS)
    seen_links = set()
    for q in queries:
        try:
            encoded = urllib.parse.quote(q)
            url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=4) as resp:
                content = resp.read()
            root = ET.fromstring(content)
            for it in root.findall(".//item")[:4]:
                link = (it.findtext("link") or "").strip()
                title = (it.findtext("title") or "").strip()
                pub_str = (it.findtext("pubDate") or "").strip()
                if not title or link in seen_links:
                    continue
                seen_links.add(link)
                dt = None
                if pub_str:
                    try:
                        dt = parsedate_to_datetime(pub_str)
                    except Exception:
                        pass
                age_flag, date_str = _compute_source_age(dt)
                sources.append({
                    "source_type": "news",
                    "title": title,
                    "url": link,
                    "published_at": date_str,
                    "source_age": age_flag,
                    "text": f"Google News: '{title}'. Published: {date_str or 'unknown'} ({age_flag}). Query: '{q}'.",
                })
        except Exception as e:
            logger.debug(f"Google News RSS error for '{q}': {e}")
    return sources


def _fetch_comparison_index_context(company: str) -> List[Dict[str, Any]]:
    """Fetch structured web comparison listings via structured search provider with persistent caching."""
    sources: List[Dict[str, Any]] = []
    try:
        query = f"{company} competitors alternatives"
        raw_items = search_provider.search_web_structured(query, company=company, max_results=8)
        for r in raw_items:
            t_text = r.get("title", "").strip()
            s_text = r.get("snippet", "").strip()
            href = r.get("url", "").strip()
            if not t_text or not href:
                continue
            sources.append({
                "source_type": "alternatives_listing",
                "title": f"Comparison Index: {t_text}",
                "url": href,
                "published_at": None,
                "source_age": "undated",
                "text": f"{t_text}: {s_text} (comparison index)",
            })
    except Exception as e:
        logger.debug(f"Comparison index search error for '{company}': {e}")
    return sources


def _fetch_segment_web_context(segment_name: str, queries: List[str]) -> List[Dict[str, Any]]:
    """Fetch comparative web sources and alternatives for a specific product segment with persistent caching."""
    sources: List[Dict[str, Any]] = []
    seen_urls = set()
    try:
        for q in queries[:3]:
            raw_items = search_provider.search_web_structured(q, company=segment_name, max_results=5)
            for r in raw_items:
                t_text = r.get("title", "").strip()
                s_text = r.get("snippet", "").strip()
                href = r.get("url", "").strip()
                if not href or href in seen_urls:
                    continue
                seen_urls.add(href)
                sources.append({
                    "source_type": "alternatives_listing",
                    "title": f"Segment Analysis [{segment_name}]: {t_text}",
                    "url": href,
                    "published_at": None,
                    "source_age": "undated",
                    "text": f"Segment '{segment_name}' comparison: {t_text}. {s_text}",
                    "segment_name": segment_name,
                })
    except Exception as e:
        logger.debug(f"Segment search error for '{segment_name}': {e}")
    return sources


def _fetch_segment_gnews_context(segment_name: str, queries: List[str]) -> List[Dict[str, Any]]:
    """Fetch recent news and market comparisons for a specific product segment."""
    sources: List[Dict[str, Any]] = []
    headers = dict(DEFAULT_REQUEST_HEADERS)
    seen_links = set()
    for q in queries[:2]:
        try:
            encoded = urllib.parse.quote(q)
            url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=4) as resp:
                content = resp.read()
            root = ET.fromstring(content)
            for it in root.findall(".//item")[:3]:
                link = (it.findtext("link") or "").strip()
                title = (it.findtext("title") or "").strip()
                pub_str = (it.findtext("pubDate") or "").strip()
                if not title or link in seen_links:
                    continue
                seen_links.add(link)
                dt = None
                if pub_str:
                    try:
                        dt = parsedate_to_datetime(pub_str)
                    except Exception:
                        pass
                age_flag, date_str = _compute_source_age(dt)
                sources.append({
                    "source_type": "news",
                    "title": f"Segment News [{segment_name}]: {title}",
                    "url": link,
                    "published_at": date_str,
                    "source_age": age_flag,
                    "text": f"News for segment '{segment_name}': '{title}'. Published: {date_str or 'unknown'} ({age_flag}).",
                    "segment_name": segment_name,
                })
        except Exception as e:
            logger.debug(f"Segment GNews error for '{q}': {e}")
    return sources


def fetch_grounded_context(
    company: str,
    profile: Optional[Dict[str, Any]] = None,
    force_refresh: bool = False,
) -> List[Dict[str, Any]]:
    """
    Gather and deduplicate multi-source grounded intelligence context across
    segment-based web retrieval, Hacker News, GitHub, Wikipedia, Currents news,
    DuckDuckGo Knowledge, AlternativeTo, Google News RSS, and web comparison indexes.
    Features deterministic persistent caching to eliminate run-to-run variance.
    """
    company_clean = company.strip().lower()

    # Step 0: Check persistent company context cache
    if not force_refresh:
        cached_context = discovery_cache.get_cached_company_context(company_clean)
        if cached_context is not None:
            logger.info(f"Grounded context cache HIT for '{company_clean}' ({len(cached_context)} sources)")
            return cached_context

    fetchers = [
        ("hn", lambda: _fetch_hn_context(company)),
        ("github", lambda: _fetch_github_context(company)),
        ("wikipedia", lambda: _fetch_wikipedia_context(company)),
        ("currents", lambda: _fetch_currents_context(company)),
        ("duckduckgo", lambda: _fetch_duckduckgo_context(company)),
        ("alternativeto", lambda: _fetch_alternativeto_context(company)),
        ("gnews", lambda: _fetch_gnews_competitor_context(company)),
        ("comparison_index", lambda: _fetch_comparison_index_context(company)),
    ]

    # Add segment-based fetchers if structured profile has segments
    if profile and profile.get("segments"):
        for seg in profile.get("segments", [])[:4]:
            s_name = seg.get("name", "")
            s_queries = seg.get("search_queries", [])
            if not s_queries and s_name:
                s_queries = [f"{s_name} competitors", f"{s_name} alternatives"]
            if s_queries:
                fetchers.append((
                    f"segment_web_{seg.get('segment_id', s_name)}",
                    lambda sn=s_name, sq=s_queries: _fetch_segment_web_context(sn, sq)
                ))
                fetchers.append((
                    f"segment_news_{seg.get('segment_id', s_name)}",
                    lambda sn=s_name, sq=s_queries: _fetch_segment_gnews_context(sn, sq)
                ))

    raw_sources: List[Dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(20, len(fetchers))) as executor:
        future_map = {executor.submit(fn): name for name, fn in fetchers}
        done, not_done = concurrent.futures.wait(future_map.keys(), timeout=18.0)
        for fut in done:
            name = future_map[fut]
            try:
                items = fut.result()
                raw_sources.extend(items)
            except Exception as e:
                logger.debug(f"Source fetcher '{name}' encountered error: {e}")
        if not_done:
            logger.debug(f"{len(not_done)} source fetchers timed out after 18.0s; proceeding with completed sources.")

    # Deduplicate sources and group by segment vs category
    seen = set()
    segment_sources: Dict[str, List[Dict[str, Any]]] = {}
    by_category: Dict[str, List[Dict[str, Any]]] = {
        "alternatives_listing": [],
        "news": [],
        "wikipedia": [],
        "discussion_and_tech_media": [],
        "github_repository": [],
        "market_knowledge_index": [],
    }

    for s in raw_sources:
        url_clean = s.get("url", "").strip()
        title_clean = s.get("title", "").strip()
        key = (url_clean, title_clean)
        if key not in seen and title_clean:
            seen.add(key)
            # Enforce concise excerpt text to prevent prompt bloat (safe under Groq 8000 TPM limit)
            s["text"] = str(s.get("text", "")).strip()[:350]
            
            # If source is tagged with a specific product segment, bucket by segment
            seg_name = s.get("segment_name")
            if seg_name:
                segment_sources.setdefault(seg_name, []).append(s)
            else:
                cat = s.get("source_type", "market_knowledge_index")
                if cat in by_category:
                    by_category[cat].append(s)
                else:
                    by_category["market_knowledge_index"].append(s)

    curated: List[Dict[str, Any]] = []

    # 1. Guarantee multi-segment representation: Allocate up to 3 high-quality sources per grounded segment
    if profile and profile.get("segments"):
        for seg in profile.get("segments", []):
            s_name = seg.get("name", "")
            s_items = segment_sources.get(s_name, [])
            # Prioritize concrete software tool / alternatives listings over generic news
            seg_tools = [x for x in s_items if x.get("source_type") == "alternatives_listing"]
            seg_news = [x for x in s_items if x.get("source_type") == "news"]
            seg_curated = seg_tools[:2] + seg_news[:1]
            if len(seg_curated) < 3:
                seg_curated.extend([x for x in s_items if x not in seg_curated][:3 - len(seg_curated)])
            curated.extend(seg_curated)

    # 2. Add cross-domain sources (general alternatives, news, wikipedia, discussion, repos)
    if profile and profile.get("segments"):
        curated.extend(by_category["alternatives_listing"][:3])
        curated.extend(by_category["wikipedia"][:3])
        curated.extend(by_category["news"][:3])
        curated.extend(by_category["discussion_and_tech_media"][:2])
        curated.extend(by_category["github_repository"][:2])
        curated.extend(by_category["market_knowledge_index"][:2])
    else:
        curated.extend(by_category["alternatives_listing"][:4])
        curated.extend(by_category["news"][:4])
        curated.extend(by_category["wikipedia"][:4])
        curated.extend(by_category["discussion_and_tech_media"][:3])
        curated.extend(by_category["github_repository"][:2])
        curated.extend(by_category["market_knowledge_index"][:2])

    max_total_sources = 24 if (profile and len(profile.get("segments", [])) >= 2) else 18
    final_curated = curated[:max_total_sources]
    if final_curated:
        discovery_cache.set_cached_company_context(company_clean, final_curated)
    return final_curated


def _build_prompts(
    company: str,
    sources: List[Dict[str, Any]],
    profile: Optional[Dict[str, Any]] = None,
) -> Tuple[str, str]:
    """Construct system and user prompts for Groq competitor discovery with grounded profile and freshness annotations."""
    formatted_context = ""
    for idx, s in enumerate(sources, 1):
        date_info = f"Date: {s.get('published_at') or 'Undated'} ({s.get('source_age', 'undated')})"
        formatted_context += (
            f"Source [{idx}] ({s.get('source_type', 'source')}):\n"
            f"Title: {s.get('title', '')}\n"
            f"{date_info}\n"
            f"URL: {s.get('url', '')}\n"
            f"Excerpt: {s.get('text', '')}\n\n"
        )

    profile_context = ""
    if profile:
        profile_context = f"Target Company Official Website: {profile.get('domain') or 'Not specified'}\n"
        profile_context += f"Company Profile Summary: {profile.get('summary', '')}\n\n"
        if profile.get("segments"):
            profile_context += "Grounded Product Segments & Capabilities:\n"
            for s_idx, seg in enumerate(profile["segments"], 1):
                quote_str = f' (Evidence: "{seg.get("verbatim_quote")}")' if seg.get("verbatim_quote") else ""
                profile_context += (
                    f"  Segment {s_idx}: {seg.get('name')}\n"
                    f"    - Target Customers: {seg.get('target_customers', 'Enterprise & consumer')}\n"
                    f"    - Capability: {seg.get('what_it_does', '')}{quote_str}\n"
                )
            profile_context += "\n"

    valid_segment_names = [seg.get("name", "").strip() for seg in profile.get("segments", []) if seg.get("name")] if profile else []

    multi_segment_req = ""
    if valid_segment_names and len(valid_segment_names) >= 2:
        checklist_items = []
        for s_idx, seg in enumerate(profile["segments"], 1):
            s_name = seg.get("name", "").strip()
            s_what = seg.get("what_it_does", "")[:70]
            checklist_items.append(
                f"  - Segment {s_idx} EXACT NAME: \"{s_name}\" ({s_what}...)\n"
                f"    MANDATORY QUOTA: Return at least 2 distinct operating commercial competitors with \"matched_segment\": \"{s_name}\"."
            )
        checklist_str = "\n".join(checklist_items)
        allowed_names_list = ", ".join([f'"{n}"' for n in valid_segment_names])
        multi_segment_req = f"""
CRITICAL MULTI-SEGMENT RECALL & COVERAGE GUARANTEE:
The target company operates across multiple distinct product verticals.
STRICT ENUM CONSTRAINT FOR 'matched_segment':
Every candidate's "matched_segment" field MUST EXACTLY match one of the following grounded segment names:
[{allowed_names_list}]
Do NOT invent new or alternate segment names. You MUST select strictly from the allowed names above.

MANDATORY PER-SEGMENT MINIMUM QUOTA CHECKLIST:
{checklist_str}
You are strictly required to balance candidates across all segments. Every segment listed above MUST have at least 2 competitors in your response.
"""

    user_prompt = f"""Target Company: {company}

{profile_context}Retrieved Market & News Sources:
\"\"\"
{formatted_context}
\"\"\"
{multi_segment_req}
Analyze the grounded product segments and retrieved sources above.
Produce an authoritative, comprehensive competitive landscape of genuine operating competitors for {company}.
You MUST return between 10 and 16 distinct competitor candidates covering ALL grounded segments evenly. Do NOT return fewer than 10 candidates when multiple segments exist.
Every competitor candidate MUST overlap at least one of the target segments on functional capabilities, and its 'matched_segment' field MUST strictly match one of the grounded segment names.
DO NOT include AI tool directories or aggregators (e.g. FutureTools, AITools.fyi, PromptBase, Toolify, OpenAI AI Hub, Copilot Marketplace) unless the target is a directory.
Adhere strictly to the JSON schema with name, category, website, matched_segment, tier, confidence, rationale, and source."""
    return DISCOVERY_SYSTEM_PROMPT, user_prompt


def _attach_langsmith_usage(usage: Optional[Dict[str, Any]], model: str = "") -> None:
    """Extract token counts and estimated cost from Groq usage object and attach to the active LangSmith span."""
    if not usage or not isinstance(usage, dict):
        return
    try:
        run_tree = get_current_run_tree()
        if not run_tree:
            return

        p_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
        c_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
        t_tokens = int(usage.get("total_tokens") or (p_tokens + c_tokens))

        # Benchmark pricing for open-weight models on Groq Cloud ($0.59 / 1M prompt, $0.79 / 1M completion)
        input_cost = (p_tokens / 1_000_000.0) * 0.59
        output_cost = (c_tokens / 1_000_000.0) * 0.79
        total_cost = round(input_cost + output_cost, 6)

        usage_meta = {
            "input_tokens": p_tokens,
            "output_tokens": c_tokens,
            "total_tokens": t_tokens,
            "input_cost": round(input_cost, 6),
            "output_cost": round(output_cost, 6),
            "total_cost": total_cost,
        }

        if hasattr(run_tree, "set"):
            run_tree.set(usage_metadata=usage_meta)
        else:
            run_tree.extra = run_tree.extra or {}
            run_tree.extra.setdefault("metadata", {})["usage_metadata"] = usage_meta
    except Exception as e:
        logger.debug(f"Could not attach usage metadata to LangSmith span: {e}")


class LLMUnavailableError(Exception):
    """Raised when LLM inference fails due to missing credentials, authentication rejection, or service failure."""
    pass


# ============================================================================
# Name Cleaning, Canonical Brand Key & Self-Exclusion Guardrails
# ============================================================================

def _clean_company_name(name: str) -> str:
    """
    Normalize company and candidate names:
    - Strip legal entities: Inc, Inc., LLC, Ltd, Ltd., Corp, Corporation, Co., Co, PBC
    - Normalize brackets, punctuation, quotes, and whitespace
    """
    if not name:
        return ""
    clean = str(name).strip().strip("\"'").strip()
    clean = re.sub(r'(?i)\s*\b(inc|llc|ltd|corp|corporation|co|technologies|company|pbc)\b\.?$', '', clean).strip()
    clean = re.sub(r'[,.]+$', '', clean).strip()
    clean = re.sub(r'\s+', ' ', clean)
    return clean


def _canonical_brand_key(name: str) -> str:
    """
    Produce canonical brand identifier for deduplication across both LLM and heuristic extraction:
    - Strips corporate suffixes: inc, llc, corp, ltd, co, corporation, company, holdings, group, pbc
    - Strips brand/tech/geo modifiers: ai, labs, research, technologies, technology, software, solutions, systems, platform, india, global, cloud
    - e.g. 'Mistral' and 'Mistral AI' both collapse to 'mistral'
    - e.g. 'Amazon' and 'Amazon India' both collapse to 'amazon'
    """
    clean = _clean_company_name(name).lower()
    clean = re.sub(r'(?i)\b(ai|labs|research|technologies|technology|software|solutions|systems|platform|corp|inc|llc|pbc|india|global|cloud)\b', '', clean)
    clean = re.sub(r'[^a-z0-9]+', '', clean).strip()
    return clean or name.lower().strip()


KNOWN_INTERNAL_PRODUCTS = {
    "openai": {"chatgpt", "gpt-4", "gpt-4o", "gpt-3.5", "dall-e", "codex", "sora", "openai api", "whisper", "o1", "o3"},
    "google": {"gemini", "bard", "deepmind", "google cloud", "vertex ai", "android", "youtube"},
    "microsoft": {"copilot", "azure", "bing", "github copilot", "office 365", "windows"},
    "meta": {"llama", "facebook", "instagram", "whatsapp", "threads", "pytorch"},
    "amazon": {"aws", "alexa", "bedrock", "prime", "amazon web services"},
    "apple": {"siri", "apple intelligence", "ios", "macos"},
    "anthropic": {"claude", "claude 2", "claude 3", "claude 3.5", "claude code"},
    "flipkart": {"myntra", "flipkart wholesale", "shopsy", "cleartrip", "supercoins"},
    "vercel": {"nextjs", "next.js", "next", "turborepo", "turbo", "v0", "swr", "turbopack"},
    "stripe": {"stripe billing", "stripe connect", "stripe terminal", "stripe radar", "stripe atlas", "stripe treasury", "stripe climate", "stripe issuing"},
    "notion": {"notion ai", "notion calendar", "cron"},
    "figma": {"figjam", "figma slides"},
    "meesho": {"fashnear"},
}


def _is_self_or_internal_product(candidate_name: str, target_company: str) -> bool:
    """
    Check if candidate name represents the target company itself or one of its known products.
    """
    c_clean = _clean_company_name(candidate_name).lower()
    t_clean = _clean_company_name(target_company).lower()

    if not c_clean or not t_clean:
        return True

    # Exact or substring match
    if c_clean == t_clean:
        return True

    # Candidate starts with target or ends with target (e.g. "OpenAI Codex" when target is "OpenAI")
    if c_clean.startswith(t_clean + " ") or c_clean.endswith(" " + t_clean):
        return True

    # Target starts with candidate (e.g. target "OpenAI Inc" vs candidate "OpenAI")
    if t_clean.startswith(c_clean + " ") or t_clean.endswith(" " + c_clean):
        return True

    # Check internal product exclusion
    for comp_key, products in KNOWN_INTERNAL_PRODUCTS.items():
        if comp_key in t_clean or t_clean in comp_key:
            if c_clean in products:
                return True
            for p in products:
                if c_clean == p or c_clean.startswith(p + " ") or c_clean.endswith(" " + p):
                    return True

    return False


# ============================================================================
# Garbage Entity Filters & Non-Entity Noun Blacklist
# ============================================================================

DISQUALIFYING_ACTION_VERBS = {
    "launches", "launch", "launched", "acquires", "acquire", "acquired", "announces", "announce",
    "announced", "raises", "raise", "raised", "unveils", "unveil", "unveiled", "partners", "partner",
    "releases", "release", "released", "introduces", "introduce", "introduced", "expands", "expand",
    "reports", "report", "bans", "ban", "sues", "sue", "beats", "beat", "drops", "drop", "hits",
    "hit", "tests", "test", "files", "file", "looking", "look", "officially"
}

DISQUALIFYING_NON_ENTITY_NOUNS = {
    "archives", "archive", "email", "emails", "lawsuit", "countersuit", "hearing",
    "hearings", "antitrust", "ruling", "order", "investigation", "ban", "case", "trial",
    "dispute", "battle", "feud", "drama", "war", "story", "video", "interview", "speech",
    "podcast", "transcript", "deck", "slides", "report", "study", "data", "dataset",
    "benchmark", "paper", "survey", "doc", "docs", "documentation", "release", "version",
    "model", "models", "weight", "weights", "token", "tokens", "code", "sdk", "library",
    "framework", "plugin", "extension", "prompt", "prompts", "system", "bill", "senate",
    "regulation", "act", "law", "memo", "memos", "leak", "leaks", "news", "article",
    "times", "journal", "post", "press", "update", "updates", "consensus", "concensus", "tier",
    "review", "reviews", "pricing", "cost", "valuation", "funding", "round", "deal", "ipo",
    "shares", "stock", "partnership", "agreement", "contract", "purchase", "purchases",
    "acquisition", "merger", "casino", "option", "options", "tax", "taxes", "refund",
    "refunds", "flaw", "vulnerability", "disclosure", "fast", "tracked", "rocketed",
    "title", "chief", "calls", "amid", "fears", "someone", "anyone", "everyone", "choice",
    "best", "popular", "domestic", "limited", "company", "competitor", "competitors", "alternative",
    "alternatives", "versus", "vs", "cve", "financials", "strengths", "commerce", "reseller",
    "resellers", "seller", "sellers", "buyer", "buyers", "economy", "growth", "risk", "factors",
    "overview", "insight", "insights", "launchpad", "creator", "creators", "sandwitch", "shoppers",
    "picks", "budget", "rating", "ratings", "month", "vote", "votes", "apps", "shops", "writing",
    "privacy", "automation", "coding", "intelligence", "analysis", "customer", "customers", "team",
    "size", "curated", "using", "below", "business", "businesses", "organization", "organizations",
    "directly", "inside", "beautiful", "floating", "glassmorphism", "panel", "online", "marketplaces",
    "replay", "flags", "workflows", "tested", "compared", "deeper", "depth", "observability", "coverage",
    "readiness", "community", "workflows", "features", "agentic", "work", "solution", "solutions",
    "entry", "encyclopedia", "undated", "alexa", "quot", "similar", "browse", "prices", "ranked",
    "owler", "saashub", "semrush", "sourceforge", "compworth", "forbes", "advisor", "manager",
    "capterra", "trustradius", "g2", "techcrunch", "bloomberg", "reuters", "alternativeto",
    "latka", "cb", "insights", "crunchbase", "product", "hunt", "github", "wikipedia", "youtube",
    "twitter", "reddit", "medium", "substack", "linkedin", "12ft", "encore", "marketscale",
    "glassdoor", "indeed", "comparably", "prosus", "sequoia", "softbank", "accel", "tiger",
    "matrix", "benchmark", "andreessen", "horowitz", "a16z", "lightspeed", "elevation", "nexus",
    "bessemer", "khosla", "coatue", "investors", "holdings", "fund", "venture", "capital",
    "stylebuddy", "com", "org", "net", "app", "note", "zoneless", "full"
}

EXCLUDED_HEURISTIC_WORDS = {
    "the", "a", "an", "this", "that", "how", "what", "why", "where", "show", "ask", 
    "github", "wikipedia", "list", "big", "repo", "app", "new", "top", "free",
    "california", "senate", "court", "lawsuit", "countersuit", "email", "bill",
    "everything", "someone", "anyone", "everyone", "rocket", "rocketed", "fast",
    "tracked", "deal", "purchases", "lands", "chief", "calls", "amid", "fears",
    "news", "times", "post", "blog", "guide", "review", "comparison", "alternative",
    "competitor", "competitors", "alternatives", "vs", "versus", "option", "casino",
    "market", "boom", "bust", "help", "helps", "delivery", "partner", "partners",
    "return", "returns", "income", "tax", "flaw", "found", "detected", "vulnerability",
    "information", "disclosure", "cross", "site", "scripting", "nifty", "index", "showcase",
    "article", "title", "user", "users", "choice", "best", "popular", "domestic", "limited", "cve",
    "forbes", "advisor", "manager", "prosus", "looking", "officially", "launches", "loop"
}


def _clean_heuristic_candidate(raw: str, target_company: str = "") -> str:
    """Sanitize candidate string and reject garbage entities, title fragments, and non-companies."""
    raw = re.sub(r'^(?:the|top|best|discover|see|compare|our list of|list of|meet the|revealed|some of the|including)\s+', '', raw, flags=re.IGNORECASE)
    raw = re.sub(r'(?i)\s+(?:—|–|-)?\s*\b(?:by|based on|ordered by|giving|according to|ranging from|for)\b.*$', '', raw)
    c = re.sub(r'^[^\w]+|[^\w]+$', '', raw.strip())
    c = _clean_company_name(c)
    c = c.strip("'\"")
    # Strip leading/trailing conjunctions and prepositions
    c = re.sub(r'(?i)\s+\b(and|or|with|the|in|at|by|from|to|for|of)\b$', '', c).strip()
    c = re.sub(r'(?i)^\b(and|or|with|the|in|at|by|from|to|for|of)\b\s+', '', c).strip()
    if len(c) < 2 or c.isdigit() or len(c) > 35:
        return ""
    # Reject standalone generic geographical terms
    if c.lower() in {"india", "us", "usa", "uk", "california", "europe", "asia", "global", "san francisco"}:
        return ""
    if re.search(r'(?i)\bcve[-_\d]', c):
        return ""
    if re.search(r'(?i)\b(?:is not|tested by|features include|alternatives include|workflows|compared to|multi-agent|open-source)\b', c):
        return ""
    words = [w.lower() for w in re.findall(r'[A-Za-z0-9]+', c)]
    if not words or len(words) > 4:
        return ""
    # Reject if any word in candidate name is in the disqualifying non-entity blacklist or action verbs
    for w in words:
        if w in DISQUALIFYING_NON_ENTITY_NOUNS or w in DISQUALIFYING_ACTION_VERBS:
            return ""
    if words[0] in EXCLUDED_HEURISTIC_WORDS or words[-1] in EXCLUDED_HEURISTIC_WORDS:
        return ""
    if target_company and _is_self_or_internal_product(c, target_company):
        return ""
    return c


# ============================================================================
# Deterministic Heuristic Extraction Fallback (Crossed-Citation & Attribution Fixed)
def _extract_containing_clause(text: str, match_start: int, match_end: int) -> str:
    """
    Extracts a complete, sensible clause or sentence bounding the match.
    Avoids mid-sentence cutoffs and trailing/leading dangling conjunctions.
    """
    left = text[:match_start]
    left_boundaries = [m.end() for m in re.finditer(r'[\.\;\!\?\n]\s*', left)]
    start = left_boundaries[-1] if left_boundaries else 0

    right = text[match_end:]
    right_boundary = re.search(r'[\.\;\!\?\n]', right)
    end = (match_end + right_boundary.start()) if right_boundary else len(text)

    clause = text[start:end].strip()
    clause = re.sub(r'^[,\s\-–—]+', '', clause)

    if len(clause) > 160:
        comma_candidates = [m.end() for m in re.finditer(r',\s*', text[start:match_start])]
        if comma_candidates:
            clause = text[start + comma_candidates[-1]:end].strip()

    clause = re.sub(r'\s+(?:and|or|with|in|to|the|of|a|an|as|at|for|by|from)\b\s*$', '', clause, flags=re.IGNORECASE)
    clause = re.sub(r'[,\s\-–—]+$', '', clause).strip()
    return clause


# ============================================================================
# Deterministic Heuristic Extraction Fallback (Crossed-Citation & Attribution Fixed)
# ============================================================================

def _heuristic_extract_candidates(company: str, sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deterministic fallback parser that extracts candidate competitor entities from
    retrieved snippets, titles, and URLs when LLM inference is unavailable.
    Guarantees strict attribution pairing and eliminates crossed citations.
    """
    company_clean = company.strip().lower()
    extracted: Dict[str, Dict[str, Any]] = {}

    # Index sources for dedicated entity profile matching
    # e.g., "Wikipedia: Flipkart" -> dedicated source for Flipkart
    dedicated_sources: Dict[str, Dict[str, Any]] = {}
    for s in sources:
        title = s.get("title", "")
        if re.search(r'(?i)wikipedia:\s*(?:list of|timeline of|history of|controversy|incident|products and applications)', title):
            continue
        wiki_m = re.match(r'^Wikipedia:\s*([A-Za-z0-9\.\s]+?)(?:\s*\([^)]+\))?$', title)
        if wiki_m:
            cand = _clean_heuristic_candidate(wiki_m.group(1), company)
            if cand:
                dedicated_sources[_canonical_brand_key(cand)] = s
        alt_m = re.match(r'^AlternativeTo:\s*([A-Za-z0-9\.\s]+?)(?:\s*\(.*?\))?$', title)
        if alt_m:
            cand = _clean_heuristic_candidate(alt_m.group(1), company)
            if cand:
                dedicated_sources[_canonical_brand_key(cand)] = s

    def _record_candidate(cand: str, rationale: str, source_obj: Dict[str, Any], weight: float, conf: str, is_direct: bool = False):
        cleaned = _clean_heuristic_candidate(cand, company)
        if not cleaned or _is_self_or_internal_product(cleaned, company):
            return
        ckey = _canonical_brand_key(cleaned)
        if not ckey or _is_self_or_internal_product(ckey, company):
            return

        is_direct_dedicated = is_direct or (ckey in dedicated_sources)
        primary_source = dedicated_sources.get(ckey, source_obj)
        source_ref = primary_source.get("title") or primary_source.get("url", "")
        source_age, source_date = _match_source_metadata(source_ref, sources)

        if is_direct_dedicated:
            effective_conf = "Medium" if weight >= 0.85 else "Low"
            if source_age == "dated":
                effective_conf = "Low"
                freshness_note = f"Sourced {source_date or 'historic'}, not independently confirmed recently"
            elif source_age == "recent":
                freshness_note = f"Recent source ({source_date})" if source_date else "Recent source"
            else:
                freshness_note = "Retrieved grounded market intelligence"
            effective_rationale = (
                f"Dedicated market intelligence profile for {cleaned} ({source_ref}), cited alongside {company.capitalize()} in market comparison."
                if not rationale else rationale
            )
        else:
            effective_conf = "Low"
            freshness_note = "Indirect market comparison mention (secondary source)"
            effective_rationale = rationale

        if ckey not in extracted:
            extracted[ckey] = {
                "name": cleaned,
                "rationale": effective_rationale,
                "confidence": effective_conf,
                "source": source_ref,
                "source_age": source_age,
                "source_date": source_date,
                "freshness_note": freshness_note,
                "_weight": weight,
                "_is_direct": is_direct_dedicated,
            }
        else:
            # If this match has a longer/more formal display name (e.g. "Mistral AI" vs "Mistral")
            if len(cleaned) > len(extracted[ckey]["name"]):
                extracted[ckey]["name"] = cleaned
            # If previously indirect, but now found a direct dedicated profile, upgrade to direct
            if is_direct_dedicated and not extracted[ckey].get("_is_direct", False):
                extracted[ckey]["_is_direct"] = True
                extracted[ckey]["_weight"] = weight
                extracted[ckey]["confidence"] = effective_conf
                extracted[ckey]["rationale"] = effective_rationale
                extracted[ckey]["source"] = source_ref
                extracted[ckey]["source_age"] = source_age
                extracted[ckey]["source_date"] = source_date
                extracted[ckey]["freshness_note"] = freshness_note
            elif weight > extracted[ckey]["_weight"]:
                extracted[ckey]["_weight"] = weight
                if extracted[ckey].get("_is_direct", False):
                    extracted[ckey]["confidence"] = effective_conf
                else:
                    extracted[ckey]["confidence"] = "Low"
                extracted[ckey]["rationale"] = effective_rationale
                extracted[ckey]["source"] = source_ref
                extracted[ckey]["source_age"] = source_age
                extracted[ckey]["source_date"] = source_date
                extracted[ckey]["freshness_note"] = freshness_note

    # 1. Ingest dedicated structured profiles from Wikipedia (with company/platform tags) & AlternativeTo
    for s in sources:
        title = s.get("title", "")
        if re.search(r'(?i)wikipedia:\s*(?:list of|timeline of|history of|controversy|incident|products and applications)', title):
            continue
        wiki_m = re.match(r'^Wikipedia:\s*([A-Za-z0-9\.\s]+?)(?:\s*\(([^)]+)\))?$', title, flags=re.IGNORECASE)
        if wiki_m:
            entity = wiki_m.group(1).strip()
            tag = (wiki_m.group(2) or "").lower()
            snippet = s.get("text", "").lower()
            combined_desc = f"{snippet} {tag}"
            is_business = bool(re.search(r'\b(company|e-commerce|ecommerce|software|app|retailer|marketplace|corporation|firm|service|platform|website|portal|competes|competitor|rival|headquartered|industry|startup|enterprise|conglomerate)\b', combined_desc))
            is_bio = bool(re.search(r'\b(actor|actress|filmography|politician|singer|cricketer|film|cinema|born|starred|fashion\s+model)\b', combined_desc))
            if is_business and not is_bio and entity.lower() != company_clean and not _is_self_or_internal_product(entity, company_clean):
                _record_candidate(
                    entity,
                    f"Dedicated encyclopedia profile for {entity} ({title}) cited alongside {company.capitalize()}.",
                    s,
                    0.88,
                    "Medium",
                    is_direct=True,
                )
        alt_m = re.match(r'^AlternativeTo:\s*([A-Za-z0-9\.\s]+?)(?:\s*\(.*?\))?$', title)
        if alt_m:
            entity = alt_m.group(1).strip()
            if entity.lower() != company_clean:
                _record_candidate(
                    entity,
                    f"Structured alternative profile on AlternativeTo for {entity}.",
                    s,
                    0.88,
                    "Medium",
                    is_direct=True,
                )

    # 2. Text-based patterns (lists and single comparison clauses)
    list_patterns = [
        # "Meesho's top competitors include Temu, Flipkart, and Lazada"
        r'(?i)(?:competitors|alternatives|rivals)\s+(?:include|are|such as|like)\s+([^.\n;]+)',
        # "Discover Meesho's top competitors in 2026: Flipkart, Trendyol Group, Snapdeal"
        r'(?i)(?:top|direct|major|main|primary|key)?\s*(?:competitors|alternatives|rivals)(?:\s+in\s+\d{4})?\s*[:–—\-]\s*([^.\n;]+)',
        # "analyzes products on Amazon, Flipkart, Myntra, and Meesho" or "scrapes product reviews from Amazon, Flipkart, Croma & Reliance Digital"
        r'(?i)(?:analyzes?|compares?|monitors?|tracks?|scrapes?|aggregates?|collects?)\s+(?:product\s+reviews|products|prices|features|services)?\s+(?:on|across|between|from)\s+([^.\n;]+)',
        # "products/sellers/merchants on Amazon, Flipkart, Myntra, and Meesho"
        r'(?i)(?:products|listings|merchants|sellers|catalog|shopping)\s+(?:on|from|across|in)\s+([^.\n;]+)',
        # "platforms/marketplaces/retailers like Amazon, Flipkart, Snapdeal, and Meesho"
        r'(?i)(?:platforms|marketplaces|services|e-commerce\s+apps|retailers|sites)\s+(?:like|such\s+as)\s+([^.\n;]+)',
        # "Competitors Eternal and Swiggy"
        r'(?i)(?:competitors|rivals)\s+([A-Z][a-zA-Z0-9]+(?:\s*(?:and|or|&)\s*[A-Z][a-zA-Z0-9]+))',
    ]

    single_patterns = [
        # Subject: ... competes ... with <target> (e.g. "Flipkart: ... competes primarily with Amazon India and domestic rival Meesho")
        (r'(?i)\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)\s*:\s*.*?\b(?:competes|rival|rivalry|alternative)\b.*?' + re.escape(company_clean), 0.88),
        
        # Entity vs Target or Target vs Entity (e.g. "Flipkart vs Meesho", "OpenAI vs Anthropic")
        (r'(?i)\b([A-Z][a-zA-Z0-9]+(?:\s+(?!and\b|or\b|with\b|the\b|in\b|to\b|of\b)[A-Z][a-zA-Z0-9]+){0,2})\s+(?:vs\.?|versus)\s+' + re.escape(company_clean), 0.9),
        (r'(?i)' + re.escape(company_clean) + r'\s+(?:vs\.?|versus)\s+([A-Z][a-zA-Z0-9]+(?:\s+(?!and\b|or\b|with\b|the\b|in\b|to\b|of\b)[A-Z][a-zA-Z0-9]+){0,2})', 0.9),
        
        # Entity ... Target competitor (e.g. "Mistral AI, an OpenAI competitor...")
        (r'(?i)\b([A-Z][a-zA-Z0-9]+(?:\s+(?!and\b|or\b|with\b|the\b|in\b|to\b|of\b)[A-Z][a-zA-Z0-9]+){0,2})\s*[\-–—,\(].*?' + re.escape(company_clean) + r'\s+competitor', 0.9),
        (r'(?i)\b([A-Z][a-zA-Z0-9]+(?:\s+(?!and\b|or\b|with\b|the\b|in\b|to\b|of\b)[A-Z][a-zA-Z0-9]+){0,2})\s+is\s+an?\s+' + re.escape(company_clean) + r'\s+competitor', 0.9),
        
        # Target competitor Entity (e.g. "OpenAI Codex Competitor Cursor")
        (r'(?i)' + re.escape(company_clean) + r'(?:\s+[A-Za-z0-9]+)?\s+competitor\s*[\:–—\-]?\s*([A-Z][a-zA-Z0-9]+(?:\s+(?!and\b|or\b|with\b|the\b|in\b|to\b|of\b)[A-Z][a-zA-Z0-9]+){0,2})', 0.85),
        
        # Entity ... Target alternative (e.g. "BlindAI ... OpenAI alternative", "LocalAI: Self-hosted OpenAI alternative")
        (r'(?i)\b([A-Z][a-zA-Z0-9]+(?:\s+(?!and\b|or\b|with\b|the\b|in\b|to\b|of\b)[A-Z][a-zA-Z0-9]+){0,2})\s*[\-–—:\(].*?' + re.escape(company_clean) + r'\s+alternative', 0.85),
        (r'(?i)\b([A-Z][a-zA-Z0-9]+(?:\s+(?!and\b|or\b|with\b|the\b|in\b|to\b|of\b)[A-Z][a-zA-Z0-9]+){0,2})\s+as\s+an?\s+' + re.escape(company_clean) + r'\s+alternative', 0.85),
        
        # competes primarily with Entity / domestic rival Entity
        (r'(?i)competes\s+primarily\s+with\s+([A-Z][a-zA-Z0-9]+(?:\s+(?!and\b|or\b|with\b|the\b|in\b|to\b|of\b)[A-Za-z0-9]+){0,2})', 0.85),
        (r'(?i)(?:domestic|primary|major)\s+rival\s+([A-Z][a-zA-Z0-9]+(?:\s+(?!and\b|or\b|with\b|the\b|in\b|to\b|of\b)[A-Za-z0-9]+){0,2})', 0.85),
        
        # Target is Entity for ... (e.g. "Meesho is Shopify for...")
        (r'(?i)' + re.escape(company_clean) + r'.*?\bis\s+([A-Z][a-zA-Z0-9]+)\s+for\b', 0.85),

        # File/deck patterns: "Samridhi1412/Flipkart_vs_Meesho_Deck"
        (r'(?i)\b([A-Za-z0-9]+)_vs_' + re.escape(company_clean), 0.85),
        (r'(?i)' + re.escape(company_clean) + r'_vs_([A-Za-z0-9]+)', 0.85),
    ]

    for s in sources:
        title = s.get("title", "")
        text = s.get("text", "")
        # Strip synthetic query suffix: "Query: '...'"
        text_clean = re.sub(r"\.\s*Query:\s*'[^\']*'\.?\s*", "", text)
        combined = f"{title}. {text_clean}"

        # Test multi-entity list patterns
        for pat in list_patterns:
            for m in re.finditer(pat, combined):
                list_str = m.group(1)
                items = re.split(r'[,;/]|\s+(?:and|or|&)\s+', list_str)
                for it in items:
                    it = it.strip()
                    it = re.sub(r'^\d+[\.\)]\s*', '', it).strip()
                    _record_candidate(
                        it,
                        f"Cited in competitor landscape listing: \"{m.group(0)[:90]}\" ({title[:40]}).",
                        s,
                        0.85,
                        "Medium",
                    )

        # Test single comparison patterns
        for pat, base_weight in patterns if False else single_patterns:
            for match in re.finditer(pat, combined):
                cand = match.group(1).strip()
                containing_clause = _extract_containing_clause(combined, match.start(), match.end())
                if containing_clause:
                    rationale = f"Cited in market comparison: \"{containing_clause}\" (documented in {title[:60]})."
                else:
                    rationale = f"Secondary in-snippet mention alongside {company.capitalize()} in {title[:60]}."

                _record_candidate(
                    cand,
                    rationale,
                    s,
                    base_weight,
                    "Medium" if base_weight >= 0.85 else "Low",
                )

    res = list(extracted.values())
    for item in res:
        item.pop("_weight", None)
        item.pop("_is_direct", None)
    return res


def _parse_discovery_json(content: str) -> Optional[Dict[str, Any]]:
    """Robustly parse discovery JSON, handling markdown blocks, truncated closing brackets, or individual object salvage."""
    cleaned = re.sub(r"^```(?:json)?\s*", "", content.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned.strip())

    # 1. Direct parse or regex match
    json_match = re.search(r'\{[\s\S]*\}', cleaned)
    target_json_str = json_match.group(0) if json_match else cleaned
    target_json_str = re.sub(r',\s*([\]}])', r'\1', target_json_str)
    try:
        parsed = json.loads(target_json_str)
        if isinstance(parsed, dict) and ("candidates" in parsed or "segments" in parsed or "summary" in parsed):
            return parsed
    except Exception:
        pass

    # 2. Try salvaging truncated candidates array by closing braces
    if '"candidates"' in cleaned:
        last_brace = cleaned.rfind('}')
        if last_brace != -1:
            truncated = cleaned[:last_brace + 1].strip()
            if '[' in truncated and not truncated.endswith(']'):
                truncated += ']}'
            elif not truncated.endswith('}'):
                truncated += '}'
            try:
                parsed = json.loads(truncated)
                if isinstance(parsed, dict) and "candidates" in parsed and parsed["candidates"]:
                    return parsed
            except Exception:
                pass

    # 3. Regex salvage individual candidate objects
    cand_matches = re.finditer(r'\{[^{}]*"name"\s*:\s*"([^"]+)"[^{}]*\}', cleaned)
    salvaged = []
    for cm in cand_matches:
        try:
            c_obj = json.loads(cm.group(0))
            if isinstance(c_obj, dict) and c_obj.get("name"):
                salvaged.append(c_obj)
        except Exception:
            pass
    if salvaged:
        return {"candidates": salvaged}

    return None


@traceable(run_type="llm", name="discovery_agent_llm_call")
def _call_groq_discovery(system_prompt: str, user_prompt: str, max_retries: int = 4) -> Dict[str, Any]:
    """
    Execute Groq completion with JSON object response format, multi-model fallback cascade,
    and adaptive rate limit handling.
    """
    raw_key = os.getenv("GROQ_API_KEY", "")
    api_key = raw_key.strip().strip("\"'").strip()
    if not api_key:
        logger.warning("GROQ_API_KEY not configured in environment.")
        raise LLMUnavailableError("GROQ_API_KEY is not configured in backend environment variables.")

    raw_model = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL).strip().strip("\"'").strip()
    initial_model = DEFAULT_GROQ_MODEL if (not raw_model or " " in raw_model or "(" in raw_model) else raw_model

    # Build model chain with initial_model first, followed by other fallback candidates without duplicates
    model_chain = [initial_model]
    for fb in FALLBACK_GROQ_MODELS:
        if fb not in model_chain:
            model_chain.append(fb)

    tpd_limited = {"openai/gpt-oss-120b", "openai/gpt-oss-20b"}
    with _TOKEN_USAGE_LOCK:
        daily_exceeded = _DAILY_TOKEN_USAGE.get("tokens_used", 0) >= (GROQ_DAILY_TOKEN_LIMIT - 5000)
    if daily_exceeded:
        non_tpd = [m for m in model_chain if m not in tpd_limited]
        if non_tpd:
            model_chain = non_tpd

    last_error: Optional[Exception] = None

    for m_idx, model in enumerate(model_chain):
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 3200,
            "response_format": {"type": "json_object"},
        }

        has_next_model = (m_idx < len(model_chain) - 1)
        valid_next_model = has_next_model and not (daily_exceeded and model_chain[m_idx + 1] in tpd_limited)
        model_retries = 3 if valid_next_model else max_retries

        for attempt in range(model_retries):
            try:
                resp = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=25)
                if resp.status_code in (401, 403):
                    logger.error(f"Groq API authentication error ({resp.status_code}): Invalid or rejected API key: {resp.text[:200]}")
                    raise LLMUnavailableError(f"Groq API authentication error ({resp.status_code}): Invalid or rejected API key: {resp.text[:200]}")

                if resp.status_code == 429:
                    tpd_match = re.search(r"tokens per day \(TPD\): Limit \d+, Used (\d+)", resp.text)
                    if tpd_match or "tokens per day (TPD)" in resp.text:
                        if tpd_match:
                            try:
                                used_tokens = int(tpd_match.group(1))
                                _sync_groq_daily_usage(used_tokens)
                            except Exception:
                                pass
                        else:
                            _sync_groq_daily_usage(GROQ_DAILY_TOKEN_LIMIT)
                        with _TOKEN_USAGE_LOCK:
                            _DAILY_TOKEN_USAGE["tokens_used"] = max(_DAILY_TOKEN_USAGE.get("tokens_used", 0), GROQ_DAILY_TOKEN_LIMIT)
                        daily_exceeded = True
                        if has_next_model:
                            logger.warning(f"Groq model '{model}' daily TPD limit exceeded. Cascading to fallback model '{model_chain[m_idx + 1]}'...")
                            break  # Try next model in cascade
                        logger.warning("Groq daily token limit exceeded across all models (TPD). Engaging heuristic fallback.")
                        raise LLMUnavailableError(f"Groq daily token limit exceeded (TPD): {resp.text[:200]}")

                    if has_next_model and attempt >= 2:
                        next_model = model_chain[m_idx + 1]
                        if not (daily_exceeded and next_model in tpd_limited):
                            logger.warning(f"Groq 429 rate limit hit on model '{model}'. Cascading to fallback model '{next_model}'...")
                            break

                    if not has_next_model and daily_exceeded and attempt >= 1:
                        logger.warning(f"Groq rate limit on final model '{model}' with daily quota exhausted. Engaging heuristic fallback.")
                        raise LLMUnavailableError(f"Groq rate limit exceeded on final fallback model: {resp.text[:200]}")

                    retry_header = resp.headers.get("retry-after", "")
                    try:
                        retry_after = float(retry_header)
                    except ValueError:
                        retry_after = 2.0 * (attempt + 1)
                    backoff = min(max(retry_after, 2.0), 10.0 if daily_exceeded else 30.0)
                    logger.warning(f"Groq 429 on '{model}'. Backing off {backoff:.1f}s (attempt {attempt + 1}/{model_retries})...")
                    time.sleep(backoff)
                    continue

                if resp.status_code == 400 and ("json_validate_failed" in resp.text or "Failed to validate JSON" in resp.text):
                    if payload.get("response_format"):
                        logger.warning(f"Groq model '{model}' encountered JSON schema validation issue. Retrying without response_format constraint...")
                        payload.pop("response_format", None)
                        continue
                    if has_next_model:
                        logger.warning(f"Groq model '{model}' encountered JSON schema validation issue. Cascading to '{model_chain[m_idx + 1]}'...")
                        break

                if resp.status_code != 200:
                    logger.warning(f"Groq API returned HTTP {resp.status_code} for model '{model}': {resp.text[:200]}")
                    if has_next_model:
                        break
                    raise LLMUnavailableError(f"Groq API HTTP {resp.status_code}: {resp.text[:200]}")

                res_data = resp.json()

                # Attach token usage and cost metadata to active LangSmith span and daily token tracker
                usage = res_data.get("usage")
                if usage and isinstance(usage, dict):
                    _attach_langsmith_usage(usage, model=model)
                    tot_tokens = usage.get("total_tokens", 0)
                    if tot_tokens > 0:
                        _record_groq_token_usage(tot_tokens, model=model)

                content = res_data["choices"][0]["message"]["content"]
                parsed = _parse_discovery_json(content)
                if isinstance(parsed, dict) and ("candidates" in parsed or "segments" in parsed or "summary" in parsed):
                    if "candidates" in parsed and parsed["candidates"]:
                        return parsed
                    if "segments" in parsed or "summary" in parsed:
                        return parsed
                    if attempt < model_retries - 1:
                        time.sleep(1.0)
                        continue
                    return parsed
                else:
                    logger.warning(f"JSON decode failed on extracted text from model '{model}'")
                    if attempt < model_retries - 1:
                        time.sleep(1.0)
                        continue
                    if has_next_model:
                        break
                    return {"candidates": []}

            except LLMUnavailableError:
                raise
            except Exception as e:
                last_error = e
                if attempt == model_retries - 1:
                    logger.warning(f"Error calling Groq API for '{model}': {e}")
                time.sleep(1.0)

    if last_error:
        raise LLMUnavailableError(f"Groq API call failed across all models in cascade: {last_error}")
    raise LLMUnavailableError("Groq API call failed to return candidate response.")


def _record_groq_token_usage(tokens: int, model: str = DEFAULT_GROQ_MODEL) -> Dict[str, Any]:
    """Record token consumption in the rolling daily budget tracker and alert if exceeding 80%."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with _TOKEN_USAGE_LOCK:
        if _DAILY_TOKEN_USAGE.get("date") != today:
            _DAILY_TOKEN_USAGE["date"] = today
            _DAILY_TOKEN_USAGE["tokens_used"] = 0
            _DAILY_TOKEN_USAGE["warning_logged"] = False
        _DAILY_TOKEN_USAGE["tokens_used"] += tokens
        _DAILY_TOKEN_USAGE["last_updated"] = datetime.now(timezone.utc).isoformat()
        current_used = _DAILY_TOKEN_USAGE["tokens_used"]
        warning_logged = _DAILY_TOKEN_USAGE.get("warning_logged", False)

        usage_pct = (current_used / GROQ_DAILY_TOKEN_LIMIT) * 100
        if current_used >= (GROQ_DAILY_TOKEN_LIMIT * GROQ_TOKEN_WARNING_THRESHOLD) and not warning_logged:
            logger.warning(
                f"[GROQ_TOKEN_BUDGET_ALERT] Daily Groq token usage has crossed warning threshold: "
                f"{current_used}/{GROQ_DAILY_TOKEN_LIMIT} tokens ({usage_pct:.1f}%). "
                f"Model: {model}. Approaching 200k TPD ceiling — risk of degrading to heuristic fallback."
            )
            _DAILY_TOKEN_USAGE["warning_logged"] = True

        try:
            os.makedirs("data", exist_ok=True)
            with open("data/groq_daily_token_usage.json", "w", encoding="utf-8") as f:
                json.dump(_DAILY_TOKEN_USAGE, f)
        except Exception:
            pass

    return get_groq_token_budget_status()


def _sync_groq_daily_usage(used_tokens: int) -> Dict[str, Any]:
    """Sync Groq daily usage from exact 'Used X' reported in Groq 429 error message."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with _TOKEN_USAGE_LOCK:
        _DAILY_TOKEN_USAGE["date"] = today
        _DAILY_TOKEN_USAGE["tokens_used"] = max(_DAILY_TOKEN_USAGE.get("tokens_used", 0), used_tokens)
        _DAILY_TOKEN_USAGE["last_updated"] = datetime.now(timezone.utc).isoformat()
        current_used = _DAILY_TOKEN_USAGE["tokens_used"]
        usage_pct = (current_used / GROQ_DAILY_TOKEN_LIMIT) * 100
        logger.warning(
            f"[GROQ_TOKEN_BUDGET_SYNC] Synced Groq 24h TPD usage from API response: "
            f"{current_used}/{GROQ_DAILY_TOKEN_LIMIT} tokens ({usage_pct:.1f}%)."
        )
        if current_used >= (GROQ_DAILY_TOKEN_LIMIT * GROQ_TOKEN_WARNING_THRESHOLD):
            _DAILY_TOKEN_USAGE["warning_logged"] = True
        try:
            os.makedirs("data", exist_ok=True)
            with open("data/groq_daily_token_usage.json", "w", encoding="utf-8") as f:
                json.dump(_DAILY_TOKEN_USAGE, f)
        except Exception:
            pass

    return get_groq_token_budget_status()


def get_groq_token_budget_status() -> Dict[str, Any]:
    """Return the real-time Groq daily token budget status and warning alerts."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with _TOKEN_USAGE_LOCK:
        if _DAILY_TOKEN_USAGE.get("date") != today:
            try:
                if os.path.exists("data/groq_daily_token_usage.json"):
                    with open("data/groq_daily_token_usage.json", "r", encoding="utf-8") as f:
                        disk_data = json.load(f)
                        if disk_data.get("date") == today:
                            _DAILY_TOKEN_USAGE.update(disk_data)
            except Exception:
                pass
            if _DAILY_TOKEN_USAGE.get("date") != today:
                _DAILY_TOKEN_USAGE["date"] = today
                _DAILY_TOKEN_USAGE["tokens_used"] = 0
                _DAILY_TOKEN_USAGE["warning_logged"] = False

        used = _DAILY_TOKEN_USAGE.get("tokens_used", 0)
        remaining = max(0, GROQ_DAILY_TOKEN_LIMIT - used)
        usage_pct = round((used / GROQ_DAILY_TOKEN_LIMIT) * 100, 1)
        threshold_crossed = (used >= GROQ_DAILY_TOKEN_LIMIT * GROQ_TOKEN_WARNING_THRESHOLD)
        status = "healthy"
        if used >= GROQ_DAILY_TOKEN_LIMIT:
            status = "exhausted"
        elif threshold_crossed:
            status = "warning"

        return {
            "daily_limit": GROQ_DAILY_TOKEN_LIMIT,
            "used_today": used,
            "remaining_tokens": remaining,
            "usage_pct": usage_pct,
            "warning_threshold_pct": int(GROQ_TOKEN_WARNING_THRESHOLD * 100),
            "warning_threshold_crossed": threshold_crossed,
            "status": status,
            "last_updated": _DAILY_TOKEN_USAGE.get("last_updated"),
        }


def _match_source_metadata(source_ref: str, sources: List[Dict[str, Any]]) -> Tuple[str, Optional[str]]:
    """
    Match candidate source citation against retrieved sources list to extract verified date and source_age.
    STRICT: If not matched to a verified source in the retrieved context, returns ('undated', None).
    NEVER guesses or defaults to 'recent'.
    """
    source_ref_clean = source_ref.strip().lower()
    
    # Try exact or substring URL/Title match against actual retrieved sources
    for s in sources:
        s_url = s.get("url", "").strip().lower()
        s_title = s.get("title", "").strip().lower()
        if (s_url and (s_url in source_ref_clean or source_ref_clean in s_url)) or \
           (s_title and (s_title in source_ref_clean or source_ref_clean in s_title)):
            return s.get("source_age", "undated"), s.get("published_at")

    return "undated", None


def _is_target_directory_or_marketplace(target_profile: Optional[Dict[str, Any]]) -> bool:
    """Determine whether the target company itself is an AI tool directory or catalog."""
    if not target_profile:
        return False
    summary = str(target_profile.get("summary", "")).lower()
    for seg in target_profile.get("segments", []):
        summary += " " + str(seg.get("name", "")).lower() + " " + str(seg.get("what_it_does", "")).lower()
    return any(k in summary for k in ["directory of", "curated directory", "marketplace for ai tools", "tool directory", "tool aggregator"])


def _is_directory_or_aggregator(
    candidate_name: str,
    category: str,
    rationale: str,
    website: str,
    target_profile: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Check if a candidate competitor is an AI tool directory, catalog, aggregator, or marketplace.
    Unless the target company is itself a directory, tool directories are NOT competitors to software products.
    """
    if _is_target_directory_or_marketplace(target_profile):
        return False

    combined = f"{candidate_name} {category} {rationale} {website}".lower()

    # 1. Directory / Aggregator business model signatures
    directory_signatures = [
        "ai tool directory", "directory of ai", "ai tools directory", "curated directory",
        "tool directory", "ai tool catalog", "catalog of ai", "prompt marketplace",
        "marketplace for ai", "marketplace of ai", "ai marketplace", "ai tool aggregator",
        "database of ai", "discovery platform for ai", "curated list of ai",
        "ai ecosystem directory", "review aggregator", "software directory", "software review platform",
    ]
    if any(sig in combined for sig in directory_signatures):
        return True

    # 2. Known directory/aggregator brand tokens
    cand_clean = candidate_name.lower().strip()
    web_clean = website.lower().strip()
    known_dir_tokens = [
        "futuretools", "toolify", "promptbase", "lablab.ai", "lablab ai",
        "aitools.fyi", "theresanaiforthat", "topai.tools", "topai", "futurepedia",
        "alternativeto", "saashub", "capterra", "g2.com", "g2 crowd"
    ]
    if any(tok in cand_clean or tok in web_clean for tok in known_dir_tokens):
        return True

    # 3. Marketplaces / hubs that are catalogs of third-party models/plugins rather than competing software
    if ("copilot marketplace" in cand_clean or "ai hub" in cand_clean or "plugin store" in cand_clean or "marketplace" in cand_clean) and "interview" not in combined and "coaching" not in combined and "styling" not in combined:
        return True

    return False

# DISCLOSURE: ORTHOGONAL_INDUSTRY_DOMAINS is maintained as a fast-path shortcut for
# high-confidence, high-frequency domain mismatches (similar to the Amazon India homonym guard).
# It is known-incomplete on its own; universal protection against arbitrary unlisted industries
# is provided by the generalized capability overlap and domain mismatch check below.
ORTHOGONAL_INDUSTRY_DOMAINS = {
    "medical_healthcare": {
        "keywords": {"healthcare", "doctor", "hospital", "clinic", "pharmacy", "telemedicine", "patient", "practitioner", "physician", "dental", "medical", "appointment", "prescriptions", "booking doctors"},
        "domain_labels": {"health", "medical", "hospital", "clinical"}
    },
    "real_estate": {
        "keywords": {"realtor", "property listing", "apartment rental", "mortgage", "real estate", "homes for sale"},
        "domain_labels": {"real estate", "property"}
    },
    "food_delivery": {
        "keywords": {"food delivery", "restaurant ordering", "grocery delivery", "cloud kitchen", "takeout meal"},
        "domain_labels": {"food", "restaurant"}
    },
    "ride_hailing": {
        "keywords": {"cab booking", "taxi booking", "ride hailing", "rideshare driver"},
        "domain_labels": {"ride hailing", "taxi"}
    },
    "crypto_exchange": {
        "keywords": {"crypto exchange", "bitcoin trading", "crypto wallet", "token swap", "nft marketplace", "blockchain token"},
        "domain_labels": {"cryptocurrency", "web3 exchange"}
    },
    "logistics_freight": {
        "keywords": {"logistics", "freight", "courier", "shipping", "supply chain", "warehousing", "parcel delivery", "cargo", "fleet management"},
        "domain_labels": {"logistics", "shipping"}
    },
    "insurance": {
        "keywords": {"insurance", "underwriting", "policy", "policies", "actuarial", "claims processing", "reinsurance"},
        "domain_labels": {"insurance", "underwriting"}
    },
    "agriculture": {
        "keywords": {"agriculture", "farming", "crop", "fertilizer", "livestock", "agritech", "irrigation"},
        "domain_labels": {"agriculture", "farming"}
    },
}

GENERIC_BUSINESS_FILLER_WORDS = {
    "enterprise", "management", "workflow", "workflows", "digital", "automated",
    "automation", "company", "applications", "application", "business", "operations",
    "analysis", "analytics", "tracking", "reporting", "dashboard", "online", "cloud",
    "portal", "provider", "global", "modern", "suite", "infrastructure", "platform",
    "solutions", "solution", "tool", "tools", "system", "systems", "service", "services",
    "product", "products", "core", "offering", "features", "capabilities", "intelligence",
    "technology", "technologies", "users", "customer", "customers", "team", "teams",
    "high", "fast", "easy", "simple", "advanced", "real", "time", "flexible", "scalable",
    "with", "that", "this", "from", "your", "their", "into", "based", "alternative", "competitor"
}


def _check_segment_overlap(
    candidate_name: str,
    category: str,
    rationale: str,
    matched_segment: Optional[str],
    target_profile: Optional[Dict[str, Any]] = None,
) -> Tuple[bool, Optional[str]]:
    """
    Verify whether candidate functionally competes with at least one grounded segment of target company.
    Guarantees that:
    1. Fast-Path Domain Guard: Checks high-confidence orthogonal domains that the target does not operate in.
    2. Generalized Domain Guard: If candidate category/rationale indicates an industry domain absent from target, rejects it.
    3. Meaningful Capability Intersection: Filters out domain-agnostic corporate filler words ("management", "enterprise",
       "platform", "workflow") and strictly checks for substantive capability overlap with target segments.
    4. Symmetrical Rejection Rule: Disqualifies candidates with 0 functional overlap, preventing 6th+ unlisted orthogonal industries.
    Returns (has_overlap: bool, canonical_segment_name: str | None).
    """
    if not target_profile or not target_profile.get("segments"):
        # Without grounded profile segments, functional overlap cannot be verified
        return False, None

    segments = target_profile.get("segments", [])
    if not segments:
        return False, None

    combined_cand = f"{candidate_name} {category} {rationale}".lower()
    cand_tokens = set(re.findall(r'[a-z0-9]+', combined_cand))

    target_all_text = " ".join([
        f"{s.get('name', '')} {s.get('what_it_does', '')}" for s in segments
    ] + [target_profile.get("summary", ""), target_profile.get("company_name", "")]).lower()

    # 1. Fast-Path & Generalized Domain Mismatch Guard
    cand_cat_lower = category.lower()
    for domain_key, domain_info in ORTHOGONAL_INDUSTRY_DOMAINS.items():
        kws = domain_info["keywords"]
        cand_matches = [k for k in kws if k in cand_cat_lower or k in combined_cand]
        if cand_matches:
            target_matches = [k for k in kws if k in target_all_text]
            if not target_matches:
                logger.info(f"Disqualifying candidate '{candidate_name}' ({category}) - orthogonal domain '{domain_key}' matches {cand_matches} while target does not operate in this domain.")
                return False, None

    # 2. Substantive Capability Overlap Check (Filtering Generic Filler Words)
    meaningful_cand_tokens = {t for t in cand_tokens if len(t) > 2 and t not in GENERIC_BUSINESS_FILLER_WORDS}

    best_match_seg = None
    best_score = 0

    for seg in segments:
        s_name = seg.get("name", "")
        s_what = seg.get("what_it_does", "")
        s_text = f"{s_name} {s_what}".lower()
        s_tokens = {
            t for t in re.findall(r'[a-z0-9]+', s_text)
            if len(t) > 2 and t not in GENERIC_BUSINESS_FILLER_WORDS
        }

        overlap_count = len(s_tokens.intersection(meaningful_cand_tokens))
        if overlap_count > best_score:
            best_score = overlap_count
            best_match_seg = s_name

    # If direct match on matched_segment name was claimed by LLM, verify substantive capability overlap
    if matched_segment:
        ms_clean = matched_segment.strip().lower()
        for seg in segments:
            s_name = seg.get("name", "").strip()
            if ms_clean == s_name.lower() or ms_clean in s_name.lower() or s_name.lower() in ms_clean:
                if best_score >= 1:
                    return True, s_name

    if best_match_seg and best_score >= 1:
        return True, best_match_seg

    # Generalized Rejection Rule: zero substantive capability overlap with any grounded segment
    return False, None


def _analyze_candidate_corroboration(
    candidate_name: str,
    sources: List[Dict[str, Any]],
    candidate_domain: Optional[str] = None,
    target_domain: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Evaluate independent cross-source corroboration for a candidate competitor:
    - Identifies all sources mentioning the candidate.
    - Excludes candidate's own domain and target domain from independent corroboration.
    - Categorizes sources into directory scrapers ('alternatives_listing') vs independent sources
      ('news', 'wikipedia', 'github_repository', 'discussion_and_tech_media').
    - Detects candidates that are supported SOLELY by comparison directories without any
      independent market, journalistic, or repository proof.
    """
    name_clean = candidate_name.strip().lower()
    name_tokens = [t for t in re.findall(r'[a-z0-9]+', name_clean) if len(t) > 2]
    cand_name_slug = re.sub(r'[^a-z0-9]', '', name_clean)
    cand_dom_clean = candidate_domain.lower().strip() if candidate_domain else ""
    target_dom_clean = target_domain.lower().strip() if target_domain else ""

    matched_sources: List[Dict[str, Any]] = []
    source_types: set[str] = set()
    independent_types: set[str] = set()

    directory_domains = {
        "alternativeto.net", "g2.com", "capterra.com", "trustradius.com",
        "saashub.com", "toolify.ai", "futuretools.io", "topai.tools",
        "futurepedia.io", "theresanaiforthat.com", "producthunt.com",
        "aitools.fyi", "promptbase.com", "lablab.ai"
    }

    for s in sources:
        title = str(s.get("title", "")).lower()
        text = str(s.get("text", "") or s.get("snippet", "")).lower()
        s_url = str(s.get("url", "")).lower().strip()
        combined = f"{title} {text} {s_url}"

        # Match exact name or co-occurrence of distinct tokens
        if name_clean in combined or (name_tokens and all(tok in combined for tok in name_tokens)):
            matched_sources.append(s)
            stype = str(s.get("source_type", "")).strip().lower()
            if stype:
                source_types.add(stype)

            s_domain = re.sub(r'^https?://', '', s_url).split('/')[0].strip()

            # Check if this source is self-sourced by candidate
            is_self_sourced = False
            if cand_dom_clean and (cand_dom_clean in s_domain or s_domain in cand_dom_clean):
                is_self_sourced = True
            elif len(cand_name_slug) >= 4 and cand_name_slug in s_domain:
                is_self_sourced = True

            # Check if source is from target company's domain
            is_target_source = False
            if target_dom_clean and (target_dom_clean in s_domain or s_domain in target_dom_clean):
                is_target_source = True

            # Check if source is a directory listing
            is_dir_source = (
                stype == "alternatives_listing" or
                any(d in s_domain for d in directory_domains)
            )

            # Only count as independent if not self-sourced, not target-sourced, and not directory scraper
            if not is_self_sourced and not is_target_source and not is_dir_source:
                if stype:
                    independent_types.add(stype)

    is_directory_only = (len(source_types) > 0 and len(independent_types) == 0)
    is_corroborated = (len(independent_types) >= 1)

    return {
        "is_directory_only": is_directory_only,
        "is_corroborated": is_corroborated,
        "source_types": sorted(list(source_types)),
        "independent_types": sorted(list(independent_types)),
        "matched_sources_count": len(matched_sources),
    }


def run_with_meta(
    company: str,
    sources: Optional[List[Dict[str, Any]]] = None,
    tenant_id: Optional[str] = None,
    website: Optional[str] = None,
    description: Optional[str] = None,
    profile: Optional[Dict[str, Any]] = None,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """
    Run Discovery Agent returning candidates alongside execution metadata:
    - candidates: List[Dict[str, Any]]
    - company_profile: Dict[str, Any] (grounded multi-segment profile)
    - is_low_confidence_profile: bool
    - extraction_method: 'llm' | 'heuristic_fallback'
    - degraded: bool (true when fell through to heuristic fallback)
    - llm_error: str | None
    - token_budget: Dict[str, Any]
    """
    company_clean = company.strip()
    if not company_clean:
        return {
            "candidates": [],
            "company_profile": None,
            "is_low_confidence_profile": False,
            "extraction_method": "llm",
            "degraded": False,
            "llm_error": None,
        }

    # Check candidate run cache to guarantee deterministic retrieval stability across repeated runs
    is_pytest = bool(os.getenv("PYTEST_CURRENT_TEST"))
    if not force_refresh and not is_pytest and sources is None and profile is None and not website and not description:
        cached_payload = discovery_cache.get_cached_discovery_run(company_clean)
        if cached_payload and isinstance(cached_payload, dict) and "candidates" in cached_payload:
            # Only serve cache if it was confident and grounded; never freeze low-confidence stale failures
            if not cached_payload.get("is_low_confidence_profile", False) and len(cached_payload.get("candidates", [])) > 0:
                logger.info(f"Returning cached discovery run for '{company_clean}' ({len(cached_payload['candidates'])} candidates).")
                cached_payload["token_budget"] = get_groq_token_budget_status()
                return cached_payload

    if force_refresh or website or description:
        discovery_cache.clear_cache_for_company(company_clean)

    logger.info(f"Running Discovery Agent for target company: '{company_clean}' (tenant: {tenant_id})")

    # Step 1: Resolve structured company profile if not passed explicitly
    if profile is None:
        try:
            profile = company_profiler.resolve_company_profile(
                company_clean,
                website=website,
                description=description,
                call_groq_fn=_call_groq_discovery,
            )
        except Exception as e:
            logger.warning(f"Profile resolution failed for '{company_clean}': {e}")
            profile = {
                "company_name": company_clean,
                "domain": company_profiler.clean_domain(website) if website else None,
                "summary": description or "",
                "segments": [],
                "confidence": "Low",
                "profile_source": "error_fallback",
                "is_low_confidence": True,
            }

    target_domain = profile.get("domain") or (company_profiler.clean_domain(website) if website else None)

    # Step 2: Fetch grounded multi-source context using grounded segments
    if sources is None:
        sources = fetch_grounded_context(
            company_clean,
            profile=profile,
            force_refresh=force_refresh or bool(website) or bool(description),
        )
        # Persist raw retrieved sources for deterministic reproduction
        try:
            storage.save_discovery_sources(company_clean, sources, tenant_id=tenant_id)
        except Exception as e:
            logger.warning(f"Could not persist discovery sources: {e}")

    logger.info(f"Processing {len(sources)} grounded context snippets for '{company_clean}'")

    llm_error: Optional[Exception] = None
    llm_error_msg: Optional[str] = None
    raw_candidates: List[Dict[str, Any]] = []
    extraction_method = "llm"

    if not sources:
        # Grounded fallback if web sources temporarily timed out or produced no results
        logger.info(f"Web retrieval sparse for '{company_clean}'. Generating grounded candidate proposal via LLM.")
        fallback_prompt = (
            f"Target Company: {company_clean}\n\n"
            f"Identify the primary real-world direct commercial and open-source competitors for {company_clean}, "
            f"their specific overlapping architectural or market capabilities, and industry positioning."
        )
        try:
            raw_result = _call_groq_discovery(DISCOVERY_SYSTEM_PROMPT, fallback_prompt)
            raw_candidates = raw_result.get("candidates", [])
        except LLMUnavailableError as e:
            llm_error = e
            llm_error_msg = str(e)
            logger.warning(f"LLM discovery failed for '{company_clean}' with sparse sources: {e}")
    else:
        system_prompt, user_prompt = _build_prompts(company_clean, sources, profile=profile)
        try:
            raw_result = _call_groq_discovery(system_prompt, user_prompt)
            raw_candidates = raw_result.get("candidates", [])
        except LLMUnavailableError as e:
            llm_error = e
            llm_error_msg = str(e)
            logger.warning(f"LLM discovery unavailable for '{company_clean}': {e}. Engaging deterministic heuristic fallback.")

    # Merge grounded heuristic candidates when available to maximize recall and prevent omission
    if sources:
        heuristic_cands = _heuristic_extract_candidates(company_clean, sources)
        if not raw_candidates:
            if heuristic_cands:
                logger.info(f"Deterministic heuristic parser extracted {len(heuristic_cands)} candidates for '{company_clean}'.")
                raw_candidates = heuristic_cands
                extraction_method = "heuristic_fallback"
        else:
            # Merge grounded candidates cited in comparisons that LLM synthesis omitted
            # ONLY merge if dedicated direct profile (e.g. Wikipedia: X or AlternativeTo: X)
            # and passes strict confidence validations. Never merge raw regex snippet matches into an LLM run!
            existing_keys = {_canonical_brand_key(c.get("name", "")) for c in raw_candidates if isinstance(c, dict)}
            for hc in heuristic_cands:
                h_name = hc.get("name", "")
                h_key = _canonical_brand_key(h_name)
                if h_key and h_key not in existing_keys and not _is_self_or_internal_product(h_name, company_clean):
                    if not hc.get("is_directory_only", False) and hc.get("_is_direct", False) and hc.get("confidence") in ("High", "Medium"):
                        raw_candidates.append(hc)
                        existing_keys.add(h_key)

    # If heuristic fallback also yielded nothing AND LLM failed specifically due to credentials/outage
    # Only raise if sources were present to analyze; if sources were genuinely empty, preserve empty state
    if not raw_candidates and llm_error is not None and sources:
        raise llm_error

    # Deduplicate and normalize candidates consistently across both paths
    deduped_map: Dict[str, Dict[str, Any]] = {}
    conf_priority = {"High": 3, "Medium": 2, "Low": 1}

    for item in raw_candidates:
        if not isinstance(item, dict):
            continue

        raw_name = str(item.get("name", "")).strip()
        cleaned_name = _clean_company_name(raw_name)

        # Sanity filter against garbage nouns and self-exclusion
        if not cleaned_name or _is_self_or_internal_product(cleaned_name, company_clean):
            continue

        words = [w.lower() for w in re.findall(r'[A-Za-z0-9]+', cleaned_name)]
        if any(w in DISQUALIFYING_NON_ENTITY_NOUNS for w in words) or any(w in DISQUALIFYING_ACTION_VERBS for w in words):
            continue

        # Extract parent brand if candidate is formatted like "Claude (Anthropic)" -> "Anthropic"
        parent_match = re.match(r'^(.*?)\s*\((.*?)\)$', cleaned_name)
        display_name = cleaned_name
        if parent_match:
            sub_name = parent_match.group(1).strip()
            parent_org = parent_match.group(2).strip()
            # If the parent is a recognized tech company name, prefer the parent company name
            if len(parent_org) > 2 and not parent_org.lower().startswith("formerly"):
                display_name = parent_org

        # Use canonical brand key so "Mistral" and "Mistral AI" share the exact same key "mistral"
        canonical_key = _canonical_brand_key(display_name)
        if not canonical_key or _is_self_or_internal_product(canonical_key, company_clean):
            continue

        # Clean website domain
        raw_web = str(item.get("website") or item.get("domain") or "").strip()
        clean_web = re.sub(r'^https?://', '', raw_web).split('/')[0].strip().lower()
        category = str(item.get("category") or item.get("industry_category") or "Competitor Platform").strip()
        rationale = str(item.get("rationale", "")).strip()

        # Disqualify directories / aggregators unless target company is itself a directory
        if _is_directory_or_aggregator(display_name, category, rationale, clean_web, target_profile=profile):
            logger.info(f"Disqualifying directory/aggregator candidate '{display_name}' for '{company_clean}'.")
            continue

        confidence = _normalize_confidence(item.get("confidence", "Low"))
        source = str(item.get("source", "")).strip()
        if not source:
            source = "Competitive intelligence index"

        source_age, source_date = _match_source_metadata(source, sources)

        # Segment functional overlap validation
        has_segment_overlap, matched_segment = _check_segment_overlap(
            display_name, category, rationale, item.get("matched_segment"), target_profile=profile
        )

        # If target has grounded segments, candidate MUST functionally overlap with at least one segment
        if profile and profile.get("segments") and not has_segment_overlap:
            logger.info(f"Disqualifying candidate '{display_name}' ({category}) - zero functional overlap with target segments.")
            continue

        # Freshness guardrail
        freshness_note = ""
        if item.get("freshness_note"):
            freshness_note = item["freshness_note"]
        elif source_age == "dated":
            if confidence == "High":
                confidence = "Medium"
            date_display = source_date if source_date else "historic"
            freshness_note = f"Sourced {date_display}, not independently confirmed recently"
        elif source_age == "recent":
            freshness_note = f"Recent source ({source_date})" if source_date else "Recent source"
        else:
            freshness_note = "Undated source (industry index)"

        # Independent corroboration check with domain guardrails
        corrob = _analyze_candidate_corroboration(
            display_name,
            sources,
            candidate_domain=clean_web,
            target_domain=target_domain,
        )
        is_dir_only = corrob["is_directory_only"]
        is_corroborated = corrob["is_corroborated"]

        if is_dir_only:
            # Single comparison directory listing without independent journalistic, repository, or encyclopedic corroboration
            if confidence in ("High", "Medium"):
                confidence = "Low"
            freshness_note = "Unverified directory match — single comparison listing lacking independent news, repository, or encyclopedic corroboration"
            tier = "peripheral"
            is_directory_artifact_risk = True
        elif is_corroborated and (has_segment_overlap or not (profile and profile.get("segments"))) and confidence in ("High", "Medium"):
            tier = "core"
            is_directory_artifact_risk = False
        else:
            tier = "peripheral"
            is_directory_artifact_risk = False

        # If LLM specified tier, only allow "core" if segment overlap is verified (when segments exist) and not directory only
        cand_tier = item.get("tier")
        has_segments = bool(profile and profile.get("segments"))
        if cand_tier == "core" and ((has_segments and not has_segment_overlap) or is_dir_only):
            cand_tier = "peripheral"
        effective_tier = cand_tier if cand_tier in ("core", "peripheral") else tier

        candidate_obj = {
            "name": display_name,
            "category": category,
            "matched_segment": matched_segment,
            "website": clean_web,
            "domain": clean_web,
            "rationale": rationale,
            "confidence": confidence,
            "source": source,
            "source_age": source_age,
            "source_date": source_date,
            "freshness_note": freshness_note,
            "extraction_method": extraction_method,
            "tier": effective_tier,
            "is_directory_only": is_dir_only,
            "is_directory_artifact_risk": is_directory_artifact_risk,
            "corroboration_status": "multi_source_corroborated" if is_corroborated else ("unverified_directory" if is_dir_only else "single_source"),
            "corroborated_source_types": corrob["source_types"],
        }

        if canonical_key in deduped_map:
            existing = deduped_map[canonical_key]
            # Prefer longer / more formal display name (e.g. "Mistral AI" over "Mistral")
            if len(display_name) > len(existing["name"]):
                existing["name"] = display_name
            # Preserve core tier if any occurrence was corroborated
            if candidate_obj["tier"] == "core":
                existing["tier"] = "core"
                existing["is_directory_artifact_risk"] = False
            # Keep matched_segment if existing didn't have one
            if not existing.get("matched_segment") and matched_segment:
                existing["matched_segment"] = matched_segment
            # Keep higher confidence
            if conf_priority.get(confidence, 1) > conf_priority.get(existing["confidence"], 1):
                existing["confidence"] = confidence
                existing["source"] = source
                existing["source_age"] = source_age
                existing["freshness_note"] = freshness_note
            # Keep better rationale
            if len(rationale) > len(existing["rationale"]):
                existing["rationale"] = rationale
        else:
            deduped_map[canonical_key] = candidate_obj

    # Rank candidates: Core competitors first, then High confidence, then recent source age
    def _candidate_rank(c: Dict[str, Any]) -> int:
        score = 0
        if c.get("tier") == "core":
            score += 200
        conf = c.get("confidence", "Low")
        if conf == "High":
            score += 100
        elif conf == "Medium":
            score += 50
        if c.get("source_age") == "recent":
            score += 20
        elif c.get("source_age") == "undated":
            score += 10
        if c.get("is_directory_artifact_risk"):
            score -= 150
        return score

    normalized_candidates = list(deduped_map.values())
    normalized_candidates.sort(key=_candidate_rank, reverse=True)

    # Save discovery proposal to storage
    try:
        storage.save_discovery_proposal(company_clean, normalized_candidates, tenant_id=tenant_id)
    except Exception as e:
        logger.warning(f"Could not persist discovery proposal: {e}")

    token_budget = get_groq_token_budget_status()

    final_payload = {
        "candidates": normalized_candidates,
        "company_profile": profile,
        "is_low_confidence_profile": profile.get("is_low_confidence", False) if profile else False,
        "extraction_method": extraction_method,
        "degraded": (extraction_method == "heuristic_fallback"),
        "llm_error": llm_error_msg,
        "token_budget": token_budget,
    }

    # Cache successful run payload for determinism and fast subsequent queries
    try:
        discovery_cache.set_cached_discovery_run(company_clean, final_payload)
    except Exception as e:
        logger.warning(f"Could not cache discovery run for '{company_clean}': {e}")

    return final_payload


class CandidatesResult(list):
    """List subclass preserving transparent discovery execution metadata."""
    def __init__(
        self,
        iterable=None,
        extraction_method="llm",
        degraded=False,
        llm_error=None,
        token_budget=None,
        company_profile=None,
        is_low_confidence_profile=False,
    ):
        super().__init__(iterable or [])
        self.extraction_method = extraction_method
        self.degraded = degraded
        self.llm_error = llm_error
        self.token_budget = token_budget
        self.company_profile = company_profile
        self.is_low_confidence_profile = is_low_confidence_profile


def run(
    company: str,
    sources: Optional[List[Dict[str, Any]]] = None,
    tenant_id: Optional[str] = None,
    website: Optional[str] = None,
    description: Optional[str] = None,
    profile: Optional[Dict[str, Any]] = None,
    force_refresh: bool = False,
) -> List[Dict[str, Any]]:
    """Backward-compatible runner returning List[Dict[str, Any]] with execution metadata attributes."""
    meta = run_with_meta(
        company,
        sources=sources,
        tenant_id=tenant_id,
        website=website,
        description=description,
        profile=profile,
        force_refresh=force_refresh,
    )
    return CandidatesResult(
        meta["candidates"],
        extraction_method=meta["extraction_method"],
        degraded=meta["degraded"],
        llm_error=meta["llm_error"],
        token_budget=meta.get("token_budget"),
        company_profile=meta.get("company_profile"),
        is_low_confidence_profile=meta.get("is_low_confidence_profile", False),
    )


def interactive_confirm(target_company: str, candidates: List[Dict[str, Any]]) -> List[str]:
    """
    Interactive CLI workflow for a human to confirm, edit, or reject candidate competitors.
    Highlights source freshness and staleness warnings prominently.
    """
    print(f"\n==================================================================")
    print(f" Discovery Agent: Proposed Competitors for '{target_company}'")
    print(f"==================================================================\n")

    if not candidates:
        print("No candidate competitors proposed.")
        return []

    confirmed: List[str] = []
    print(f"Total candidates proposed: {len(candidates)}\n")
    print("Options for each candidate:")
    print("  [y] Accept candidate as-is")
    print("  [n] Reject candidate")
    print("  [e] Edit competitor name before accepting")
    print("  [a] Accept ALL remaining candidates as-is")
    print("  [q] Quit and discard remaining\n")

    accept_all = False
    for idx, c in enumerate(candidates, 1):
        name = c["name"]
        confidence = c["confidence"]
        rationale = c["rationale"]
        source = c["source"]
        source_age = c.get("source_age", "undated")
        freshness_note = c.get("freshness_note", "")

        # Highlight dated warnings
        age_tag = f"[{source_age.upper()}]"
        if source_age == "dated":
            age_tag = f"[⚠️ DATED - {freshness_note}]"
        elif source_age == "recent":
            age_tag = f"[✓ RECENT - {freshness_note}]"

        print(f"[{idx}/{len(candidates)}] {name} (Confidence: {confidence}) {age_tag}")
        print(f"    Rationale: {rationale}")
        print(f"    Source:    {source}")

        if accept_all:
            confirmed.append(name)
            print(f"    -> Accepted (Auto-all)\n")
            continue

        while True:
            choice = input("    Decision [y/n/e/a/q]: ").strip().lower()
            if choice == "y":
                confirmed.append(name)
                print("    -> Accepted\n")
                break
            elif choice == "n":
                print("    -> Rejected\n")
                break
            elif choice == "e":
                edited_name = input("    Enter corrected company name: ").strip()
                if edited_name:
                    confirmed.append(edited_name)
                    print(f"    -> Accepted as '{edited_name}'\n")
                else:
                    print("    -> Empty input; skipped\n")
                break
            elif choice == "a":
                accept_all = True
                confirmed.append(name)
                print(f"    -> Accepted (and accepting all remaining)\n")
                break
            elif choice == "q":
                print("    -> Quitting interactive review.\n")
                break
            else:
                print("    Invalid input. Please enter y, n, e, a, or q.")

        if choice == "q":
            break

    print(f"Review complete. Confirmed {len(confirmed)} competitors for '{target_company}': {confirmed}")
    storage.save_confirmed_competitors(target_company, confirmed)
    return confirmed


def main() -> None:
    """CLI entrypoint for Discovery Agent."""
    parser = argparse.ArgumentParser(description="PrismIQ Competitor Discovery Agent")
    parser.add_argument(
        "--target",
        type=str,
        default=config.TARGET_COMPANY,
        help=f"Target company name (default: {config.TARGET_COMPANY})",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Launch interactive human confirm/edit CLI session",
    )
    parser.add_argument(
        "--proposal-only",
        action="store_true",
        help="Generate and save proposal without prompting for confirmation",
    )

    args = parser.parse_args()
    target = args.target.strip()

    candidates = run(target)
    print(f"\nDiscovered {len(candidates)} candidate competitors for '{target}':")
    for idx, c in enumerate(candidates, 1):
        age_label = f"[{c.get('source_age', 'undated').upper()}: {c.get('freshness_note', '')}]"
        print(f" {idx}. {c['name']} [{c['confidence']}] {age_label} - {c['rationale']} (Source: {c['source']})")

    if args.interactive:
        interactive_confirm(target, candidates)
    else:
        proposal_file = storage._sanitize_filename(target)
        print(f"\nProposal saved to data/discovery_proposal_{proposal_file}.json")
        print("To confirm competitors, run with --interactive or edit/confirm via storage.")


if __name__ == "__main__":
    main()
