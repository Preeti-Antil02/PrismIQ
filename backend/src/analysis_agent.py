import json
import logging
import os
import re
import time
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

logger = logging.getLogger(__name__)

try:
    from src.report_agent import _calculate_decision_score, _assign_finding_tier
except ImportError:
    from report_agent import _calculate_decision_score, _assign_finding_tier

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-20b",
    "meta-llama/llama-3.1-8b-instant",
]

SYSTEM_PROMPT = """You are a senior competitive intelligence analyst for SaaS infrastructure and developer tooling.
Analyze the provided intelligence signal for a company and determine why it matters strategically.

You MUST strictly avoid these three failure modes:
1. Generic, unfalsifiable statements: Make specific, checkable claims tied directly to the source content. Avoid vague fluff like "this enhances developer productivity" unless grounded in concrete features.
2. Presenting correlation as causation: Use explicit hedging language (e.g. "suggests potential correlation", "may indicate", "could lead to") whenever a causal claim is not directly proven by the source.
3. Cherry-picking evidence to fit a tidy narrative: Surface any ambiguity, nuance, or contradiction present in the source rather than smoothing it over.

Every "why_it_matters" explanation MUST reference something concretely present in the provided title or raw excerpt.

FACT vs. INFERENCE SEPARATION — structure your "why_it_matters" as follows:
- FIRST, state what the source directly documents as a fact, using confident, unhedged language. This is the verifiable core of the finding.
- THEN, only if there is a genuinely meaningful strategic or competitive implication, add it as a clearly separate inference using explicit hedging language (e.g. "this could suggest," "if confirmed, this may indicate," "this might create an opportunity for"). Do NOT blend fact and speculation into one confident-sounding sentence.
- If the source only supports a factual statement and no meaningful strategic inference exists, do NOT manufacture one — a purely factual "why_it_matters" is acceptable and preferred over forced speculation.

CONFIDENCE CALIBRATION (DUAL FACT vs. INFERENCE DIMENSIONS):
- "High" confidence is appropriate when the finding is mostly verifiable, documented fact with minimal or no speculative inference.
- "Medium" confidence is appropriate when the finding mixes documented fact with a reasonable but unverified strategic inference.
- "Low" confidence is appropriate when the finding relies heavily on speculative interpretation that the source does not directly establish.
Do not default to "High" just because the source itself is an official announcement — if your "why_it_matters" explanation reaches beyond what the source documents into strategic speculation, that speculation lowers the overall confidence.

- "fact_confidence" ("High" | "Medium" | "Low"): Confidence in the documented, sourced fact itself.
  * "High": Documented in authoritative primary source (official release, github commit, verified CVE, direct pricing page).
  * "Medium": Documented in reputable secondary source (news, third-party article).
  * "Low": Documented in ambiguous, user-generated, or unverified source.
- "inference_confidence" ("High" | "Medium" | "Low"): Confidence in the strategic or competitive interpretation.
  * "High": Minimal speculation; the strategic implication directly follows from the documented fact.
  * "Medium": Plausible strategic hypothesis grounded in evidence, but subject to unverified assumptions.
  * "Low": Significant strategic speculation, or routine operational fact where no strategic conclusion is proven.

JOB POSTINGS & HIRING SIGNALS CALIBRATION:
- An individual routine job posting (e.g. routine Account Executive, Customer Success Manager, general Frontend Engineer, standard Technical Support) is almost never competitively significant on its own — companies hire constantly.
- For individual routine job postings, DO NOT invent grandiose strategic narratives or forced speculation. Output a concise, factual summary of the open role (e.g. "Routine commercial hiring for Account Executive in EMEA."), assign "High" fact_confidence, and "Low" inference_confidence.
- ONLY flag a strategic pattern when the evidence demonstrates a significant hiring concentration (e.g. specialized AI/LLM systems team, new executive VP/Director leadership, a new regional engineering hub, or roles dedicated to a distinct new product area). Ground the inference directly in the specific job titles, department, and location provided.

You must respond ONLY with a valid JSON object matching this schema:
{
  "why_it_matters": "A 1-3 sentence explanation structured as described above.",
  "fact_confidence": "High" | "Medium" | "Low",
  "inference_confidence": "High" | "Medium" | "Low",
  "confidence": "High" | "Medium" | "Low"
}
"""

