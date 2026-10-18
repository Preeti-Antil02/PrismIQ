"""
Unit and property tests for pure core trend logic:
- Canonical entity aliases and quarantined exclusions
- Distinct story deduplication (syndicated news, job role families, github repos)
- Date provenance, midnight precision tagging, and lag eligibility
- Deterministic 3-week momentum rule table (14 required vectors + 729-vector exhaustive property test)
- Empirical evidence gates and audited absence construction
- Cluster lineage matching (assign, merge, split, create)
- Adversarial label and tenant summary validation (zero causation, zero company names in labels, zero cross-tenant leaks)

Execution constraints:
- Pure offline execution (zero network calls, zero database connections)
- Execution time < 5.0 seconds
"""
import itertools
from datetime import datetime, timezone
import pytest

from src.trends.aliases import (
    resolve_canonical_company,
    is_quarantined_entity,
    normalize_entity_name,
    DEFAULT_COMPANY_ALIASES,
    DEFAULT_QUARANTINED_ENTITIES,
)
from src.trends.distinct_story import (
    compute_distinct_story_key,
    classify_job_role_family,
    extract_github_repo,
    normalize_title,
    normalize_story_url,
)
from src.trends.dates import (
    classify_event_date,
    compute_lag_hours,
    get_iso_week,
    parse_iso_datetime,
    is_date_only_midnight,
)
from src.trends.momentum import (
    calculate_momentum,
    ALLOWED_MOMENTUM_LABELS,
)
from src.trends.evidence import (
    validate_trend_evidence,
    build_audited_absences,
)
from src.trends.lineage import (
    match_cluster_identity,
    compute_overlap_ratio,
)
from src.trends.validator import (
    validate_cluster_label,
    validate_tenant_summary,
    BANNED_CAUSATION_TERMS,
    BANNED_FILLER_PHRASES,
)


# -------------------------------------------------------------------------
# 1. Aliases & Quarantined Entity Filtering
# -------------------------------------------------------------------------

def test_quarantined_entities():
    for q in ["Place", "place", "Carousel", "CAROUSEL", "Segment", "Amazon (India)", "Amazon India"]:
        assert is_quarantined_entity(q) is True
        canonical, is_excluded = resolve_canonical_company(q)
        assert is_excluded is True
        assert canonical is None

    # Legitimate entities must not be quarantined
    assert is_quarantined_entity("Google") is False
    assert is_quarantined_entity("Amazon") is False
    assert is_quarantined_entity("Vercel") is False


def test_canonical_casing_resolution():
    cases = [
        ("openai", "OpenAI"),
        ("OpenAI", "OpenAI"),
        ("OPENAI", "OpenAI"),
        ("google", "Google"),
        ("Google Cloud", "Google"),
        ("gcp", "Google"),
        ("microsoft", "Microsoft"),
        ("azure", "Microsoft"),
        ("cloudflare", "Cloudflare"),
        ("cloudflare pages/workers", "Cloudflare"),
        ("vercel", "Vercel"),
        ("nvidia", "NVIDIA"),
        ("flipkart", "Flipkart"),
        ("meesho", "Meesho"),
    ]
    for raw, expected in cases:
        canonical, is_excluded = resolve_canonical_company(raw)
        assert is_excluded is False
        assert canonical == expected


def test_unmapped_clean_company_passthrough():
    canonical, is_excluded = resolve_canonical_company("Acme Corp")
    assert is_excluded is False
    assert canonical == "Acme Corp"


# -------------------------------------------------------------------------
# 2. Distinct Story Deduplication
# -------------------------------------------------------------------------

def test_job_role_family_classification():
    assert classify_job_role_family("Senior Backend Engineer") == "software_engineering"
    assert classify_job_role_family("Staff DevOps Architect") == "software_engineering"
    assert classify_job_role_family("Lead Machine Learning Scientist") == "ai_ml_engineering"
    assert classify_job_role_family("Research Scientist, LLM Post-Training") == "ai_ml_engineering"
    assert classify_job_role_family("Senior Product Manager - Platform") == "product_management"
    assert classify_job_role_family("Enterprise Account Executive") == "sales"
    assert classify_job_role_family("Head of Talent Acquisition") == "talent_people"
    assert classify_job_role_family("Chief Legal Counsel") == "legal_compliance"
    assert classify_job_role_family("Office Receptionist") == "general_operations"


