import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Tuple
import requests

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

CONFIDENCE CALIBRATION:
- "High" confidence is appropriate when the finding is mostly verifiable, documented fact with minimal or no speculative inference.
- "Medium" confidence is appropriate when the finding mixes documented fact with a reasonable but unverified strategic inference.
- "Low" confidence is appropriate when the finding relies heavily on speculative interpretation that the source does not directly establish.
Do not default to "High" just because the source itself is an official announcement — if your "why_it_matters" explanation reaches beyond what the source documents into strategic speculation, that speculation lowers the overall confidence.

You must respond ONLY with a valid JSON object matching this schema:
{
  "why_it_matters": "A 1-3 sentence explanation structured as described above.",
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
    """Construct the system and user prompts for Groq analysis."""
    user_prompt = f"""Analyze the following competitive signal:
Company: {signal.get('company', 'Unknown')}
Source: {signal.get('source', 'Unknown')}
Title: {signal.get('title', '')}
Published At: {signal.get('published_at', '')}
URL: {signal.get('url', '')}
Raw Excerpt:
\"\"\"
{signal.get('raw_excerpt', '')}
\"\"\"

Remember to:
- Ground your analysis strictly in the title and excerpt above.
- Avoid generic filler, unhedged causation, and cherry-picking.
- Return JSON with 'why_it_matters' and 'confidence' (High, Medium, or Low)."""
    return SYSTEM_PROMPT, user_prompt


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
            content = res_data["choices"][0]["message"]["content"]
            
            # Clean potential markdown fences
            cleaned_content = re.sub(r"^```json\s*", "", content.strip(), flags=re.IGNORECASE)
            cleaned_content = re.sub(r"\s*```$", "", cleaned_content.strip())
            
            parsed = json.loads(cleaned_content)
            return {
                "why_it_matters": str(parsed.get("why_it_matters", "")).strip(),
                "confidence": _normalize_confidence(parsed.get("confidence", "Low")),
            }
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"Error calling Groq API ({model}): {e}")
                return {
                    "why_it_matters": f"Analysis failed due to error: {str(e)}",
                    "confidence": "Low",
                }
            time.sleep(1.0)

    return {
        "why_it_matters": "Analysis unavailable due to rate limits.",
        "confidence": "Low",
    }


def run(signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Analyze a list of normalized signals.
    Produces why_it_matters and confidence ('High', 'Medium', 'Low') for each finding.
    """
    findings: List[Dict[str, Any]] = []

    for signal in signals:
        system_prompt, user_prompt = _build_prompts(signal)
        analysis = _call_groq(system_prompt, user_prompt)
        
        confidence = _normalize_confidence(analysis.get("confidence", "Low"))
        why_it_matters = analysis.get("why_it_matters", "").strip()
        if not why_it_matters:
            why_it_matters = f"Activity reported in {signal.get('title', 'source')}."

        finding = dict(signal)
        finding["why_it_matters"] = why_it_matters
        finding["confidence"] = confidence
        findings.append(finding)

    return findings
