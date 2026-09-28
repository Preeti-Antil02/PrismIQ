import concurrent.futures
import json
import logging
import os
import re
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple
from bs4 import BeautifulSoup
import requests

logger = logging.getLogger(__name__)

DEFAULT_REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,application/json,*/*;q=0.8",
}

DISQUALIFYING_SEARCH_DOMAINS = {
    "wikipedia.org", "en.wikipedia.org", "linkedin.com", "twitter.com", "x.com",
    "facebook.com", "instagram.com", "youtube.com", "crunchbase.com", "pitchbook.com",
    "g2.com", "capterra.com", "trustradius.com", "cbinsights.com", "bloomberg.com",
    "reuters.com", "techcrunch.com", "forbes.com", "reddit.com", "github.com",
    "alternativeto.net", "owler.com", "zoominfo.com", "glassdoor.com", "indeed.com"
}


def clean_domain(raw_url_or_domain: str) -> str:
    """Normalize input URL or domain to clean hostname without protocol or path."""
    if not raw_url_or_domain:
        return ""
    clean = str(raw_url_or_domain).strip().lower()
    clean = re.sub(r"^https?://", "", clean)
    clean = clean.split("/")[0].split("?")[0].split("#")[0].strip()
    return clean


def resolve_official_domain(company_name: str, hint_url: Optional[str] = None) -> Optional[str]:
    """
    Resolve the official website domain for a company.
    If hint_url is provided, normalizes and returns it.
    Otherwise, executes a targeted search across DuckDuckGo HTML / Instant Answers to find
    the official homepage, filtering out directory, social, and aggregator domains.
    """
    if hint_url:
        cleaned_hint = clean_domain(hint_url)
        if cleaned_hint and "." in cleaned_hint:
            return cleaned_hint

    clean_name = company_name.strip()
    if not clean_name:
        return None

    # Search queries prioritizing official presence
    search_queries = [
        f'"{clean_name}" official website',
        f'"{clean_name}" homepage',
        f'{clean_name} company website',
    ]

    for q in search_queries:
        try:
            url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(q)}"
            req_headers = dict(DEFAULT_REQUEST_HEADERS)
            resp = requests.get(url, headers=req_headers, timeout=4)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                results = soup.select(".result__url") or soup.select(".result__title a")
                for r in results:
                    href = r.get("href", "") or r.get_text(strip=True)
                    # DuckDuckGo redirect link extraction: /l/?uddg=http%3A%2F%2F...
                    if "uddg=" in href:
                        match = re.search(r"uddg=([^&]+)", href)
                        if match:
                            href = urllib.parse.unquote(match.group(1))
                    
                    domain = clean_domain(href)
                    if not domain or "." not in domain:
                        continue
                    
                    # Reject aggregator/social domains
                    if any(domain == d or domain.endswith("." + d) for d in DISQUALIFYING_SEARCH_DOMAINS):
                        continue

                    return domain
        except Exception as e:
            logger.debug(f"Domain search error for query '{q}': {e}")

    # Fallback: check if company name has a direct .com / .ai / .io / .in match
    cand_slug = re.sub(r'[^a-z0-9]+', '', clean_name.lower())
    if cand_slug:
        for tld in [".com", ".ai", ".in", ".io"]:
            try:
                test_domain = f"{cand_slug}{tld}"
                test_url = f"https://{test_domain}"
                test_resp = requests.head(test_url, headers=DEFAULT_REQUEST_HEADERS, timeout=2.5, allow_redirects=True)
                if test_resp.status_code < 400:
                    final_domain = clean_domain(test_resp.url)
                    return final_domain
            except Exception:
                pass

    return None


def fetch_company_page_text(url_or_domain: str, max_chars: int = 4000) -> Tuple[str, List[str]]:
    """
    Fetch visible text from company homepage and up to 2 key subpages (/about, /products, /features).
    Returns (aggregated_clean_text, list_of_fetched_urls).
    """
    clean_dom = clean_domain(url_or_domain)
    if not clean_dom:
        return "", []

    base_url = f"https://{clean_dom}"
    fetched_urls = []
    text_chunks = []

    def _fetch_single_page(target_url: str) -> Tuple[str, List[str]]:
        try:
            resp = requests.get(target_url, headers=DEFAULT_REQUEST_HEADERS, timeout=4)
            if resp.status_code != 200:
                return "", []
            
            soup = BeautifulSoup(resp.text, "html.parser")
            
            # Extract internal subpage links before stripping tags
            internal_links = []
            for a in soup.find_all("a", href=True):
                href = a["href"].strip()
                if any(k in href.lower() for k in ["about", "product", "features", "solutions", "enterprise", "services", "pricing"]):
                    full_link = urllib.parse.urljoin(target_url, href)
                    if clean_domain(full_link) == clean_dom and full_link not in internal_links and full_link != target_url:
                        internal_links.append(full_link)

            # Strip non-content elements
            for tag in soup(["script", "style", "nav", "footer", "noscript", "svg", "header"]):
                tag.decompose()

            text = soup.get_text(separator=" ", strip=True)
            text = re.sub(r"\s+", " ", text).strip()
            return text, internal_links[:4]
        except Exception as e:
            logger.debug(f"Error fetching page {target_url}: {e}")
            return "", []

    # 1. Fetch homepage
    home_text, subpage_links = _fetch_single_page(base_url)
    if not home_text:
        # Retry with http:// if https failed
        home_text, subpage_links = _fetch_single_page(f"http://{clean_dom}")
        if home_text:
            base_url = f"http://{clean_dom}"

    if home_text:
        fetched_urls.append(base_url)
        text_chunks.append(home_text[:2500])

    # 2. Fetch up to 2 key subpages in parallel
    if subpage_links:
        subpages_to_fetch = subpage_links[:2]
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            future_to_url = {pool.submit(_fetch_single_page, url): url for url in subpages_to_fetch}
            for fut in concurrent.futures.as_completed(future_to_url):
                sub_url = future_to_url[fut]
                try:
                    sub_text, _ = fut.result()
                    if sub_text and len(sub_text) > 100:
                        fetched_urls.append(sub_url)
                        text_chunks.append(sub_text[:1500])
                except Exception:
                    pass

    combined_text = "\n\n".join(text_chunks)[:max_chars]
    return combined_text, fetched_urls


COMPANY_PROFILER_SYSTEM_PROMPT = """You are the Principal Enterprise Architecture and Market Strategy Analyst for PrismIQ.
Your mission is to analyze the provided raw, fetched website text for a target company and produce a high-precision, grounded structured profile.

OUTPUT CONTRACT:
Return ONLY a valid JSON object with the following schema:
{
  "summary": "1 to 2 concise sentences describing what the company builds, its core technology, and target market.",
  "segments": [
    {
      "segment_id": "short_unique_slug_e_g_interview_coaching",
      "name": "Human-Readable Segment Name (e.g. AI Interview & Communication Coaching)",
      "target_customers": "Primary user personas or enterprise buyers (e.g. Job seekers, students, enterprise HR)",
      "what_it_does": "Plain words explanation of the specific capability and business function.",
      "verbatim_quote": "Exact 5 to 15 word quote taken directly from the fetched page text proving this offering exists.",
      "search_queries": [
        "Concise competitor search query 1 for this capability (e.g. AI mock interview practice competitors)",
        "Concise competitor search query 2 for this capability (e.g. AI interview coaching alternatives)"
      ]
    }
  ]
}

STRICT GROUNDING INVARIANTS:
1. MULTI-PRODUCT COMPANIES MUST YIELD MULTIPLE SEGMENTS: If the company offers distinct capabilities (e.g. interview coaching AND personal fashion styling), output separate segments for each. Maximum 4 segments.
2. VERBATIM QUOTE REQUIREMENT: Every segment MUST include a verbatim quote (5 to 15 words) that actually appears in the provided source text. DO NOT fabricate or paraphrase the quote.
3. GROUNDED ONLY: Base your output STRICTLY on the provided text. DO NOT hallucinate segments from memory. If the text does not substantiate an offering, do not include it.
"""


def _extract_profile_via_llm(
    company_name: str,
    web_text: str,
    call_groq_fn: Any,
) -> Optional[Dict[str, Any]]:
    """
    Call LLM to extract structured multi-segment profile from fetched web text.
    Uses bounded tokens to strictly stay within Groq daily token budget.
    """
    if not web_text or len(web_text.strip()) < 120:
        return None

    user_prompt = f"""Target Company: {company_name}

Fetched Official Web Content:
\"\"\"
{web_text}
\"\"\"

Analyze the official text above. Extract the company summary and all distinct product/capability segments with verbatim quotes and competitor search queries adhering strictly to the JSON schema."""

    try:
        res = call_groq_fn(COMPANY_PROFILER_SYSTEM_PROMPT, user_prompt, max_retries=2)
        if isinstance(res, dict) and ("segments" in res or "summary" in res):
            return res
        return None
    except Exception as e:
        logger.warning(f"Error calling LLM for company profile extraction: {e}")
        return None


def resolve_company_profile(
    company_name: str,
    website: Optional[str] = None,
    description: Optional[str] = None,
    call_groq_fn: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Execute full Company Profile Resolution workflow (Specification Part A):
    1. Resolve official web domain (from website hint or search).
    2. Fetch actual web pages (homepage + key subpages).
    3. Ground profile in fetched text with verbatim quote verification per segment.
    4. If web presence is thin/unavailable, gracefully fall back to user description without guessing.
    5. Tag multi-product companies with distinct segments and segment-based search queries.
    """
    clean_name = company_name.strip()
    clean_hint_web = clean_domain(website) if website else None
    clean_desc = description.strip() if description else ""

    # Import call_groq_discovery if not injected
    if call_groq_fn is None:
        from src import discovery_agent
        call_groq_fn = discovery_agent._call_groq_discovery

    domain = resolve_official_domain(clean_name, hint_url=clean_hint_web)
    fetched_text = ""
    fetched_urls = []

    if domain:
        fetched_text, fetched_urls = fetch_company_page_text(domain)

    # If web text was successfully retrieved, extract profile grounded in fetched text
    raw_profile = None
    if fetched_text and len(fetched_text) >= 150:
        raw_profile = _extract_profile_via_llm(clean_name, fetched_text, call_groq_fn)

    # Validate verbatim quotes to ensure grounding in fetched text
    valid_segments = []
    text_lower = fetched_text.lower() if fetched_text else ""

    if raw_profile and "segments" in raw_profile:
        for seg in raw_profile.get("segments", []):
            if not isinstance(seg, dict):
                continue
            seg_id = re.sub(r'[^a-z0-9_]+', '', str(seg.get("segment_id", "")).lower().replace(" ", "_"))
            name = str(seg.get("name", "")).strip()
            what = str(seg.get("what_it_does", "")).strip()
            target_cust = str(seg.get("target_customers", "")).strip()
            quote = str(seg.get("verbatim_quote", "")).strip()
            queries = [str(q).strip() for q in seg.get("search_queries", []) if str(q).strip()]

            if not name or not what:
                continue

            # Grounding check: verify that words from quote appear in the fetched text
            quote_clean = re.sub(r'[^\w\s]+', '', quote.lower()).strip()
            words_in_quote = [w for w in quote_clean.split() if len(w) > 3]
            is_grounded = False
            if quote_clean and quote_clean in text_lower:
                is_grounded = True
            elif words_in_quote and sum(1 for w in words_in_quote if w in text_lower) >= max(2, len(words_in_quote) * 0.7):
                is_grounded = True

            # If grounded, keep segment
            if is_grounded or not text_lower:
                valid_segments.append({
                    "segment_id": seg_id or f"segment_{len(valid_segments) + 1}",
                    "name": name,
                    "target_customers": target_cust or "Enterprise & consumer users",
                    "what_it_does": what,
                    "verbatim_quote": quote if is_grounded else "",
                    "search_queries": queries or [f"{name} competitors", f"{name} alternatives"],
                })

    summary = ""
    if raw_profile and raw_profile.get("summary"):
        summary = str(raw_profile["summary"]).strip()

    # Fallback to user-provided description if web retrieval failed or produced no valid segments
    profile_source = "company_website"
    confidence = "High" if len(valid_segments) > 0 else "Low"
    is_low_confidence = False

    if not valid_segments:
        if clean_desc:
            # Ground profile in the user-provided description
            logger.info(f"Using user-provided description as ground profile for '{clean_name}'.")
            summary = clean_desc
            profile_source = "user_provided"
            confidence = "Medium"
            valid_segments = [{
                "segment_id": "core_offering",
                "name": f"{clean_name} Core Offering",
                "target_customers": "Prospective customers",
                "what_it_does": clean_desc,
                "verbatim_quote": clean_desc[:60],
                "search_queries": [
                    f"{clean_desc[:40]} competitors",
                    f"{clean_desc[:40]} alternatives",
                ],
            }]
        else:
            # Thin web presence and no user description -> Honest low confidence state
            logger.warning(f"Could not resolve confident profile for '{clean_name}' from web or input.")
            profile_source = "thin_web_presence"
            confidence = "Low"
            is_low_confidence = True
            summary = f"Limited public web information found for {clean_name}."
            valid_segments = []

    return {
        "company_name": clean_name,
        "domain": domain or clean_hint_web,
        "summary": summary,
        "segments": valid_segments,
        "confidence": confidence,
        "profile_source": profile_source,
        "is_low_confidence": is_low_confidence,
        "fetched_urls": fetched_urls,
        "evidence_text_length": len(fetched_text),
    }
