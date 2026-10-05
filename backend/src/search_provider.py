"""
Structured Web Search Provider for PrismIQ Competitor Discovery.

Integrates structured search APIs (Tavily AI Search) with persistent query caching
to eliminate the run-to-run instability of unauthenticated HTML scraping.

CURRENT PRICING AND FREE-TIER AUDIT (October 2026):
1. Tavily Search API:
   - Free Tier: 1,000 search credits / month.
   - Credit Card: NOT REQUIRED.
   - Endpoint: https://api.tavily.com/search
   - Purpose-built for LLM agent retrieval with structured relevance scoring.
2. Google Custom Search JSON API:
   - Status: CLOSED TO NEW CUSTOMERS. Discontinued effective January 1, 2027.
   - Not viable for long-term production architecture.
3. Bing Web Search API:
   - Status: RETIRED by Microsoft on August 11, 2025.
   - Replaced by Azure 'Grounding with Bing' ($14 / 1,000 transactions, NO free tier).
4. Brave Search API:
   - Free Tier: 1,000 queries / month ($5 monthly credit).
   - Credit Card: REQUIRED upfront for identity verification.
"""

import json
import logging
import os
import re
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional
import requests

from . import discovery_cache

logger = logging.getLogger(__name__)

DEFAULT_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _execute_tavily_search(query: str, max_results: int = 6) -> List[Dict[str, Any]]:
    """Execute search via Tavily Search API (1,000 free monthly requests, no credit card)."""
    api_key = os.getenv("TAVILY_API_KEY", "").strip()
    if not api_key:
        return []

    url = "https://api.tavily.com/search"
    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "basic",
        "max_results": max_results,
        "include_answer": False,
        "include_images": False,
        "include_raw_content": False,
    }

    try:
        resp = requests.post(url, json=payload, timeout=6.0)
        if resp.status_code == 200:
            data = resp.json()
            items = []
            for r in data.get("results", []):
                items.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "snippet": r.get("content", ""),
                    "score": r.get("score", 0.0),
                    "provider": "tavily",
                })
            logger.info(f"Tavily search returned {len(items)} structured results for query '{query}'")
            return items
        else:
            logger.warning(f"Tavily search API returned status {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"Tavily search request failed for query '{query}': {e}")

    return []


def _execute_duckduckgo_api_search(query: str) -> List[Dict[str, Any]]:
    """Query DuckDuckGo Instant Answer JSON API for structured entity definitions."""
    url = f"https://api.duckduckgo.com/?q={urllib.parse.quote(query)}&format=json&no_html=1&skip_disambig=0"
    items = []
    try:
        req = urllib.request.Request(url, headers=dict(DEFAULT_REQUEST_HEADERS))
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        abstract = data.get("AbstractText", "")
        heading = data.get("Heading", "")
        abs_url = data.get("AbstractURL", "")
        if abstract and heading:
            items.append({
                "title": f"DuckDuckGo Knowledge: {heading}",
                "url": abs_url,
                "snippet": abstract,
                "provider": "duckduckgo_api",
            })

        for topic in data.get("RelatedTopics", [])[:5]:
            if isinstance(topic, dict) and "Text" in topic:
                items.append({
                    "title": topic.get("FirstURL", "").split("/")[-1].replace("_", " ") or "Topic",
                    "url": topic.get("FirstURL", ""),
                    "snippet": topic.get("Text", ""),
                    "provider": "duckduckgo_api",
                })
    except Exception as e:
        logger.debug(f"DuckDuckGo Instant Answer API error for '{query}': {e}")

    return items


def _execute_gnews_rss_search(query: str, max_results: int = 6) -> List[Dict[str, Any]]:
    """Execute search via Google News RSS for authoritative, fresh market and competitor articles."""
    items = []
    try:
        import xml.etree.ElementTree as ET
        from bs4 import BeautifulSoup
        clean_q = query.strip()
        url = f"https://news.google.com/rss/search?q={urllib.parse.quote(clean_q)}&hl=en-US&gl=US&ceid=US:en"
        resp = requests.get(url, headers=dict(DEFAULT_REQUEST_HEADERS), timeout=4.5)
        if resp.status_code == 200 and resp.content:
            root = ET.fromstring(resp.content)
            for it in root.findall(".//item")[:max_results]:
                t = it.find("title").text if it.find("title") is not None else ""
                link = it.find("link").text if it.find("link") is not None else ""
                desc = it.find("description").text if it.find("description") is not None else ""
                clean_desc = BeautifulSoup(desc, "html.parser").get_text(separator=" ", strip=True) if desc else t
                if t:
                    items.append({
                        "title": t,
                        "url": link,
                        "snippet": clean_desc or t,
                        "provider": "gnews_rss",
                    })
    except Exception as e:
        logger.debug(f"Google News RSS search notice for '{query}': {e}")

    return items


def _execute_wikipedia_api_search(query: str, max_results: int = 6) -> List[Dict[str, Any]]:
    """Query Wikipedia search API for high-authority entity and competitor definitions."""
    items = []
    try:
        from bs4 import BeautifulSoup
        clean_q = query.strip()
        url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={urllib.parse.quote(clean_q)}&format=json"
        resp = requests.get(url, headers={"User-Agent": "PrismIQ-Intelligence/1.0 (research@prismiq.ai)"}, timeout=4.0)
        if resp.status_code == 200:
            data = resp.json()
            for it in data.get("query", {}).get("search", [])[:max_results]:
                t = it.get("title", "")
                raw_snip = it.get("snippet", "")
                clean_snip = BeautifulSoup(raw_snip, "html.parser").get_text(separator=" ", strip=True) if raw_snip else ""
                if t:
                    items.append({
                        "title": f"Wikipedia: {t}",
                        "url": f"https://en.wikipedia.org/wiki/{urllib.parse.quote(t)}",
                        "snippet": clean_snip or f"Wikipedia reference for {t}.",
                        "provider": "wikipedia_api",
                    })
    except Exception as e:
        logger.debug(f"Wikipedia search API notice for '{query}': {e}")

    return items


def _execute_html_search_fallback(query: str, max_results: int = 6) -> List[Dict[str, Any]]:
    """Structured HTML parsing fallback when dedicated search API key is not present."""
    items = []
    try:
        from bs4 import BeautifulSoup
        url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
        resp = requests.get(url, headers=dict(DEFAULT_REQUEST_HEADERS), timeout=4.0)
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            for res in soup.select(".result")[:max_results]:
                title_a = res.select_one(".result__title a")
                snippet_el = res.select_one(".result__snippet")
                if not title_a:
                    continue
                t_text = title_a.get_text(separator=" ", strip=True)
                s_text = snippet_el.get_text(separator=" ", strip=True) if snippet_el else ""
                href = title_a.get("href", "")
                if "uddg=" in href:
                    match = re.search(r"uddg=([^&]+)", href)
                    if match:
                        href = urllib.parse.unquote(match.group(1))

                items.append({
                    "title": t_text,
                    "url": href,
                    "snippet": s_text,
                    "provider": "html_fallback",
                })
    except Exception as e:
        logger.debug(f"HTML search fallback error for '{query}': {e}")

    return items


def search_web_structured(
    query: str,
    company: str = "",
    max_results: int = 6,
    force_refresh: bool = False,
) -> List[Dict[str, Any]]:
    """
    Search the web with deterministic persistent caching.
    
    1. Checks persistent SQLite cache for (company, query). If found and fresh, returns immediately.
    2. If Tavily API Key configured, queries Tavily structured AI search API.
    3. Otherwise, executes resilient multi-source search (Google News RSS + Wikipedia Search + DDG API + HTML).
    4. Caches results persistently before returning.
    """
    comp_clean = company.strip().lower() if company else "global"

    # Step 1: Check persistent cache
    if not force_refresh:
        cached = discovery_cache.get_cached_query_results(comp_clean, query)
        if cached is not None:
            return cached

    # Step 2: Try Tavily API if configured
    results = []
    tavily_key = os.getenv("TAVILY_API_KEY", "").strip()
    if tavily_key:
        results = _execute_tavily_search(query, max_results=max_results)

    # Step 3: If no Tavily results, query resilient multi-engine fallback
    if not results:
        gnews_results = _execute_gnews_rss_search(query, max_results=max_results)
        wiki_results = _execute_wikipedia_api_search(query, max_results=max_results)
        api_results = _execute_duckduckgo_api_search(query)
        html_results = _execute_html_search_fallback(query, max_results=max_results)
        
        # Merge results with URL deduplication, prioritizing fresh articles and verified entities
        seen_urls = set()
        for r in gnews_results + wiki_results + api_results + html_results:
            u = r.get("url", "")
            if u and u not in seen_urls:
                seen_urls.add(u)
                results.append(r)
                if len(results) >= max_results * 2:
                    break

    # Step 4: Persist in SQLite cache for deterministic reproduction
    if results:
        discovery_cache.set_cached_query_results(comp_clean, query, results)

    return results


def get_active_search_provider_info() -> Dict[str, Any]:
    """Return status and configuration of the active structured search provider."""
    tavily_key = os.getenv("TAVILY_API_KEY", "").strip()
    has_tavily = bool(tavily_key)
    return {
        "provider": "tavily" if has_tavily else "deterministic_cached_search",
        "has_structured_api_key": has_tavily,
        "cache_enabled": True,
        "cache_ttl_seconds": discovery_cache.DEFAULT_CACHE_TTL_SECONDS,
        "supported_providers": ["tavily", "gnews_rss", "wikipedia_api", "duckduckgo_api", "html_fallback"],
    }
