import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
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


def _fetch_hn_context(company: str) -> List[Dict[str, Any]]:
    """Fetch comparative discussions and alternative writeups from Hacker News Algolia API with timestamps."""
    sources: List[Dict[str, Any]] = []
    queries = [f"{company} alternative", f"{company} vs", f"{company} competitor"]
    
    for q in queries:
        try:
            url = "https://hn.algolia.com/api/v1/search"
            params = {"query": q, "tags": "story", "hitsPerPage": 5}
            resp = requests.get(url, params=params, timeout=10)
            if resp.status_code == 200:
                hits = resp.json().get("hits", [])
                for hit in hits:
                    title = str(hit.get("title", "")).strip()
                    item_url = hit.get("url") or f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
                    created_at_raw = hit.get("created_at") or hit.get("created_at_i")
                    dt = _parse_iso_or_date(created_at_raw)
                    age_flag, date_str = _compute_source_age(dt)

                    if title:
                        sources.append({
                            "source_type": "discussion_and_tech_media",
                            "title": title,
                            "url": item_url,
                            "published_at": date_str,
                            "source_age": age_flag,
                            "text": f"Article title: '{title}'. Published: {date_str or 'unknown'} ({age_flag}). Comparison involving {company} at {item_url}",
                        })
        except Exception as e:
            logger.warning(f"Error querying Hacker News API for '{q}': {e}")

    return sources


def _fetch_github_context(company: str) -> List[Dict[str, Any]]:
    """Fetch open-source and commercial alternatives from GitHub repository search with repository activity dates."""
    sources: List[Dict[str, Any]] = []
    token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token.strip()}"

    queries = [f"{company} alternative", f"{company} vs", f"{company} competitor"]
    for q in queries:
        try:
            url = "https://api.github.com/search/repositories"
            params = {"q": q, "per_page": 5}
            resp = requests.get(url, headers=headers, params=params, timeout=10)
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
            logger.warning(f"Error querying GitHub API for '{q}': {e}")

    return sources


def _fetch_wikipedia_context(company: str) -> List[Dict[str, Any]]:
    """Fetch encyclopedic background and related products from Wikipedia REST API (undated)."""
    sources: List[Dict[str, Any]] = []
    headers = {"User-Agent": "PrismIQ-Intelligence/1.0 (ci@prismiq.ai)"}
    queries = [company, f"{company} software"]

    for q in queries:
        try:
            url = "https://en.wikipedia.org/w/api.php"
            params = {
                "action": "query",
                "list": "search",
                "srsearch": q,
                "format": "json",
                "srlimit": 3,
            }
            resp = requests.get(url, params=params, headers=headers, timeout=10)
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
            logger.warning(f"Error querying Wikipedia API for '{q}': {e}")

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
            "keywords": company,
            "language": "en",
            "apiKey": api_key.strip(),
        }
        resp = requests.get(url, params=params, timeout=10)
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
        logger.warning(f"Error querying Currents API for '{company}': {e}")

    return sources


def fetch_grounded_context(company: str) -> List[Dict[str, Any]]:
    """
    Gather and deduplicate multi-source grounded intelligence context across
    Hacker News, GitHub, Wikipedia, and Currents news, retaining source timestamps.
    """
    raw_sources: List[Dict[str, Any]] = []
    raw_sources.extend(_fetch_hn_context(company))
    raw_sources.extend(_fetch_github_context(company))
    raw_sources.extend(_fetch_wikipedia_context(company))
    raw_sources.extend(_fetch_currents_context(company))

    # Deduplicate sources by URL or Title
    seen = set()
    deduped: List[Dict[str, Any]] = []
    for s in raw_sources:
        key = (s.get("url", "").strip(), s.get("title", "").strip())
        if key not in seen:
            seen.add(key)
            deduped.append(s)

    return deduped


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
    """Extract token counts from Groq usage object and attach to the active LangSmith span."""
    if not usage or not isinstance(usage, dict):
        return
    try:
        run_tree = get_current_run_tree()
        if not run_tree:
            return

        p_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
        c_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
        t_tokens = int(usage.get("total_tokens") or (p_tokens + c_tokens))

        usage_meta = {
            "input_tokens": p_tokens,
            "output_tokens": c_tokens,
            "total_tokens": t_tokens,
        }

        if hasattr(run_tree, "set"):
            run_tree.set(usage_metadata=usage_meta)
        else:
            run_tree.extra = run_tree.extra or {}
            run_tree.extra.setdefault("metadata", {})["usage_metadata"] = usage_meta
    except Exception as e:
        logger.debug(f"Could not attach usage metadata to LangSmith span: {e}")