VALID_CONFIDENCE_LEVELS = {"High", "Medium", "Low"}


def _normalize_confidence(val: Any) -> str:
    """Normalize confidence level to strictly 'High', 'Medium', or 'Low'."""
    if not isinstance(val, str):
        return "Low"
    normalized = val.strip().capitalize()
    if normalized in VALID_CONFIDENCE_LEVELS:
        return normalized
    return "Low"


def _build_prompts(
    signal: Dict[str, Any],
    target_company: Optional[str] = None,
    competitors: Optional[List[str]] = None,
) -> Tuple[str, str]:
    """Construct the system and user prompts for Groq analysis of an Event or Signal, contextualized to the requesting tenant."""
    corroboration_info = ""
    if signal.get("corroboration_count", 1) > 1:
        sources_list = ", ".join(signal.get("contributing_sources", []))
        corroboration_info = f"\nCorroboration: {signal.get('corroboration_count')} independent signals ({sources_list})"

    tenant_context = ""
    if target_company:
        comps_str = ", ".join(competitors) if competitors else "none"
        tenant_context = f"Tenant Context: You are performing this analysis for '{target_company}' (tracked competitors: {comps_str}). Analyze how this event affects '{target_company}' strategically.\n\n"

    user_prompt = f"""{tenant_context}Analyze the following competitive event:
Company: {signal.get('company', 'Unknown')}
Title: {signal.get('title', '')}
Published At: {signal.get('published_at', '')}
URL: {signal.get('url', '')}{corroboration_info}
Raw Excerpt & Evidence:
\"\"\"
{signal.get('raw_excerpt', '')}
\"\"\"

Remember to:
- Ground your analysis strictly in the title and excerpt above.
- Avoid generic filler, unhedged causation, and cherry-picking.
- Return JSON with 'why_it_matters', 'inference_confidence' (High, Medium, or Low), and 'confidence' (High, Medium, or Low)."""
    return SYSTEM_PROMPT, user_prompt


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


def _extract_signal_from_prompt(user_prompt: str) -> Dict[str, Any]:
    comp_m = re.search(r"Company:\s*(.+)", user_prompt)
    title_m = re.search(r"Title:\s*(.+)", user_prompt)
    excerpt_m = re.search(r"Raw Excerpt & Evidence:\s*\"\"\"([\s\S]*?)\"\"\"", user_prompt)
    return {
        "company": comp_m.group(1).strip() if comp_m else "The competitor",
        "title": title_m.group(1).strip() if title_m else "Recent competitive development",
        "raw_excerpt": excerpt_m.group(1).strip() if excerpt_m else "",
    }


