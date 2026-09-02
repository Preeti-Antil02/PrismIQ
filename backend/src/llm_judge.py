"""
LLM-as-Judge Semi-Automated Evaluation System for PrismIQ.

Provides structured second-pass evaluation across 5 intelligence tasks:
1. Discovery Competitor Candidate Relevance (Correct, Plausible, Wrong)
2. Event Consolidation Merge Correctness (Correct merge, False merge, Missed merge)
3. Analysis Groundedness / Factual Support (Grounded, Plausible, Hallucinated)
4. Synthesis Pattern Detection (Correct — pattern found, Correct — no pattern, Overstated, False pattern)
5. Noise Suppression Correctness (Correctly suppressed, Wrongly suppressed)

Governing Principle:
Serves as a second-pass triage check to flag likely misgrades for human review.
"""

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple
import requests

try:
    from langsmith import traceable
except ImportError:
    def traceable(*args, **kwargs):
        def decorator(f):
            return f
        return decorator

logger = logging.getLogger(__name__)

# Task Identifiers
TASK_DISCOVERY = "discovery_candidate"
TASK_CONSOLIDATION = "event_consolidation"
TASK_ANALYSIS = "analysis_groundedness"
TASK_SYNTHESIS = "synthesis_pattern"
TASK_NOISE = "noise_suppression"

# Valid Grades per Task
TASK_RUBRICS: Dict[str, List[str]] = {
    TASK_DISCOVERY: ["Correct", "Plausible", "Wrong"],
    TASK_CONSOLIDATION: ["Correct merge", "False merge", "Missed merge"],
    TASK_ANALYSIS: ["Grounded", "Plausible", "Hallucinated"],
    TASK_SYNTHESIS: ["Correct — pattern found", "Correct — no pattern", "Overstated", "False pattern"],
    TASK_NOISE: ["Correctly suppressed", "Wrongly suppressed"],
}


