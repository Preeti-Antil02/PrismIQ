"""
Phase F0 Unit Tests: Trend Momentum Evaluator & Distinct-Story Counting.
Validates pure functions without database or network dependencies.
"""
import pytest
from src.trend_momentum import (
    calculate_trend_momentum,
    count_distinct_stories,
    _extract_job_role_family,
    _extract_github_repo,
)


# Table of 27 synthetic test vectors testing required edge cases and transitions
SYNTHETIC_MOMENTUM_VECTORS = [
    ([0, 0, 1], "too_early_to_call", "Total < 3 stories across window"),
    ([0, 1, 1], "too_early_to_call", "Total < 3 stories across window"),
    ([0, 0, 3], "building", "Recent burst >= 3 in W-1"),
    ([0, 0, 4], "building", "Recent burst: erupting trend with 4 stories"),
    ([1, 2, 4], "building", "Monotonic acceleration [1 -> 2 -> 4]"),
    ([0, 1, 3], "building", "Accelerating trend from zero baseline"),
    ([2, 3, 5], "building", "Strong accelerating momentum"),
    ([4, 2, 0], "fading", "Monotonic decline dropping to zero in W-1"),
    ([5, 3, 0], "fading", "Drop to 0 in W-1"),
    ([1, 5, 2], "fading", "Spike in W-2 followed by sharp drop in W-1"),
    ([2, 6, 1], "fading", "Sharp spike-then-drop"),
    ([0, 4, 1], "fading", "Spike in W-2 followed by drop in W-1"),
    ([3, 3, 2], "steady", "High-volume plateau [3, 3, 2]"),
    ([2, 3, 3], "steady", "Sustained plateau [2, 3, 3]"),
    ([4, 4, 4], "steady", "Constant high volume [4, 4, 4]"),
    ([1, 2, 2], "steady", "Sustained moderate cadence [1, 2, 2]"),
    ([2, 2, 2], "steady", "Constant moderate volume [2, 2, 2]"),
    ([1, 1, 1], "steady", "Consistent 1/week cadence"),
    ([0, 0, 0], "fading", "Extinction with history >= 3"),
    ([0, 0, 0], "too_early_to_call", "Extinction with history < 3"),
    ([1, 4, 3], "fading", "Peaked in W-2 (4) and declining in W-1 (3)"),
    ([2, 1, 3], "building", "Recovery in W-1 (3 > 1)"),
    # Newly specified counterexample vectors:
    ([5, 5, 1], "fading", "Plateau at 5 then sharp decline to 1"),
    ([4, 4, 1], "fading", "Plateau at 4 then sharp decline to 1"),
    ([0, 3, 3], "building", "Emergence from zero baseline with sustained 3"),
    ([0, 2, 2], "building", "Emergence from zero baseline with sustained 2"),
    ([3, 0, 3], "irregular", "Discontinuous activity dipping to zero in W-2"),
]


def test_synthetic_momentum_vectors_table(capsys):
    """
    Test suite of 27 synthetic vectors labeled SYNTHETIC,
    printing expected vs actual for comprehensive audit evidence.
    """
    print("\n" + "=" * 95)
    print(f"{'Vector':<12} | {'Expected':<18} | {'Actual':<18} | {'Status':<8} | {'Note':<35}")
    print("-" * 95)

    for vec, expected, note in SYNTHETIC_MOMENTUM_VECTORS:
        hist = 5 if vec == [0, 0, 0] and expected == "fading" else (1 if vec == [0, 0, 0] else sum(vec))
        actual = calculate_trend_momentum(vec, total_historical_stories=hist)
        status = "PASS" if actual == expected else "FAIL"
        print(f"{str(vec):<12} | {expected:<18} | {actual:<18} | {status:<8} | {note:<35}")
        assert actual == expected, f"Vector {vec} failed: expected '{expected}', got '{actual}'"

    print("=" * 95)