def test_job_post_weekly_collapse():
    # Two engineering jobs posted by OpenAI in the same ISO week must collapse to the same story key
    key1 = compute_distinct_story_key(
        canonical_company="OpenAI",
        signal_type="job",
        title="Senior Backend Engineer, Infrastructure",
        url="https://openai.com/careers/123",
        iso_week="2026-W41"
    )
    key2 = compute_distinct_story_key(
        canonical_company="OpenAI",
        signal_type="job",
        title="Fullstack SDE, Platform",
        url="https://openai.com/careers/456",
        iso_week="2026-W41"
    )
    assert key1 == key2
    assert key1 == "job:openai:software_engineering:2026-W41"

    # Different role family in the same week produces a distinct story key
    key_pm = compute_distinct_story_key(
        canonical_company="OpenAI",
        signal_type="job",
        title="Product Manager, Enterprise API",
        url="https://openai.com/careers/789",
        iso_week="2026-W41"
    )
    assert key_pm != key1
    assert key_pm == "job:openai:product_management:2026-W41"


def test_github_repo_weekly_collapse():
    # Multiple PRs / commits to the same repo in the same week collapse to 1 distinct story key
    key1 = compute_distinct_story_key(
        canonical_company="Vercel",
        signal_type="github",
        title="Release v15.0.0-rc1 in vercel/next.js",
        url="https://github.com/vercel/next.js/pull/12345",
        iso_week="2026-W41"
    )
    key2 = compute_distinct_story_key(
        canonical_company="Vercel",
        signal_type="github",
        title="Fix edge middleware routing in vercel/next.js",
        url="https://github.com/vercel/next.js/commit/abcdef123",
        iso_week="2026-W41"
    )
    assert key1 == key2
    assert key1 == "gh:vercel:vercel/next.js:2026-W41"


def test_news_syndication_and_url_normalization():
    # Syndicated news with identical core titles but different publication suffix
    t1 = "Anthropic announces Claude 3.5 Sonnet with enhanced computer use - TechCrunch"
    t2 = "Anthropic announces Claude 3.5 Sonnet with enhanced computer use | VentureBeat"
    k1 = compute_distinct_story_key("Anthropic", "news", t1, "https://tc.com/story?utm_source=rss", "2026-W41")
    k2 = compute_distinct_story_key("Anthropic", "news", t2, "https://vb.com/story?utm_campaign=feed", "2026-W41")
    assert k1 == k2

    # URL tracking stripping
    norm = normalize_story_url("https://www.reuters.com/technology/article?utm_source=twitter&ref=social#content")
    assert norm == "reuters.com/technology/article"


# -------------------------------------------------------------------------
# 3. Date Provenance & Sequence Eligibility
# -------------------------------------------------------------------------

def test_date_provenance_exact_event_timestamp():
    dt, source, eligible = classify_event_date(
        source_event_ts="2026-10-18T14:32:00Z"
    )
    assert source == "source_event_timestamp"
    assert eligible is True
    assert dt.hour == 14
    assert dt.minute == 32


def test_date_provenance_midnight_date_only_tagged_undated():
    dt, source, eligible = classify_event_date(
        source_event_ts="2026-10-18T00:00:00Z"
    )
    assert source == "undated_order"
    assert eligible is False


def test_date_provenance_fallback_tagged_undated():
    dt, source, eligible = classify_event_date(
        published_at_str="2026-10-18 10:15:00"
    )
    assert source == "undated_order"
    assert eligible is False


def test_lag_computation_strictness():
    dt1 = datetime(2026, 10, 10, 12, 0, tzinfo=timezone.utc)
    dt2 = datetime(2026, 10, 11, 18, 0, tzinfo=timezone.utc)

    # When both are sequence eligible, computes exact lag in hours
    lag = compute_lag_hours(dt1, dt2, is_first_eligible=True, is_follower_eligible=True)
    assert lag == 30.0

    # If either timestamp is undated_order / not eligible, returns None
    assert compute_lag_hours(dt1, dt2, is_first_eligible=False, is_follower_eligible=True) is None
    assert compute_lag_hours(dt1, dt2, is_first_eligible=True, is_follower_eligible=False) is None


# -------------------------------------------------------------------------
# 4. Momentum Evaluation (14 Required Vectors + Exhaustive Property Test)
# -------------------------------------------------------------------------