def _build_judge_prompt(task: str, item: Dict[str, Any]) -> Tuple[str, str]:
    """Build task-specific system and user prompts for the LLM judge."""
    system_prompt = (
        "You are an expert, impartial evaluator and competitive intelligence auditor. "
        "Your task is to critically evaluate competitive intelligence outputs against a strict, "
        "objective grading rubric. "
        "CRITICAL RULE: PRIORITIZE PROVIDED EVIDENCE OVER INTERNAL MEMORY. You must evaluate claims "
        "based strictly on the provided text, excerpts, and stated context. Do not override provided "
        "evidence with your own prior parametric beliefs, and do not assume unfamiliar startups or products "
        "are fabricated if the provided source context documents them. "
        "Output your evaluation strictly as a valid JSON object with keys: "
        "'grade', 'reasoning', and 'confidence' ('High', 'Medium', 'Low'). "
        "Do not include any conversational filler or markdown code blocks outside JSON."
    )

    if task == TASK_DISCOVERY:
        target = item.get("target_company", "Vercel")
        candidate = item.get("candidate_name") or item.get("candidate", "Unknown")
        rationale = item.get("rationale", "")
        allowed = ", ".join(TASK_RUBRICS[TASK_DISCOVERY])
        user_prompt = f"""
Evaluate whether the following candidate company is a valid competitor to the target company based on the provided rationale.

Target Company: {target}
Candidate Competitor: {candidate}
Stated Rationale: {rationale}

Rubric:
- 'Correct': Direct head-to-head competitor offering comparable core products/services with an accurate rationale.
- 'Plausible': Indirect competitor, adjacent category, or partial niche overlap where the rationale is plausible.
- 'Wrong': Unrelated company, non-competitor, customer/vendor misclassified as a rival, or completely fabricated rationale.

Allowed grades: [{allowed}]

Output format:
{{"grade": "<grade>", "reasoning": "<factual explanation>", "confidence": "High" | "Medium" | "Low"}}
"""

    elif task == TASK_CONSOLIDATION:
        title = item.get("event_title") or item.get("title", "")
        signals = item.get("contributing_signals") or item.get("signals", [])
        signals_text = json.dumps(signals, indent=2)
        allowed = ", ".join(TASK_RUBRICS[TASK_CONSOLIDATION])
        user_prompt = f"""
Evaluate whether the following merged event correctly clusters multi-source signals.

Merged Event Title: {title}
Contributing Raw Signals:
{signals_text}

Rubric:
- 'Correct merge': All contributing signals describe the exact same real-world event, product release, commit, incident, OR represent intentional same-repository activity aggregation (e.g. multiple WatchEvents/stars on the same repo in one window).
- 'False merge': Signals describing genuinely distinct corporate initiatives, separate products, or disparate unrelated events were incorrectly merged together.
- 'Missed merge': Signals that should have merged were kept separate.

Allowed grades: [{allowed}]

Output format:
{{"grade": "<grade>", "reasoning": "<factual explanation>", "confidence": "High" | "Medium" | "Low"}}
"""

    elif task == TASK_ANALYSIS:
        title = item.get("title", "")
        excerpt = item.get("raw_excerpt", "")
        why_it_matters = item.get("why_it_matters", "")
        allowed = ", ".join(TASK_RUBRICS[TASK_ANALYSIS])
        user_prompt = f"""
Evaluate whether the 'why it matters' analysis is factually grounded in the source signal excerpt.

Signal Title: {title}
Raw Source Excerpt: {excerpt}
Why It Matters Analysis: {why_it_matters}

Rubric:
- 'Grounded': The analysis is supported by facts in the excerpt, including standard, low-risk domain summaries (e.g. characterizing standard non-executive job titles as routine operational hiring).
- 'Plausible': The analysis contains speculative inferences that are directionally plausible for the domain but unverified.
- 'Hallucinated': The analysis claims specific facts, products, metrics, or moves that directly contradict or have zero factual basis in the excerpt (e.g. fabricating a product focus not in the text).

Allowed grades: [{allowed}]

Output format:
{{"grade": "<grade>", "reasoning": "<factual explanation>", "confidence": "High" | "Medium" | "Low"}}
"""

    elif task == TASK_SYNTHESIS:
        theme = item.get("theme", "")
        claim = item.get("claim", "")
        evidence = json.dumps(item.get("evidence", {}), indent=2)
        call_type = item.get("call_type", "")
        allowed = ", ".join(TASK_RUBRICS[TASK_SYNTHESIS])
        user_prompt = f"""
Evaluate whether the cross-competitor synthesis claim/call for this theme is supported by the evidence.

Strategic Theme: {theme}
Call Type: {call_type}
Synthesis Claim / Output: {claim}
Competitor Evidence:
{evidence}

Rubric:
- 'Correct — pattern found': Specific, comparable, verifiable evidence from at least 2 distinct competitors supports a genuine cross-competitor trend.
- 'Correct — no pattern': Correctly identified that activity is isolated to 0-1 competitors or represents disparate, non-overlapping initiatives.
- 'Overstated': Superficial or loosely-grouped items claiming a pattern where the evidence does not show a genuine shared strategic move.
- 'False pattern': Fabricated, unsupported, or contradictory pattern claim.

Allowed grades: [{allowed}]

Output format:
{{"grade": "<grade>", "reasoning": "<factual explanation>", "confidence": "High" | "Medium" | "Low"}}
"""

    elif task == TASK_NOISE:
        title = item.get("title", "")
        excerpt = item.get("raw_excerpt", "")
        category = item.get("noise_category", "")
        pr_analysis = item.get("underlying_pr_analysis", "")
        allowed = ", ".join(TASK_RUBRICS[TASK_NOISE])
        user_prompt = f"""
Evaluate whether this raw signal was correctly classified as noise to be suppressed upstream.

Signal Title: {title}
Raw Source Excerpt: {excerpt}
Noise Category: {category}
Underlying Context / PR Details: {pr_analysis}

Rubric:
- 'Correctly suppressed': The signal carries zero competitive intelligence value (automated bot review, lockfile update, single-star notification, test ATS artifact).
- 'Wrongly suppressed': The signal carries genuine competitive, security, product feature, or strategic intelligence value that should not have been filtered.

Allowed grades: [{allowed}]

Output format:
{{"grade": "<grade>", "reasoning": "<factual explanation>", "confidence": "High" | "Medium" | "Low"}}
"""

    else:
        user_prompt = f"Evaluate item: {json.dumps(item)}"

    return system_prompt, user_prompt


@traceable(run_type="llm", name="llm_judge_call")
def _call_groq_judge(system_prompt: str, user_prompt: str, model: str = "openai/gpt-oss-120b") -> Dict[str, Any]:
    """Call Groq LLM API with deterministic temperature for evaluation."""
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return {
            "grade": "Error",
            "reasoning": "GROQ_API_KEY not configured.",
            "confidence": "Low",
        }

    url = "https://api.groq.com/openai/v1/chat/completions"
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
        "temperature": 0.0,
        "response_format": {"type": "json_object"},
    }

    try:
        resp = requests.post(url, headers=headers, json=payload, timeout=25)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"]
        
        # Clean potential markdown fences
        cleaned_content = re.sub(r"^```json\s*", "", content.strip(), flags=re.IGNORECASE)
        cleaned_content = re.sub(r"\s*```$", "", cleaned_content.strip())
        
        data = json.loads(cleaned_content)
        return data
    except Exception as e:
        logger.warning(f"Groq judge call failed: {e}")
        return {
            "grade": "Error",
            "reasoning": f"LLM judge invocation failed: {e}",
            "confidence": "Low",
        }