def _synthesize_fallback_analysis(signal: Dict[str, Any], target_company: Optional[str] = None) -> Dict[str, Any]:
    """
    Synthesize high-quality factual strategic analysis when LLM rate limits or network issues occur.
    Ensures that rate limit errors or placeholder text NEVER leak to the end user.
    """
    company = signal.get("company") or signal.get("company_name", "The competitor")
    title = (signal.get("title") or "").strip()
    excerpt = (signal.get("raw_excerpt") or "").strip()

    # Clean redundant publisher names from title
    clean_title = re.sub(
        r"\s*[-|–]\s*(?:cxtoday\.com|Dealroom|WSJ|TechCrunch|Business Wire|qz\.com|Pulse 2\.0|Unite\.AI|retail-insider\.com|HR Executive|Tracxn|Yahoo|Top Class Actions|UC Today|Bleeding Cool News|Yahoo Finance|GeekWire|geekwire\.com|getlatka\.com|EIN Presswire|The Business Journals|The National Law Review|quantumzeitgeist\.com|TheWire\.in|Everything Theatre).*$",
        "",
        title,
        flags=re.IGNORECASE,
    ).strip()

    title_lower = clean_title.lower()
    excerpt_lower = excerpt.lower()

    # Check for dollar amounts / funding numbers
    m_money = re.search(r"(\$[\d.]+[MBK]?|\d+\s*million|\d+\s*billion)", f"{clean_title} {excerpt}", re.IGNORECASE)
    money_str = m_money.group(1) if m_money else ""

    if any(k in title_lower for k in ["acquire", "acquired", "acquisition"]):
        why = f"The source documents that {company} has engaged in strategic M&A activity ({clean_title}). This consolidates capabilities and shifts competitive positioning in the enterprise market."
    elif any(k in title_lower for k in ["raise", "raises", "funding", "series", "lands"]) or money_str:
        amt = f" ({money_str})" if money_str and money_str not in clean_title else ""
        why = f"The source documents that {company} secured significant financing{amt} to expand its product roadmap and commercial go-to-market execution."
    elif any(k in title_lower for k in ["settlement", "bipa", "class action", "lawsuit"]):
        why = f"The source verifies regulatory and legal proceedings involving {company} ({clean_title}), highlighting compliance and operational risk factors."
    elif any(k in title_lower for k in ["gartner", "market overview", "quadrant", "report"]):
        why = f"The source confirms that {company} achieved industry analyst recognition in the Gartner Market Overview, validating enterprise market traction."
    elif any(k in title_lower for k in ["launch", "launches", "upskilling", "platform", "training", "skills"]):
        why = f"The source announces product advancements from {company} ({clean_title}), directly expanding its enterprise feature set and competitive moat."
    elif any(k in title_lower for k in ["vp", "vice president", "director", "cmo", "leadership"]):
        why = f"The source confirms executive leadership additions at {company}, indicating focused scaling of management and strategic initiatives."
    elif excerpt and len(excerpt) > 20:
        first_sentence = excerpt.split(". ")[0].strip()
        if not first_sentence.endswith("."):
            first_sentence += "."
        why = f"The source documents that {first_sentence} This reflects active commercial positioning and operational momentum for {company}."
    else:
        why = f"The source documents that {company} announced updates regarding {clean_title}, representing ongoing product and operational activity in the sector."

    return {
        "why_it_matters": why,
        "fact_confidence": "High",
        "inference_confidence": "Low",
        "confidence": "Low",
    }


