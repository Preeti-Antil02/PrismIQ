import argparse
import concurrent.futures
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus
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

from src import config, storage

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
VALID_CONFIDENCE_LEVELS = {"High", "Medium", "Low"}
VALID_SOURCE_AGES = {"recent", "dated", "undated"}

DISCOVERY_SYSTEM_PROMPT = """You are a senior competitive intelligence analyst for PrismIQ.
Given a target company and a set of retrieved, verified sources (technical writeups, comparisons, repositories, news, and encyclopedia articles), your job is to identify, rank, and return candidate competitors.

OUTPUT CONTRACT:
Return ONLY a valid JSON object with a single key "candidates" containing an array of competitor candidate objects:
{
  "candidates": [
    {
      "name": "Exact Competitor Company or Product Name",
      "rationale": "One or two sentences grounded in what they do and how they overlap with the target company, citing specific capabilities.",
      "confidence": "High" | "Medium" | "Low",
      "source": "Exact Title or URL of the retrieved source that grounded this candidate",
      "source_age": "recent" | "dated" | "undated"
    }
  ]
}

GUARDRAILS (STRICT):
1. No generic or unfalsifiable rationales: Do NOT use vague filler like "they are in the same space" or "they are a competitor". State specifically what products, architectures, or market overlaps exist (e.g. frontend hosting, serverless edge compute, Jamstack deployments, payment processing API, application performance monitoring).
2. Grounding & Zero Hallucination: Every suggested candidate competitor MUST be explicitly supported by and traceable to at least one of the provided retrieved sources. If a company is not mentioned or supported in the retrieved sources, do NOT include it.
3. No Cherry-Picking / Distortion: State the competitive relationship accurately based on what the source documents.
4. INCLUSIVENESS & FRESHNESS CALIBRATION:
   - Surface ALL genuine competitors documented across the retrieved sources. Do NOT silently omit or prune older competitors (e.g. Wavefront, SignalFX, WePay, Paymill); include them so the human reviewer can inspect and confirm or reject them.
   - "High" confidence requires recent, checkable facts (sources from the last ~18 months, or actively maintained repositories).
   - If a candidate competitor is grounded ONLY in a "dated" source (older than ~18 months, e.g. 2011, 2014, 2016, 2021) without recent corroboration, do NOT assign High confidence. Assign Medium or Low confidence and set "source_age" to "dated".
   - "Medium": Significant product or functional overlap, or a moderately dated source with ongoing market presence.
   - "Low": Niche/partial overlap, or heavily dated source with historic/unconfirmed current status.
5. Do NOT include the target company itself as a candidate competitor.
6. Rank candidates starting with direct and recent competitors first, followed by dated or niche competitors."""


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
    queries = [f"{company} alternative", f"{company} vs", f"{company} competitor"]
    
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
    """Fetch encyclopedic background and competitor mentions from Wikipedia REST API."""
    sources: List[Dict[str, Any]] = []
    headers = {"User-Agent": "PrismIQ-Competitive-Intelligence/2.0 (research@prismiq.ai)"}
    queries = [company, f"{company} competitors", f"{company} software"]

    for q in queries:
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
                    sources.append({
                        "source_type": "wikipedia",
                        "title": f"Wikipedia: {title}",
                        "url": page_url,
                        "published_at": None,
                        "source_age": "undated",
                        "text": f"{title}: {snippet} (undated encyclopedia entry)",
                    })
        except Exception as e:
            logger.debug(f"Wikipedia API error for '{q}': {e}")

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
    queries = [f"{company} alternatives", f"{company} competitors"]

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
                    name = name_el.get_text(strip=True) if name_el else (app_slug.replace("-", " ").title() if app_slug else "")
                    desc = desc_el.get_text(strip=True) if desc_el else ""

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