def _normalize_grade(task: str, raw_grade: str) -> str:
    """Normalize grade string to match exact rubric choices."""
    valid_rubrics = TASK_RUBRICS.get(task, [])
    cleaned = raw_grade.strip().lower()

    for rubric in valid_rubrics:
        if cleaned == rubric.lower():
            return rubric

    # Substring / alias mappings
    if task == TASK_DISCOVERY:
        if "correct" in cleaned or "direct" in cleaned:
            return "Correct"
        if "plausible" in cleaned or "indirect" in cleaned:
            return "Plausible"
        if "wrong" in cleaned or "incorrect" in cleaned:
            return "Wrong"

    elif task == TASK_CONSOLIDATION:
        if "correct" in cleaned:
            return "Correct merge"
        if "false" in cleaned:
            return "False merge"
        if "miss" in cleaned:
            return "Missed merge"

    elif task == TASK_ANALYSIS:
        if "grounded" in cleaned:
            return "Grounded"
        if "plausible" in cleaned:
            return "Plausible"
        if "hallucinat" in cleaned:
            return "Hallucinated"

    elif task == TASK_SYNTHESIS:
        if "pattern found" in cleaned or "correct - pattern" in cleaned:
            return "Correct — pattern found"
        if "no pattern" in cleaned or "correct - no" in cleaned:
            return "Correct — no pattern"
        if "overstate" in cleaned:
            return "Overstated"
        if "false" in cleaned:
            return "False pattern"

    elif task == TASK_NOISE:
        if "correct" in cleaned:
            return "Correctly suppressed"
        if "wrong" in cleaned:
            return "Wrongly suppressed"

    return valid_rubrics[0] if valid_rubrics else "Unknown"


def evaluate_item(task: str, item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluate a single item under the specified task rubric.
    
    Returns:
        {
            "judge_grade": str,
            "judge_reasoning": str,
            "judge_confidence": str,
            "task": str
        }
    """
    system_prompt, user_prompt = _build_judge_prompt(task, item)
    llm_resp = _call_groq_judge(system_prompt, user_prompt)

    raw_grade = llm_resp.get("grade", "Unknown")
    grade = _normalize_grade(task, raw_grade)
    reasoning = llm_resp.get("reasoning", "No explanation provided.").strip()
    confidence = llm_resp.get("confidence", "Medium")

    return {
        "judge_grade": grade,
        "judge_reasoning": reasoning,
        "judge_confidence": confidence,
        "task": task,
    }


def split_dataset(items: List[Dict[str, Any]], train_ratio: float = 0.7, seed: int = 42) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Deterministically split a list of graded items into Calibration (70%) and Holdout (30%) sets.
    """
    import random
    rng = random.Random(seed)
    shuffled = list(items)
    rng.shuffle(shuffled)

    split_idx = int(len(shuffled) * train_ratio)
    calibration = shuffled[:split_idx]
    holdout = shuffled[split_idx:]
    return calibration, holdout


def compute_eval_metrics(task: str, graded_pairs: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute overall agreement rate, category precision/recall/F1, and confusion matrix.
    
    graded_pairs: list of dicts with 'human_grade', 'judge_grade', and item details.
    """
    valid_rubrics = TASK_RUBRICS.get(task, [])
    total = len(graded_pairs)
    if total == 0:
        return {"total": 0, "agreement_rate": 0.0}

    matches = sum(1 for p in graded_pairs if p.get("human_grade") == p.get("judge_grade"))
    agreement_rate = round(matches / total * 100, 2)

    # Confusion matrix and per-category stats
    category_stats: Dict[str, Dict[str, Any]] = {}
    for cat in valid_rubrics:
        tp = sum(1 for p in graded_pairs if p.get("human_grade") == cat and p.get("judge_grade") == cat)
        fp = sum(1 for p in graded_pairs if p.get("human_grade") != cat and p.get("judge_grade") == cat)
        fn = sum(1 for p in graded_pairs if p.get("human_grade") == cat and p.get("judge_grade") != cat)

        precision = round(tp / (tp + fp) * 100, 2) if (tp + fp) > 0 else 0.0
        recall = round(tp / (tp + fn) * 100, 2) if (tp + fn) > 0 else 0.0
        f1 = round(2 * precision * recall / (precision + recall), 2) if (precision + recall) > 0 else 0.0

        category_stats[cat] = {
            "true_positive": tp,
            "false_positive": fp,
            "false_negative": fn,
            "support": sum(1 for p in graded_pairs if p.get("human_grade") == cat),
            "precision_pct": precision,
            "recall_pct": recall,
            "f1_score": f1,
        }

    # Extract disagreements
    disagreements = [
        {
            "sample_id": p.get("sample_id") or p.get("candidate_name") or p.get("title") or "item",
            "human_grade": p.get("human_grade"),
            "judge_grade": p.get("judge_grade"),
            "human_rationale": p.get("human_rationale") or p.get("grade_rationale") or p.get("review_rationale") or "",
            "judge_reasoning": p.get("judge_reasoning", ""),
            "item_snippet": str(p.get("item", {}))[:200],
        }
        for p in graded_pairs
        if p.get("human_grade") != p.get("judge_grade")
    ]

    return {
        "task": task,
        "total_evaluated": total,
        "agreed_count": matches,
        "disagreed_count": total - matches,
        "agreement_rate_pct": agreement_rate,
        "per_category_metrics": category_stats,
        "disagreements": disagreements,
    }
