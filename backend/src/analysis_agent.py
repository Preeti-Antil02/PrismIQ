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

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"

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


def _build_prompts(signal: Dict[str, Any]) -> Tuple[str, str]:
    """Construct the system and user prompts for Groq analysis of an Event or Signal."""
    corroboration_info = ""
    if signal.get("corroboration_count", 1) > 1:
        sources_list = ", ".join(signal.get("contributing_sources", []))
        corroboration_info = f"\nCorroboration: {signal.get('corroboration_count')} independent signals ({sources_list})"

    user_prompt = f"""Analyze the following competitive event:
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
- Return JSON with 'why_it_matters' and 'confidence' (High, Medium, or Low)."""
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


@traceable(run_type="llm", name="analysis_agent_llm_call")
def _call_groq(system_prompt: str, user_prompt: str, max_retries: int = 4) -> Dict[str, Any]:
    """Execute API call to Groq to perform intelligence analysis with rate-limit retry handling."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        logger.warning("GROQ_API_KEY not set. Returning unanalyzed fallback.")
        return {
            "why_it_matters": "Analysis unavailable: GROQ_API_KEY not configured.",
            "confidence": "Low",
        }

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
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    for attempt in range(max_retries):
        try:
            response = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=25)
            if response.status_code == 429:
                retry_header = response.headers.get("retry-after", "")
                try:
                    retry_after = float(retry_header)
                except ValueError:
                    retry_after = 2.0 * (attempt + 1)
                logger.warning(f"Groq 429 rate limit hit. Backing off for {retry_after:.1f}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(retry_after)
                continue

            response.raise_for_status()
            res_data = response.json()

            # Attach token usage and cost metadata to active LangSmith span
            usage = res_data.get("usage")
            if usage and isinstance(usage, dict):
                _attach_langsmith_usage(usage, model=model)

            content = res_data["choices"][0]["message"]["content"]
            
            # Clean potential markdown fences
            cleaned_content = re.sub(r"^```json\s*", "", content.strip(), flags=re.IGNORECASE)
            cleaned_content = re.sub(r"\s*```$", "", cleaned_content.strip())
            
            parsed = json.loads(cleaned_content)
            fact_conf = _normalize_confidence(parsed.get("fact_confidence") or parsed.get("confidence", "Low"))
            infer_conf = _normalize_confidence(parsed.get("inference_confidence") or parsed.get("confidence", "Low"))
            blended_conf = _normalize_confidence(parsed.get("confidence") or fact_conf)

            return {
                "why_it_matters": str(parsed.get("why_it_matters", "")).strip(),
                "fact_confidence": fact_conf,
                "inference_confidence": infer_conf,
                "confidence": blended_conf,
            }
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Error calling Groq API ({model}): {e}")
                return {
                    "why_it_matters": f"Analysis failed due to error: {str(e)}",
                    "fact_confidence": "Low",
                    "inference_confidence": "Low",
                    "confidence": "Low",
                }
            time.sleep(1.0)

    return {
        "why_it_matters": "Analysis unavailable due to rate limits.",
        "fact_confidence": "Low",
        "inference_confidence": "Low",
        "confidence": "Low",
    }


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


def run(signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyze a list of normalized signals / consolidated events.
    Produces why_it_matters, fact_confidence, inference_confidence, and legacy confidence for each finding.
    Suppresses speculative LLM analysis on routine individual job postings, routing strategic
    hiring and all news/GitHub signals to Groq for deep analysis.
    """
    findings: List[Dict[str, Any]] = []

    for signal in signals:
        source = signal.get("source", "")
        sources = signal.get("contributing_sources", [source] if source else [])
        is_pure_job = sources == ["jobs"] or source == "jobs"
        corroboration = signal.get("corroboration_count", 1)

        # If it is an individual routine job posting without strategic keywords, suppress speculative why_it_matters
        if is_pure_job and corroboration == 1 and not _is_strategic_hiring_signal(signal):
            title = signal.get("title", "Job Posting").replace("Job Posting: ", "")
            finding = dict(signal)
            finding["why_it_matters"] = f"Routine operational hiring for {title}."
            finding["fact_confidence"] = "High"  # Sourced job posting is a verified fact
            finding["inference_confidence"] = "Low"  # No strategic extrapolation
            finding["confidence"] = "Low"  # Legacy blended priority
            findings.append(finding)
            continue

        system_prompt, user_prompt = _build_prompts(signal)
        analysis = _call_groq(system_prompt, user_prompt)
        
        fact_conf = _normalize_confidence(analysis.get("fact_confidence") or analysis.get("confidence", "Low"))
        infer_conf = _normalize_confidence(analysis.get("inference_confidence") or analysis.get("confidence", "Low"))
        blended_conf = _normalize_confidence(analysis.get("confidence") or fact_conf)

        why_it_matters = analysis.get("why_it_matters", "").strip()
        if not why_it_matters:
            why_it_matters = f"Activity reported in {signal.get('title', 'source')}."

        finding = dict(signal)
        finding["why_it_matters"] = why_it_matters
        finding["fact_confidence"] = fact_conf
        finding["inference_confidence"] = infer_conf
        finding["confidence"] = blended_conf
        findings.append(finding)

    return findings
