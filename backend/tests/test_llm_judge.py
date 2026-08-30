import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import llm_judge


def test_build_judge_prompt_discovery():
    item = {
        "target_company": "Vercel",
        "candidate_name": "Netlify",
        "rationale": "Direct competitor in Jamstack hosting.",
    }
    sys_p, user_p = llm_judge._build_judge_prompt(llm_judge.TASK_DISCOVERY, item)
    assert "Target Company: Vercel" in user_p
    assert "Candidate Competitor: Netlify" in user_p
    assert "Allowed grades: [Correct, Plausible, Wrong]" in user_p


def test_normalize_grade_across_tasks():
    # Discovery
    assert llm_judge._normalize_grade(llm_judge.TASK_DISCOVERY, "correct") == "Correct"
    assert llm_judge._normalize_grade(llm_judge.TASK_DISCOVERY, "plausible competitor") == "Plausible"
    assert llm_judge._normalize_grade(llm_judge.TASK_DISCOVERY, "wrong") == "Wrong"

    # Consolidation
    assert llm_judge._normalize_grade(llm_judge.TASK_CONSOLIDATION, "Correct merge") == "Correct merge"
    assert llm_judge._normalize_grade(llm_judge.TASK_CONSOLIDATION, "false_merge") == "False merge"

    # Analysis
    assert llm_judge._normalize_grade(llm_judge.TASK_ANALYSIS, "grounded") == "Grounded"
    assert llm_judge._normalize_grade(llm_judge.TASK_ANALYSIS, "hallucinated") == "Hallucinated"

    # Synthesis
    assert llm_judge._normalize_grade(llm_judge.TASK_SYNTHESIS, "Correct — pattern found") == "Correct — pattern found"
    assert llm_judge._normalize_grade(llm_judge.TASK_SYNTHESIS, "overstated") == "Overstated"

    # Noise
    assert llm_judge._normalize_grade(llm_judge.TASK_NOISE, "correctly suppressed") == "Correctly suppressed"
    assert llm_judge._normalize_grade(llm_judge.TASK_NOISE, "wrongly suppressed") == "Wrongly suppressed"


def test_split_dataset_deterministic():
    items = [{"id": i} for i in range(100)]
    calib_1, holdout_1 = llm_judge.split_dataset(items, train_ratio=0.7, seed=42)
    calib_2, holdout_2 = llm_judge.split_dataset(items, train_ratio=0.7, seed=42)

    assert len(calib_1) == 70
    assert len(holdout_1) == 30
    assert calib_1 == calib_2
    assert holdout_1 == holdout_2


def test_compute_eval_metrics():
    graded_pairs = [
        {"human_grade": "Correct", "judge_grade": "Correct"},
        {"human_grade": "Correct", "judge_grade": "Correct"},
        {"human_grade": "Plausible", "judge_grade": "Plausible"},
        {"human_grade": "Wrong", "judge_grade": "Plausible", "human_rationale": "Non-competitor", "judge_reasoning": "Adjacent market"},
    ]

    metrics = llm_judge.compute_eval_metrics(llm_judge.TASK_DISCOVERY, graded_pairs)
    assert metrics["total_evaluated"] == 4
    assert metrics["agreed_count"] == 3
    assert metrics["disagreed_count"] == 1
    assert metrics["agreement_rate_pct"] == 75.0
    assert len(metrics["disagreements"]) == 1
    assert metrics["per_category_metrics"]["Correct"]["precision_pct"] == 100.0


def test_mocked_llm_judge_evaluate():
    fake_groq_resp = {
        "grade": "Correct",
        "reasoning": "Netlify provides direct edge frontend hosting and Jamstack serverless runtimes competing head-to-head with Vercel.",
        "confidence": "High"
    }

    with patch("src.llm_judge._call_groq_judge", return_value=fake_groq_resp):
        item = {
            "target_company": "Vercel",
            "candidate_name": "Netlify",
            "rationale": "Jamstack hosting.",
        }
        res = llm_judge.evaluate_item(llm_judge.TASK_DISCOVERY, item)
        assert res["judge_grade"] == "Correct"
        assert "Jamstack" in res["judge_reasoning"]
        assert res["judge_confidence"] == "High"