@traceable(run_type="llm", name="discovery_agent_llm_call")
def _call_groq_discovery(system_prompt: str, user_prompt: str, max_retries: int = 4) -> Dict[str, Any]:
    """Execute Groq completion with JSON object response format, retries, and rate limit backoff."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not set. Returning empty candidate list.")
        return {"candidates": []}

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
        "response_format": {"type": "json_object"},
    }

    for attempt in range(max_retries):
        try:
            resp = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=30)
            if resp.status_code == 429:
                retry_header = resp.headers.get("retry-after", "")
                try:
                    retry_after = float(retry_header)
                except ValueError:
                    retry_after = 2.0 * (attempt + 1)
                logger.warning(f"Groq 429 rate limit hit. Backing off for {retry_after:.1f}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(retry_after)
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
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Error calling Groq API for discovery ({model}): {e}")
                return {"candidates": []}
            time.sleep(1.0)

    return {"candidates": []}


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

    # If no match in verified retrieved sources, strictly return undated
    return "undated", None


def run(company: str, sources: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """
    Run Discovery Agent for the specified target company.
    1. Uses provided sources or fetches grounded intelligence context across all sources with timestamps.
    2. Persists raw retrieved sources for reproducible re-runs and historical audits.
    3. Passes context to LLM with strict anti-hallucination and freshness guardrails.
    4. Normalizes candidate schema (name, rationale, confidence, source, source_age, source_date, freshness_note).
    5. Programmatic freshness guardrail: downgrades High confidence to Medium for 'dated' sources.
    6. Filters out target company itself.
    7. Saves proposal snapshot to data storage.
    """
    company_clean = company.strip()
    if not company_clean:
        return []

    logger.info(f"Running Discovery Agent for target company: '{company_clean}'")
    if sources is None:
        sources = fetch_grounded_context(company_clean)
        # Persist raw retrieved sources for deterministic reproduction
        storage.save_discovery_sources(company_clean, sources)
    logger.info(f"Processing {len(sources)} grounded context snippets for '{company_clean}'")

    if not sources:
        logger.warning(f"No context retrieved for '{company_clean}'. Returning empty candidates.")
        return []

    system_prompt, user_prompt = _build_prompts(company_clean, sources)
    raw_result = _call_groq_discovery(system_prompt, user_prompt)
    raw_candidates = raw_result.get("candidates", [])

    normalized_candidates: List[Dict[str, Any]] = []
    company_lower = company_clean.lower()

    for item in raw_candidates:
        if not isinstance(item, dict):
            continue

        name = str(item.get("name", "")).strip()
        rationale = str(item.get("rationale", "")).strip()
        confidence = _normalize_confidence(item.get("confidence", "Low"))
        source = str(item.get("source", "")).strip()

        # Guardrail: Do not include target company itself
        if not name or name.lower() == company_lower:
            continue

        if not source:
            source = "Retrieved search/comparison context"

        # Extract verified source age & publication date strictly from matched retrieved source
        source_age, source_date = _match_source_metadata(source, sources)

        # STRICT GUARANTEE: If source_age is dated, confidence CANNOT be High
        freshness_note = ""
        if source_age == "dated":
            if confidence == "High":
                confidence = "Medium"  # Downgrade dated source from High to Medium
            date_display = source_date if source_date else "historic"
            freshness_note = f"Sourced {date_display}, not independently confirmed recently"
        elif source_age == "recent":
            freshness_note = f"Recent source ({source_date})" if source_date else "Recent source"
        else:
            # Undated source
            freshness_note = "Undated source (encyclopedic/general)"

        normalized_candidates.append({
            "name": name,
            "rationale": rationale,
            "confidence": confidence,
            "source": source,
            "source_age": source_age,
            "source_date": source_date,
            "freshness_note": freshness_note,
        })

    # Save discovery proposal to storage
    storage.save_discovery_proposal(company_clean, normalized_candidates)
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
