import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import funding_classifier


def test_synthetic_true_positive_series_rounds():
    test_cases = [
        (
            "Vercel",
            "Vercel raises $250M Series F at $3.25B valuation led by Accel",
            "Frontend cloud platform Vercel has raised $250 million in Series F funding at a $3.25B valuation.",
            "$250M",
            "Series F",
            "$3.25B",
        ),
        (
            "Netlify",
            "Netlify Secures $105 Million Series D Funding Round",
            "Netlify announced today it has closed $105M in Series D funding led by Bessemer Venture Partners.",
            "$105 Million",
            "Series D",
            None,
        ),
        (
            "Vercel",
            "Vercel Closes $60M Growth Round from Existing Investors",
            "Vercel has completed a $60 million growth round to accelerate its AI tooling infrastructure.",
            "$60M",
            "Growth Round",
            None,
        ),
        (
            "Netlify",
            "Netlify Spins Out New Developer Tool with $4M in Seed Funding",
            "The new open source framework secured a $4M seed round backed by prominent angel investors.",
            "$4M",
            "Seed Funding",
            None,
        ),
    ]

    for company, title, excerpt, exp_amount, exp_round, exp_val in test_cases:
        is_funding, details = funding_classifier.classify_news_text(company, title, excerpt)
        assert is_funding is True, f"Failed to classify true positive: {title}"
        assert details is not None
        if exp_amount:
            assert details["amount"] is not None
            assert exp_amount.lower() in details["amount"].lower()
        if exp_round:
            assert details["round_type"] is not None
            assert exp_round.lower() in details["round_type"].lower()
        if exp_val:
            assert details["valuation"] is not None
            assert exp_val.lower() in details["valuation"].lower()


def test_false_positive_prevention_non_funding_financial_mentions():
    non_funding_cases = [
        (
            "Vercel",
            "Deployment Storage keeps your deployments rollback-ready - Vercel",
            "Deployment Storage is now measured and billed at $0.10 per GB per month for new Pro and Enterprise teams.",
        ),
        (
            "Vercel",
            "Vercel Introduces $20 Per Month Pro Plan with Included Credit",
            "Pro plans now include $20 of credit per month with usage-based billing starting at $0.15 per GB.",
        ),
        (
            "Netlify",
            "Netlify Reaches $100M Annual Recurring Revenue Milestone",
            "Web development platform Netlify announced it crossed $100 million in ARR this quarter.",
        ),
        (
            "Netlify",
            "Netlify Acquires Headless CMS Startup for $35 Million",
            "Netlify announced the acquisition of a content management platform for an estimated $35M.",
        ),
        (
            "Vercel",
            "Tech Firm Faces $15M Penalty in Regulatory Settlement",
            "Regulators imposed a $15 million fine over data privacy compliance issues.",
        ),
        (
            "Vercel",
            "Vercel Awards $100,000 in Bug Bounty Program Rewards",
            "Security researchers earned over $100,000 in bug bounty payouts this year.",
        ),
        (
            "Cloudflare Pages/Workers",
            "Notable ETF Inflow Detected - CIBR, NET, OKTA, ZS",
            "Shares outstanding changed among cybersecurity ETFs with major inflows into NET stock.",
        ),
    ]

    for company, title, excerpt in non_funding_cases:
        is_funding, details = funding_classifier.classify_news_text(company, title, excerpt)
        assert is_funding is False, f"False positive triggered for: '{title}' (details: {details})"


def test_public_company_skip_rule():
    # Cloudflare is publicly traded (NYSE: NET) - classifier must immediately skip
    is_funding, details = funding_classifier.classify_news_text(
        "Cloudflare Pages/Workers",
        "Cloudflare Raises $500M in Senior Notes Offering",
        "Cloudflare announced a private offering of $500 million convertible senior notes.",
    )
    assert is_funding is False
    assert details is None

    is_funding_cf, _ = funding_classifier.classify_news_text(
        "Cloudflare",
        "Cloudflare Secures $100M Venture Investment",
        "Synthetic funding headline.",
    )
    assert is_funding_cf is False


def test_classify_signal_structure():
    raw_news = {
        "source": "news",
        "company": "Vercel",
        "title": "Vercel raises $250M Series F at $3.25B valuation",
        "url": "https://techcrunch.com/vercel-series-f",
        "published_at": "2026-08-20T10:00:00Z",
        "raw_excerpt": "Vercel closes $250 million round led by Accel.",
    }

    classified = funding_classifier.classify_signal(raw_news)
    assert classified["source"] == "news"  # Top-level source unchanged
    assert classified["funding_related"] is True
    assert classified["source_subtype"] == "funding"
    assert classified["funding_details"]["amount"] == "$250M"
    assert classified["funding_details"]["round_type"] == "Series F"

    # Non-funding news
    regular_news = {
        "source": "news",
        "company": "Vercel",
        "title": "Vercel Ships AI SDK 3.0",
        "url": "https://vercel.com/blog/ai-sdk",
        "published_at": "2026-08-21T10:00:00Z",
        "raw_excerpt": "New features for streaming AI agent responses.",
    }
    classified_reg = funding_classifier.classify_signal(regular_news)
    assert classified_reg["funding_related"] is False
    assert classified_reg["source_subtype"] == "general"

    # Non-news sources
    github_signal = {
        "source": "github",
        "company": "Netlify",
        "title": "Release v2.0",
        "url": "https://github.com/netlify/repo",
        "published_at": "2026-08-22T10:00:00Z",
        "raw_excerpt": "Bug fixes.",
    }
    classified_gh = funding_classifier.classify_signal(github_signal)
    assert classified_gh["funding_related"] is False