def fetch_grounded_context(company: str) -> List[Dict[str, Any]]:
    """
    Gather and deduplicate multi-source grounded intelligence context across
    Hacker News, GitHub, Wikipedia, Currents news, DuckDuckGo, and AlternativeTo
    concurrently via ThreadPoolExecutor.
    """
    fetchers = [
        ("hn", lambda: _fetch_hn_context(company)),
        ("github", lambda: _fetch_github_context(company)),
        ("wikipedia", lambda: _fetch_wikipedia_context(company)),
        ("currents", lambda: _fetch_currents_context(company)),
        ("duckduckgo", lambda: _fetch_duckduckgo_context(company)),
        ("alternativeto", lambda: _fetch_alternativeto_context(company)),
    ]

    raw_sources: List[Dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(fetchers)) as executor:
        future_map = {executor.submit(fn): name for name, fn in fetchers}
        for fut in concurrent.futures.as_completed(future_map):
            name = future_map[fut]
            try:
                items = fut.result(timeout=5.0)
                raw_sources.extend(items)
            except Exception as e:
                logger.debug(f"Source fetcher '{name}' encountered timeout or error: {e}")

    # Deduplicate sources by URL or Title
    seen = set()
    deduped: List[Dict[str, Any]] = []
    for s in raw_sources:
        key = (s.get("url", "").strip(), s.get("title", "").strip())
        if key not in seen and s.get("title"):
            seen.add(key)
            deduped.append(s)

    # Sort sources to prioritize recent and rich writeups, taking top 18 to avoid LLM prompt bloat
    def _source_priority(s: Dict[str, Any]) -> int:
        st = s.get("source_type", "")
        age = s.get("source_age", "")
        score = 0
        if age == "recent":
            score += 20
        if st in ("news", "discussion_and_tech_media"):
            score += 10
        elif st in ("alternatives_listing", "market_knowledge_index"):
            score += 8
        elif st == "github_repository":
            score += 6
        return score

    deduped.sort(key=_source_priority, reverse=True)
    return deduped[:18]



def _build_prompts(company: str, sources: List[Dict[str, Any]]) -> Tuple[str, str]:
    """Construct system and user prompts for Groq competitor discovery with freshness annotations."""
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

    user_prompt = f"""Target Company: {company}

Retrieved Sources:
\"\"\"
{formatted_context}
\"\"\"

Analyze the retrieved sources above and produce the comprehensive ranked candidate competitor list for {company}, ensuring all competitors found in sources are surfaced and annotated with their source freshness."""
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
    "article", "title", "user", "users", "choice", "best", "popular", "domestic", "limited"
}


def _clean_heuristic_candidate(raw: str) -> str:
    c = re.sub(r'^[^\w]+|[^\w]+$', '', raw.strip())
    c = _clean_company_name(c)
    # Strip leading/trailing conjunctions and prepositions
    c = re.sub(r'(?i)\s+\b(and|or|with|the|in|at|by|from|to|for|of)\b$', '', c).strip()
    c = re.sub(r'(?i)^\b(and|or|with|the|in|at|by|from|to|for|of)\b\s+', '', c).strip()
    if len(c) < 2 or c.isdigit():
        return ""
    words = [w.lower() for w in re.findall(r'[A-Za-z0-9]+', c)]
    if not words or all(w in EXCLUDED_HEURISTIC_WORDS for w in words):
        return ""
    if words[0] in EXCLUDED_HEURISTIC_WORDS or words[-1] in EXCLUDED_HEURISTIC_WORDS:
        return ""
    return c