def test_exhaustive_property_over_vectors():
    """
    Exhaustive property test over all 729 vectors in range(0..8)^3:
    1. Never raises an uncaught exception.
    2. Always returns one of the 6 allowed labels.
    3. Any vector with total >= 3 stories in >= 2 active weeks NEVER returns too_early_to_call.
    """
    allowed_labels = {"low_coverage", "building", "steady", "fading", "irregular", "too_early_to_call"}
    failures = []

    for c1 in range(9):
        for c2 in range(9):
            for c3 in range(9):
                vec = [c1, c2, c3]
                label = calculate_trend_momentum(vec)
                assert label in allowed_labels, f"Invalid label '{label}' for vector {vec}"

                # Property: Multi-week trends with sufficient evidence cannot be 'too_early_to_call'
                active_weeks = sum(1 for c in vec if c > 0)
                if sum(vec) >= 3 and active_weeks >= 2:
                    if label == "too_early_to_call":
                        failures.append(vec)

    assert len(failures) == 0, f"Property violated for vectors: {failures}"


def test_word_boundary_job_role_family_matching():
    """Verify word-boundary tokens prevent false substring collisions."""
    # Negative substring collision checks:
    assert _extract_job_role_family("Software Maintainer") == "general"  # 'ai' in maintain
    assert _extract_job_role_family("Senior Builder") == "general"       # 'ui' in build
    assert _extract_job_role_family("Software Development Lead") == "general"  # 'pm' in development

    # Positive exact role family checks:
    assert _extract_job_role_family("Staff AI Researcher") == "ai_ml"
    assert _extract_job_role_family("Senior Machine Learning Engineer") == "ai_ml"
    assert _extract_job_role_family("Lead UI Developer") == "frontend"
    assert _extract_job_role_family("Principal Frontend Engineer") == "frontend"
    assert _extract_job_role_family("Senior Product Manager") == "product"
    assert _extract_job_role_family("Staff PM (Infrastructure)") == "product"
    assert _extract_job_role_family("Senior Security Engineer") == "security"
    assert _extract_job_role_family("DevOps Architect") == "devops_sre"


def test_github_repo_suffix_stripping():
    """Verify exact .removesuffix('.git') does not strip individual characters from repo names."""
    # Suffix .git should be removed:
    repo1 = _extract_github_repo("https://github.com/cloudflare/workers-sdk.git", "")
    assert repo1 == "cloudflare/workers-sdk"

    # Repo names ending in 't', 'i', or 'g' must NOT have trailing letters stripped:
    repo2 = _extract_github_repo("https://github.com/my-org/api-client-git", "")
    assert repo2 == "my-org/api-client-git"

    repo3 = _extract_github_repo("https://github.com/my-org/test-tag", "")
    assert repo3 == "my-org/test-tag"


def test_provisional_6word_title_heuristic():
    """
    Test and document behaviour of the provisional 6-word title prefix heuristic:
    1. Collapses syndicated rewrites sharing identical 6-word prefixes.
    2. Identifies limitation: Collapses two genuinely distinct stories that happen to share a 6-word prefix.
    """
    # Syndicated wire stories with matching 6 words:
    signals_syndicated = [
        {"company": "Vercel", "source": "news", "title": "Vercel Announces Launch Of Modern AI Platform Today", "url": "http://a.com/1"},
        {"company": "Vercel", "source": "news", "title": "Vercel Announces Launch Of Modern AI Platform With New Benchmarks", "url": "http://b.com/2"},
    ]
    # They share: "vercel announces launch of modern ai"
    count = count_distinct_stories(signals_syndicated)
    assert count == 1, "Expected syndicated stories with matching 6-word prefix to collapse to 1"

    # Distinct stories that happen to share the same initial boilerplate words:
    signals_sharing_prefix = [
        {"company": "Stripe", "source": "news", "title": "Stripe Expands Global Operations In European Markets With New Banking License", "url": "http://a.com/3"},
        {"company": "Stripe", "source": "news", "title": "Stripe Expands Global Operations In European Markets By Acquiring Tax Startup", "url": "http://b.com/4"},
    ]
    # Under provisional 6-word prefix ("stripe expands global operations in european"), they collapse to 1
    count_shared = count_distinct_stories(signals_sharing_prefix)
    assert count_shared == 1, "Documents known limitation: 6-word prefix collapses stories sharing identical boilerplate"


def test_low_coverage_guard():
    """Verify low_coverage flag overrides momentum calculation."""
    assert calculate_trend_momentum([1, 2, 4], is_low_coverage=True) == "low_coverage"
    assert calculate_trend_momentum([3, 3, 2], is_low_coverage=True) == "low_coverage"
    assert calculate_trend_momentum([5, 5, 1], is_low_coverage=True) == "low_coverage"