REQUIRED_MOMENTUM_VECTORS = [
    ([3, 3, 2], "steady"),
    ([0, 0, 4], "too_early_to_call"),
    ([1, 5, 2], "fading"),
    ([0, 0, 1], "too_early_to_call"),
    ([0, 0, 3], "too_early_to_call"),
    ([4, 2, 0], "fading"),
    ([1, 2, 4], "building"),
    ([2, 3, 3], "steady"),
    ([5, 5, 1], "fading"),
    ([4, 4, 1], "fading"),
    ([0, 3, 3], "building"),
    ([0, 2, 2], "building"),
    ([3, 0, 3], "steady"),
    ([0, 0, 0], "too_early_to_call"),
]


@pytest.mark.parametrize("vector,expected", REQUIRED_MOMENTUM_VECTORS)
def test_momentum_required_vectors(vector, expected):
    res = calculate_momentum(vector)
    assert res == expected, f"Vector {vector} evaluated to {res}, expected {expected}"


def test_momentum_low_coverage_flag():
    assert calculate_momentum([1, 2, 4], low_coverage=True) == "low_coverage"
    assert calculate_momentum([5, 5, 1], low_coverage=True) == "low_coverage"


def test_momentum_exhaustive_729_combinations_property_test():
    """
    Exhaustively evaluate all 729 combinations of weekly counts in 0..8 for 3 weeks.
    Guarantees:
    - Never raises
    - Output is strictly member of ALLOWED_MOMENTUM_LABELS
    - Any vector with active_weeks < 2 or total < 3 is strictly too_early_to_call
    - Any active vector with w3 == 0 is strictly fading
    """
    for w1, w2, w3 in itertools.product(range(9), repeat=3):
        res = calculate_momentum([w1, w2, w3])
        assert res in ALLOWED_MOMENTUM_LABELS

        total = w1 + w2 + w3
        active_weeks = sum(1 for x in (w1, w2, w3) if x > 0)

        if total < 3 or active_weeks < 2:
            assert res == "too_early_to_call", f"Expected too_early_to_call for {[w1, w2, w3]}, got {res}"
        elif w3 == 0:
            assert res == "fading", f"Expected fading for {[w1, w2, w3]} with w3=0, got {res}"


# -------------------------------------------------------------------------
# 5. Evidence Thresholds & Audited Absences
# -------------------------------------------------------------------------

def test_evidence_threshold_validation():
    # Valid: 4 stories, 2 weeks, 2 companies
    is_valid, reason = validate_trend_evidence(4, 2, 2, require_cross_competitor=True)
    assert is_valid is True
    assert reason is None

    # Insufficient stories (< 3)
    is_valid, reason = validate_trend_evidence(2, 2, 2)
    assert is_valid is False
    assert reason == "insufficient_stories"

    # Insufficient weeks (< 2)
    is_valid, reason = validate_trend_evidence(5, 1, 2)
    assert is_valid is False
    assert reason == "insufficient_weeks"

    # Single-entity when cross-competitor required (< 2)
    is_valid, reason = validate_trend_evidence(5, 2, 1, require_cross_competitor=True)
    assert is_valid is False
    assert reason == "insufficient_entities"

    # Single-entity allowed if require_cross_competitor=False
    is_valid, reason = validate_trend_evidence(5, 2, 1, require_cross_competitor=False)
    assert is_valid is True


def test_audited_absences_builder():
    tracked = ["Cloudflare", "Fastly", "Vercel", "Netlify"]
    active_in_trend = {"Cloudflare", "Vercel"}

    absences = build_audited_absences(
        tenant_tracked_companies=tracked,
        active_trend_entities=active_in_trend,
        window_start="2026-09-28",
        window_end="2026-10-18"
    )

    absent_names = [a["company_name"] for a in absences]
    assert absent_names == ["Fastly", "Netlify"]  # sorted alphabetically
    for a in absences:
        assert a["status"] == "audited_absence"
        assert a["reason"] == "zero_signals_detected_in_window"
        assert "github" in a["queried_sources"]


# -------------------------------------------------------------------------
# 6. Cluster Lineage & Identity Matching
# -------------------------------------------------------------------------