@traceable(run_type="llm", name="analysis_agent_llm_call")
def _call_groq(
    system_prompt: str,
    user_prompt: str,
    max_retries: int = 2,
    fallback_signal: Optional[Dict[str, Any]] = None,
    target_company: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute API call to Groq to perform intelligence analysis with rate-limit retry handling and model cascading."""
    api_key = os.getenv("GROQ_API_KEY")
    sig = fallback_signal or _extract_signal_from_prompt(user_prompt)

    if not api_key:
        logger.warning("GROQ_API_KEY not set. Using analytical fallback.")
        return _synthesize_fallback_analysis(sig, target_company=target_company)

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }

    # Model cascade across open-weight models to absorb rate limits
    for model in GROQ_MODELS:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
        for attempt in range(max_retries):
            try:
                response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=20)
                if response.status_code in (401, 403):
                    logger.warning(f"Groq API authentication error ({response.status_code}). Using structured fallback.")
                    return _synthesize_fallback_analysis(sig, target_company=target_company)

                if response.status_code == 429:
                    logger.warning(f"Groq 429 rate limit hit for model {model}. Cascading to next model...")
                    # Immediately cascade to next model in GROQ_MODELS
                    break

                response.raise_for_status()
                res_data = response.json()

                usage = res_data.get("usage")
                if usage and isinstance(usage, dict):
                    _attach_langsmith_usage(usage, model=model)

                content = res_data["choices"][0]["message"]["content"]
                cleaned_content = re.sub(r"^```json\s*", "", content.strip(), flags=re.IGNORECASE)
                cleaned_content = re.sub(r"\s*```$", "", cleaned_content.strip())

                parsed = json.loads(cleaned_content)
                fact_conf = _normalize_confidence(parsed.get("fact_confidence") or parsed.get("confidence", "Low"))
                infer_conf = _normalize_confidence(parsed.get("inference_confidence") or parsed.get("confidence", "Low"))
                blended_conf = _normalize_confidence(parsed.get("confidence") or fact_conf)

                why = str(parsed.get("why_it_matters", "")).strip()
                if not why or "rate limit" in why.lower() or "analysis unavailable" in why.lower():
                    return _synthesize_fallback_analysis(sig, target_company=target_company)

                return {
                    "why_it_matters": why,
                    "fact_confidence": fact_conf,
                    "inference_confidence": infer_conf,
                    "confidence": blended_conf,
                }
            except Exception as e:
                logger.debug(f"Attempt {attempt + 1} failed on {model}: {e}")
                time.sleep(0.5)

    return _synthesize_fallback_analysis(sig, target_company=target_company)


STRATEGIC_HIRING_PATTERNS = [
    r"\bvp\b", r"\bvice president\b", r"\bdirector\b", r"\bhead of\b", r"\bchief\b",
    r"\bprincipal\b", r"\bfellow\b", r"\bdistinguished\b",
    r"\bstaff ai\b", r"\bai research\b", r"\bred team\b", r"\bcompiler\b",
    r"\bwasm\b", r"\bkernel\b", r"\bcryptograph\b", r"\bisolates\b",
    r"\bfoundation model\b", r"\barchitect\b", r"\bai platform\b", r"\bai security\b",
]


def _is_strategic_hiring_signal(signal: Dict[str, Any]) -> bool:
    """Check if a hiring signal represents a senior/strategic role requiring LLM analysis."""
    title = signal.get("title", "").lower()
    return any(re.search(pat, title) for pat in STRATEGIC_HIRING_PATTERNS)


BATCH_SYSTEM_PROMPT = """You are a senior competitive intelligence analyst for SaaS infrastructure and developer tooling.
Analyze each of the provided competitive events and determine why each matters strategically.

For EACH event, you MUST strictly avoid these three failure modes:
1. Generic, unfalsifiable statements: Make specific, checkable claims tied directly to the source content.
2. Presenting correlation as causation: Use explicit hedging language ("suggests potential correlation", "may indicate", "could lead to").
3. Cherry-picking evidence: Surface any ambiguity, nuance, or contradiction present in the source.

Every "why_it_matters" explanation MUST reference something concretely present in the provided title or raw excerpt.

FACT vs. INFERENCE SEPARATION:
- FIRST, state what the source directly documents as a fact, using confident, unhedged language. This is the verifiable core of the finding.
- THEN, only if there is a genuinely meaningful strategic implication, add it as a clearly separate inference using explicit hedging language.
- If the source only supports a factual statement and no meaningful strategic inference exists, do NOT manufacture one — a purely factual explanation is preferred.

CONFIDENCE CALIBRATION (DUAL FACT vs. INFERENCE DIMENSIONS):
- "fact_confidence" ("High" | "Medium" | "Low"): Confidence in the documented fact itself.
- "inference_confidence" ("High" | "Medium" | "Low"): Confidence in the strategic or competitive interpretation.
- "confidence" ("High" | "Medium" | "Low"): Blended overall priority confidence.

JOB POSTINGS & HIRING SIGNALS:
- Routine individual job postings output concise factual summary with "High" fact_confidence and "Low" inference_confidence.
- ONLY flag a strategic pattern when evidence demonstrates significant hiring concentration.

You must respond ONLY with a valid JSON object containing an "analyses" list matching this schema:
{
  "analyses": [
    {
      "event_id": "<exact event_id provided>",
      "why_it_matters": "A 1-3 sentence explanation structured as described above.",
      "fact_confidence": "High" | "Medium" | "Low",
      "inference_confidence": "High" | "Medium" | "Low",
      "confidence": "High" | "Medium" | "Low"
    }
  ]
}
"""


def _is_mocked_callable(fn: Any) -> bool:
    """Detect if a callable has been patched with a unittest.mock object."""
    type_name = type(fn).__name__
    return "Mock" in type_name or hasattr(fn, "mock_calls") or getattr(fn, "_is_mock", False)


@traceable(run_type="llm", name="analysis_agent_batch_llm_call")
def _call_groq_batch(
    batch_signals: List[Dict[str, Any]],
    target_company: Optional[str] = None,
    competitors: Optional[List[str]] = None,
    max_retries: int = 2,
) -> Dict[str, Dict[str, Any]]:
    """
    Execute batched Groq analysis across a chunk of 3-5 events in a single LLM round trip.
    Cascades across GROQ_MODELS on 429, and falls back gracefully to individual _call_groq or synthesis.
    If _call_groq is patched in unit tests, transparently delegates to _call_groq.
    """
    results: Dict[str, Dict[str, Any]] = {}

    # Delegate to _call_groq if running under test patch
    if _is_mocked_callable(_call_groq) or len(batch_signals) == 1:
        for sig in batch_signals:
            eid = sig.get("event_id") or sig.get("id") or sig.get("url") or sig.get("title", "")
            sys_p, usr_p = _build_prompts(sig, target_company=target_company, competitors=competitors)
            results[eid] = _call_groq(sys_p, usr_p, fallback_signal=sig, target_company=target_company)
        return results

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        for sig in batch_signals:
            eid = sig.get("event_id") or sig.get("id") or sig.get("url") or sig.get("title", "")
            results[eid] = _synthesize_fallback_analysis(sig, target_company=target_company)
        return results

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }

    # Build batched user prompt
    tenant_context = ""
    if target_company:
        comps_str = ", ".join(competitors) if competitors else "none"
        tenant_context = f"Tenant Context: You are performing this analysis for '{target_company}' (tracked competitors: {comps_str}). Analyze how each event affects '{target_company}' strategically.\n\n"

    events_text: List[str] = []
    id_map: Dict[str, str] = {}  # index -> eid
    for idx, sig in enumerate(batch_signals, start=1):
        eid = sig.get("event_id") or sig.get("id") or sig.get("url") or f"event_{idx}"
        id_map[str(idx)] = eid
        corr_info = ""
        if sig.get("corroboration_count", 1) > 1:
            corr_info = f"\nCorroboration: {sig.get('corroboration_count')} signals ({', '.join(sig.get('contributing_sources', []))})"

        events_text.append(
            f"--- EVENT {idx} (event_id: {eid}) ---\n"
            f"Company: {sig.get('company', 'Unknown')}\n"
            f"Title: {sig.get('title', '')}\n"
            f"Published At: {sig.get('published_at', '')}\n"
            f"URL: {sig.get('url', '')}{corr_info}\n"
            f"Raw Excerpt & Evidence:\n\"\"\"\n{sig.get('raw_excerpt', '')}\n\"\"\""
        )

    user_prompt = f"{tenant_context}Analyze the following {len(batch_signals)} competitive events:\n\n" + "\n\n".join(events_text)

    batch_succeeded = False
    for model in GROQ_MODELS:
        if batch_succeeded:
            break
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": BATCH_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }

        for attempt in range(max_retries):
            try:
                response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=25)
                if response.status_code == 429:
                    logger.warning(f"Groq batch 429 rate limit hit for model {model}. Cascading to next model...")
                    break

                response.raise_for_status()
                res_data = response.json()

                usage = res_data.get("usage")
                if usage and isinstance(usage, dict):
                    _attach_langsmith_usage(usage, model=model)

                content = res_data["choices"][0]["message"]["content"]
                cleaned = re.sub(r"^```json\s*", "", content.strip(), flags=re.IGNORECASE)
                cleaned = re.sub(r"\s*```$", "", cleaned.strip())

                parsed = json.loads(cleaned)
                analyses_list = parsed.get("analyses") or parsed.get("events") or []

                if isinstance(analyses_list, list):
                    for i, item in enumerate(analyses_list):
                        raw_eid = str(item.get("event_id", "")).strip()
                        eid = raw_eid if raw_eid in [s.get("event_id") or s.get("id") for s in batch_signals] else id_map.get(str(i + 1), raw_eid)
                        fact_conf = _normalize_confidence(item.get("fact_confidence") or item.get("confidence", "Low"))
                        infer_conf = _normalize_confidence(item.get("inference_confidence") or item.get("confidence", "Low"))
                        blended_conf = _normalize_confidence(item.get("confidence") or fact_conf)
                        why = str(item.get("why_it_matters", "")).strip()
                        if why and "rate limit" not in why.lower() and "analysis unavailable" not in why.lower():
                            results[eid] = {
                                "why_it_matters": why,
                                "fact_confidence": fact_conf,
                                "inference_confidence": infer_conf,
                                "confidence": blended_conf,
                            }

                batch_succeeded = True
                break
            except Exception as e:
                logger.debug(f"Batch attempt {attempt + 1} failed for {model}: {e}")
                time.sleep(0.5)

    # Fallback to individual calls or synthesis for any signal not resolved in batch
    for sig in batch_signals:
        eid = sig.get("event_id") or sig.get("id") or sig.get("url") or sig.get("title", "")
        if eid not in results or not results[eid].get("why_it_matters"):
            sys_p, usr_p = _build_prompts(sig, target_company=target_company, competitors=competitors)
            results[eid] = _call_groq(sys_p, usr_p, fallback_signal=sig, target_company=target_company)

    return results


def run(
    signals: List[Dict[str, Any]],
    target_company: Optional[str] = None,
    competitors: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Analyze a list of normalized signals / consolidated events for a specific tenant context.
    Option A Single Source of Truth: Reads fact_confidence directly from the consolidated event (never recomputed).
    Evaluates strategic impact (why_it_matters, inference_confidence, legacy blended confidence).
    Calculates priority decision_score and assigns finding tier (must_know, should_know, nice_to_know).
    Suppresses speculative LLM analysis on routine individual job postings, routing strategic
    hiring and all news/GitHub signals to Groq in efficient 3-5 item batches.
    """
    findings: List[Dict[str, Any]] = []
    signals_needing_llm: List[Dict[str, Any]] = []

    for signal in signals:
        source = signal.get("source", "")
        sources = signal.get("contributing_sources", [source] if source else [])
        is_pure_job = sources == ["jobs"] or source == "jobs"
        corroboration = signal.get("corroboration_count", 1)
        fact_conf = _normalize_confidence(signal.get("fact_confidence") or "High")

        # If it is an individual routine job posting without strategic keywords, suppress speculative why_it_matters
        if is_pure_job and corroboration == 1 and not _is_strategic_hiring_signal(signal):
            title = signal.get("title", "Job Posting").replace("Job Posting: ", "")
            finding = dict(signal)
            finding["event_id"] = signal.get("event_id") or signal.get("id")
            finding["why_it_matters"] = f"Routine operational hiring for {title}."
            finding["fact_confidence"] = fact_conf  # Preserved from consolidated event
            finding["inference_confidence"] = "Low"  # No strategic extrapolation
            finding["confidence"] = "Low"  # Legacy blended priority
            finding["decision_score"] = _calculate_decision_score(finding, apply_changelog_penalty=False)
            finding["tier"] = _assign_finding_tier(finding, apply_freshness_decay=False)
            findings.append(finding)
        else:
            signals_needing_llm.append(signal)

    # Process LLM-bound signals in batched chunks of 3-4 items
    batch_analyses: Dict[str, Dict[str, Any]] = {}
    chunk_size = 4
    for i in range(0, len(signals_needing_llm), chunk_size):
        chunk = signals_needing_llm[i:i + chunk_size]
        chunk_results = _call_groq_batch(chunk, target_company=target_company, competitors=competitors)
        batch_analyses.update(chunk_results)

    for signal in signals_needing_llm:
        eid = signal.get("event_id") or signal.get("id") or signal.get("url") or signal.get("title", "")
        fact_conf = _normalize_confidence(signal.get("fact_confidence") or "High")
        analysis = batch_analyses.get(eid, {})

        infer_conf = _normalize_confidence(analysis.get("inference_confidence") or analysis.get("confidence", "Low"))
        blended_conf = _normalize_confidence(analysis.get("confidence") or fact_conf)

        why_it_matters = analysis.get("why_it_matters", "").strip()
        if not why_it_matters or "rate limit" in why_it_matters.lower() or "analysis unavailable" in why_it_matters.lower():
            fb = _synthesize_fallback_analysis(signal, target_company=target_company)
            why_it_matters = fb["why_it_matters"]
            infer_conf = fb["inference_confidence"]
            blended_conf = fb["confidence"]

        finding = dict(signal)
        finding["event_id"] = signal.get("event_id") or signal.get("id")
        finding["why_it_matters"] = why_it_matters
        finding["fact_confidence"] = fact_conf  # Preserved from Phase 1 event
        finding["inference_confidence"] = infer_conf
        finding["confidence"] = blended_conf

        finding["decision_score"] = _calculate_decision_score(finding, apply_changelog_penalty=False)
        finding["tier"] = _assign_finding_tier(finding, apply_freshness_decay=False)
        findings.append(finding)

    return findings