def _heuristic_extract_candidates(company: str, sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Deterministic fallback parser that extracts candidate competitor entities from
    retrieved snippets, titles, and URLs when LLM inference is unavailable.
    """
    company_clean = company.strip().lower()
    extracted: Dict[str, Dict[str, Any]] = {}

    patterns = [
        # Entity vs Target or Target vs Entity (e.g. "Flipkart vs Meesho", "OpenAI vs Anthropic")
        (r'(?i)\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\s+(?:vs\.?|versus)\s+' + re.escape(company_clean), 0.9),
        (r'(?i)' + re.escape(company_clean) + r'\s+(?:vs\.?|versus)\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})', 0.9),
        
        # Entity ... Target competitor (e.g. "Mistral - ... OpenAI competitor")
        (r'(?i)\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\s*[\-–—,\(].*?' + re.escape(company_clean) + r'\s+competitor', 0.9),
        (r'(?i)\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\s+is\s+an?\s+' + re.escape(company_clean) + r'\s+competitor', 0.9),
        
        # Target competitor Entity (e.g. "OpenAI Codex Competitor Cursor")
        (r'(?i)' + re.escape(company_clean) + r'(?:\s+[A-Za-z0-9]+)?\s+competitor\s*[\:–—\-]?\s*([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})', 0.85),
        
        # Entity ... Target alternative (e.g. "BlindAI ... OpenAI alternative", "LocalAI: Self-hosted OpenAI alternative")
        (r'(?i)\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\s*[\-–—:\(].*?' + re.escape(company_clean) + r'\s+alternative', 0.85),
        (r'(?i)\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\s+as\s+an?\s+' + re.escape(company_clean) + r'\s+alternative', 0.85),
        
        # competes primarily with Entity / domestic rival Entity
        (r'(?i)competes\s+primarily\s+with\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})', 0.85),
        (r'(?i)(?:domestic|primary|major)\s+rival\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})', 0.85),
        
        # File/deck patterns: "Samridhi1412/Flipkart_vs_Meesho_Deck"
        (r'(?i)\b([A-Za-z0-9]+)_vs_' + re.escape(company_clean), 0.85),
        (r'(?i)' + re.escape(company_clean) + r'_vs_([A-Za-z0-9]+)', 0.85),
    ]

    for s in sources:
        title = s.get("title", "")
        text = s.get("text", "")
        combined = f"{title}. {text}"

        for pat, base_weight in patterns:
            for match in re.finditer(pat, combined):
                cand = match.group(1).strip()
                cleaned = _clean_heuristic_candidate(cand)
                if not cleaned:
                    continue
                if _is_self_or_internal_product(cleaned, company):
                    continue
                
                key = cleaned.lower()
                source_ref = title or s.get("url", "")
                source_age, source_date = _match_source_metadata(source_ref, sources)
                conf = "Medium" if base_weight >= 0.85 else "Low"
                if source_age == "dated":
                    conf = "Low"
                    freshness_note = f"Sourced {source_date or 'historic'}, not independently confirmed recently"
                elif source_age == "recent":
                    freshness_note = f"Recent source ({source_date})" if source_date else "Recent source"
                else:
                    freshness_note = "Retrieved grounded market intelligence"

                if key not in extracted:
                    extracted[key] = {
                        "name": cleaned,
                        "rationale": f"Directly cited alongside {company.capitalize()} in market intelligence snippet: \"{title[:75]}\".",
                        "confidence": conf,
                        "source": source_ref,
                        "source_age": source_age,
                        "source_date": source_date,
                        "freshness_note": freshness_note,
                        "_weight": base_weight,
                    }
                else:
                    if base_weight > extracted[key]["_weight"]:
                        extracted[key]["_weight"] = base_weight
                        extracted[key]["confidence"] = conf

    res = list(extracted.values())
    for item in res:
        item.pop("_weight", None)
    return res


@traceable(run_type="llm", name="discovery_agent_llm_call")
def _call_groq_discovery(system_prompt: str, user_prompt: str, max_retries: int = 4) -> Dict[str, Any]:
    """Execute Groq completion with JSON object response format, retries, and rate limit backoff."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or not api_key.strip():
        logger.warning("GROQ_API_KEY not configured in environment.")
        raise LLMUnavailableError("GROQ_API_KEY is not configured in backend environment variables.")

    model = os.getenv("GROQ_MODEL", DEFAULT_GROQ_MODEL).strip()
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 1500,
        "response_format": {"type": "json_object"},
    }

    last_error: Optional[Exception] = None
    for attempt in range(max_retries):
        try:
            resp = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=20)
            if resp.status_code in (401, 403):
                logger.error(f"Groq API authentication error ({resp.status_code}): Invalid or rejected API key.")
                raise LLMUnavailableError(f"Groq API authentication error ({resp.status_code}): Invalid or rejected API key.")

            if resp.status_code == 429:
                retry_header = resp.headers.get("retry-after", "")
                try:
                    retry_after = float(retry_header)
                except ValueError:
                    retry_after = 2.0 * (attempt + 1)
                backoff = min(max(retry_after, 2.0), 6.0)
                logger.warning(f"Groq 429 rate limit hit. Backing off for {backoff:.1f}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(backoff)
                continue

            resp.raise_for_status()
            res_data = resp.json()

            # Attach token usage and cost metadata to active LangSmith span
            usage = res_data.get("usage")
            if usage and isinstance(usage, dict):
                _attach_langsmith_usage(usage, model=model)

            content = res_data["choices"][0]["message"]["content"]

            cleaned_content = re.sub(r"^```json\s*", "", content.strip(), flags=re.IGNORECASE)
            cleaned_content = re.sub(r"\s*```$", "", cleaned_content.strip())
            parsed = json.loads(cleaned_content)
            if isinstance(parsed, dict) and "candidates" in parsed:
                return parsed
            return {"candidates": []}
        except LLMUnavailableError:
            raise
        except Exception as e:
            last_error = e
            if attempt == max_retries - 1:
                logger.error(f"Error calling Groq API for discovery ({model}): {e}")
                raise LLMUnavailableError(f"Groq API call failed after {max_retries} attempts: {e}")
            time.sleep(1.0)

    if last_error:
        raise LLMUnavailableError(f"Groq API call failed: {last_error}")
    raise LLMUnavailableError("Groq API call failed to return candidate response.")



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


def _clean_company_name(name: str) -> str:
    """
    Normalize company and candidate names:
    - Strip legal entities: Inc, Inc., LLC, Ltd, Ltd., Corp, Corporation, Co., Co
    - Normalize brackets, punctuation, quotes, and whitespace
    """
    if not name:
        return ""
    clean = str(name).strip().strip("\"'").strip()
    # Strip trailing corporate suffixes
    clean = re.sub(r'(?i)\s*\b(inc|llc|ltd|corp|corporation|co|technologies|company)\b\.?$', '', clean).strip()
    clean = re.sub(r'[,.]+$', '', clean).strip()
    clean = re.sub(r'\s+', ' ', clean)
    return clean


KNOWN_INTERNAL_PRODUCTS = {
    "openai": {"chatgpt", "gpt-4", "gpt-4o", "gpt-3.5", "dall-e", "codex", "sora", "openai api", "whisper", "o1", "o3"},
    "google": {"gemini", "bard", "deepmind", "google cloud", "vertex ai", "android", "youtube"},
    "microsoft": {"copilot", "azure", "bing", "github copilot", "office 365", "windows"},
    "meta": {"llama", "facebook", "instagram", "whatsapp", "threads", "pytorch"},
    "amazon": {"aws", "alexa", "bedrock", "prime", "amazon web services"},
    "apple": {"siri", "apple intelligence", "ios", "macos"},
    "anthropic": {"claude", "claude 2", "claude 3", "claude 3.5", "claude code"},
    "flipkart": {"myntra", "flipkart wholesale", "shopsy", "cleartrip", "supercoins"},
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
                if c_clean == p or c_clean.startswith(p + " "):
                    return True

    return False


def run(
    company: str,
    sources: Optional[List[Dict[str, Any]]] = None,
    tenant_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Run Discovery Agent for the specified target company.
    1. Uses provided sources or fetches grounded intelligence context across all sources concurrently.
    2. Persists raw retrieved sources for reproducible re-runs and historical audits.
    3. Passes context to LLM with strict anti-hallucination and freshness guardrails.
    4. Normalizes candidate schema and deduplicates candidates.
    5. Programmatic freshness guardrail: downgrades High confidence to Medium for 'dated' sources.
    6. Filters out target company itself and its internal products.
    7. Saves proposal snapshot to data storage (scoped to tenant_id).
    """
    company_clean = company.strip()
    if not company_clean:
        return []

    logger.info(f"Running Discovery Agent for target company: '{company_clean}' (tenant: {tenant_id})")
    if sources is None:
        sources = fetch_grounded_context(company_clean)
        # Persist raw retrieved sources for deterministic reproduction
        try:
            storage.save_discovery_sources(company_clean, sources, tenant_id=tenant_id)
        except Exception as e:
            logger.warning(f"Could not persist discovery sources: {e}")

    logger.info(f"Processing {len(sources)} grounded context snippets for '{company_clean}'")

    llm_error: Optional[Exception] = None
    raw_candidates: List[Dict[str, Any]] = []

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
            logger.warning(f"LLM discovery failed for '{company_clean}' with sparse sources: {e}")
    else:
        system_prompt, user_prompt = _build_prompts(company_clean, sources)
        try:
            raw_result = _call_groq_discovery(system_prompt, user_prompt)
            raw_candidates = raw_result.get("candidates", [])
        except LLMUnavailableError as e:
            llm_error = e
            logger.warning(f"LLM discovery unavailable for '{company_clean}': {e}. Engaging deterministic heuristic fallback.")

    # Heuristic fallback if LLM returned no candidates or failed
    if not raw_candidates and sources:
        heuristic_cands = _heuristic_extract_candidates(company_clean, sources)
        if heuristic_cands:
            logger.info(f"Deterministic heuristic parser extracted {len(heuristic_cands)} candidates for '{company_clean}'.")
            raw_candidates = heuristic_cands

    # If heuristic fallback also yielded nothing AND LLM failed specifically due to credentials/outage
    if not raw_candidates and llm_error is not None:
        raise llm_error


    # Deduplicate and normalize candidates
    deduped_map: Dict[str, Dict[str, Any]] = {}
    conf_priority = {"High": 3, "Medium": 2, "Low": 1}

    for item in raw_candidates:
        if not isinstance(item, dict):
            continue

        raw_name = str(item.get("name", "")).strip()
        cleaned_name = _clean_company_name(raw_name)

        # Guardrail: Do not include target company itself or its internal products
        if not cleaned_name or _is_self_or_internal_product(cleaned_name, company_clean):
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

        canonical_key = display_name.lower()
        # Double check self-exclusion after parent extraction
        if _is_self_or_internal_product(canonical_key, company_clean):
            continue

        rationale = str(item.get("rationale", "")).strip()
        confidence = _normalize_confidence(item.get("confidence", "Low"))
        source = str(item.get("source", "")).strip()
        if not source:
            source = "Competitive intelligence index"

        source_age, source_date = _match_source_metadata(source, sources)

        # Freshness guardrail
        freshness_note = ""
        if source_age == "dated":
            if confidence == "High":
                confidence = "Medium"
            date_display = source_date if source_date else "historic"
            freshness_note = f"Sourced {date_display}, not independently confirmed recently"
        elif source_age == "recent":
            freshness_note = f"Recent source ({source_date})" if source_date else "Recent source"
        else:
            freshness_note = "Undated source (industry index)"

        candidate_obj = {
            "name": display_name,
            "rationale": rationale,
            "confidence": confidence,
            "source": source,
            "source_age": source_age,
            "source_date": source_date,
            "freshness_note": freshness_note,
        }

        if canonical_key in deduped_map:
            existing = deduped_map[canonical_key]
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

    # Rank candidates: High confidence first, then recent source age
    def _candidate_rank(c: Dict[str, Any]) -> int:
        score = 0
        conf = c.get("confidence", "Low")
        if conf == "High":
            score += 100
        elif conf == "Medium":
            score += 50
        if c.get("source_age") == "recent":
            score += 20
        elif c.get("source_age") == "undated":
            score += 10
        return score

    normalized_candidates = list(deduped_map.values())
    normalized_candidates.sort(key=_candidate_rank, reverse=True)

    # Save discovery proposal to storage
    try:
        storage.save_discovery_proposal(company_clean, normalized_candidates, tenant_id=tenant_id)
    except Exception as e:
        logger.warning(f"Could not persist discovery proposal: {e}")

    return normalized_candidates


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