def test_cluster_lineage_matching():
    c1_id = "c1111111-0000-0000-0000-000000000001"
    c2_id = "c2222222-0000-0000-0000-000000000002"
    prev = {
        c1_id: {"story:a", "story:b", "story:c", "story:d"},  # 4 stories
        c2_id: {"story:x", "story:y", "story:z", "story:w"},  # 4 stories
    }

    # Case 1: Continuation (>= 50% overlap with c1)
    new_set = {"story:a", "story:b", "story:c", "story:e"}  # 3/4 = 75%
    action, cluster_id, parents, overlap = match_cluster_identity(new_set, prev)
    assert action == "assign"
    assert cluster_id == c1_id
    assert parents == [c1_id]
    assert overlap == 0.75

    # Case 2: Merge (>= 50% overlap with BOTH c1 and c2)
    merged_set = {"story:a", "story:b", "story:c", "story:x", "story:y", "story:z"}
    action, cluster_id, parents, overlap = match_cluster_identity(merged_set, prev)
    assert action == "merge"
    assert set(parents) == {c1_id, c2_id}

    # Case 3: Split (25% overlap with c1, 0% with c2)
    split_set = {"story:a", "story:new1", "story:new2", "story:new3"}  # 1/4 = 25%
    action, cluster_id, parents, overlap = match_cluster_identity(split_set, prev)
    assert action == "split"
    assert cluster_id != c1_id
    assert parents == [c1_id]
    assert overlap == 0.25

    # Case 4: Create (< 20% overlap with any)
    brand_new = {"story:100", "story:101", "story:102"}
    action, cluster_id, parents, overlap = match_cluster_identity(brand_new, prev)
    assert action == "create"
    assert len(parents) == 0
    assert overlap == 0.0


# -------------------------------------------------------------------------
# 7. Adversarial Label & Summary Validation
# -------------------------------------------------------------------------

def test_cluster_label_validation():
    all_companies = {"Google", "Cloudflare", "Vercel", "OpenAI"}

    # Valid: 3-6 words, no companies, no causation
    valid, label, reason = validate_cluster_label("Edge Compute Platform Expansion", all_companies)
    assert valid is True
    assert label == "Edge Compute Platform Expansion"
    assert reason is None

    # Too short (< 3 words)
    valid, label, reason = validate_cluster_label("Edge Compute", all_companies)
    assert valid is False
    assert label == "unlabelled"
    assert "too_short" in reason

    # Too long (> 6 words)
    valid, label, reason = validate_cluster_label("Rapid Expansion of Global Distributed Edge Compute Networks", all_companies)
    assert valid is False
    assert label == "unlabelled"
    assert "too_long" in reason

    # Contains company name in global label -> strictly rejected
    valid, label, reason = validate_cluster_label("Cloudflare Workers Serverless Migration", all_companies)
    assert valid is False
    assert label == "unlabelled"
    assert "company_name_in_global_label" in reason

    # Contains causation word -> strictly rejected
    valid, label, reason = validate_cluster_label("Serverless Expansion Due To Demand", all_companies)
    assert valid is False
    assert label == "unlabelled"
    assert "causation_word_detected" in reason

    # Contains generic filler -> strictly rejected
    valid, label, reason = validate_cluster_label("Active Commercial Positioning Trends", all_companies)
    assert valid is False
    assert label == "unlabelled"
    assert "filler_phrase_detected" in reason


def test_tenant_summary_cross_tenant_leak_prevention():
    all_companies = {"Cloudflare", "Vercel", "Fastly", "Netlify"}
    tenant_visible = {"Cloudflare", "Vercel"}  # Fastly and Netlify are un-tracked by this tenant

    # Clean summary mentioning only visible companies
    clean_summary = "Cloudflare expanded edge database capabilities. Vercel launched accelerated edge middleware."
    valid, summary, reason = validate_tenant_summary(clean_summary, tenant_visible, all_companies)
    assert valid is True
    assert summary == clean_summary
    assert reason is None

    # Leaking un-tracked competitor Fastly -> MUST FAIL CLOSED
    leaky_summary = "Cloudflare added D1 features while Fastly cut compute pricing."
    valid, summary, reason = validate_tenant_summary(leaky_summary, tenant_visible, all_companies)
    assert valid is False
    assert summary == ""
    assert "cross_tenant_leak_forbidden_company" in reason

    # Causation assertion in summary -> MUST FAIL CLOSED
    causation_summary = "Vercel released edge routing because Cloudflare announced D1 scaling."
    valid, summary, reason = validate_tenant_summary(causation_summary, tenant_visible, all_companies)
    assert valid is False
    assert summary == ""
    assert "causation_word_detected" in reason

    # More than 2 sentences -> MUST FAIL CLOSED
    verbose_summary = "Sentence one. Sentence two. Sentence three."
    valid, summary, reason = validate_tenant_summary(verbose_summary, tenant_visible, all_companies)
    assert valid is False
    assert "too_many_sentences" in reason
