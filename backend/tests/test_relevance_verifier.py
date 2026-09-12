"""
Unit tests for General Relevance Verifier & Entity Disambiguation.
"""

import pytest
from src.relevance_verifier import verify_news_relevance, COMPANY_REGISTRY


def test_stripe_cat_in_the_hat_false_positive():
    """Verify that the Cat in the Hat article is suppressed."""
    signal = {
        "company": "Stripe",
        "title": "Cat in the Hat suspect who chased a teen girl in B.C. appears to be a trend copycat",
        "url": "https://www.cbc.ca/news/canada/british-columbia/cat-in-the-hat-trend-9.7339610",
        "raw_excerpt": (
            "A disturbing incident in which someone dressed in a Cat in the Hat costume "
            "chased a teenager in West Kelowna, B.C., occurred amid an online trend that twists "
            "the popular children's character into something sinister."
        ),
    }
    is_rel, reason = verify_news_relevance(signal)
    assert not is_rel
    assert "Negative idiom" in reason or "Common-noun" in reason


def test_stripe_stars_and_stripes_false_positive():
    """Verify that Stars and Stripes military articles are suppressed."""
    signal = {
        "company": "Stripe",
        "title": "Judge hands Pentagon a win over ousted Stars and Stripes journalists",
        "url": "https://example.com/military-news",
        "raw_excerpt": "A federal judge on Tuesday dismissed a lawsuit against the Pentagon brought by Stars and Stripes staff.",
    }
    is_rel, reason = verify_news_relevance(signal)
    assert not is_rel
    assert "Negative idiom" in reason or "Common-noun" in reason


def test_stripe_fashion_vacation_false_positive():
    """Verify that fashion/clothing articles about stripes are suppressed."""
    signal = {
        "company": "Stripe",
        "title": "31 Things You Can Wear Multiple Ways On Vacation If You’re Tight On Suitcase Space",
        "url": "https://example.com/vacation-style",
        "raw_excerpt": "A lovely dress featuring bold vertical stripes to lengthen your silhouette.",
    }
    is_rel, reason = verify_news_relevance(signal)
    assert not is_rel


def test_stripe_legitimate_business_news_passes():
    """Verify that real Stripe fintech news passes."""
    signal = {
        "company": "Stripe",
        "title": "Stripe expands pay-by-bank checkout across Europe",
        "url": "https://fintechtimes.com/stripe-pay-by-bank/",
        "raw_excerpt": "Fintech infrastructure giant Stripe announced an expansion of its open banking payments capability for merchants.",
    }
    is_rel, reason = verify_news_relevance(signal)
    assert is_rel
    assert "Verified" in reason


def test_stripe_domain_match_passes():
    """Verify that an article linking directly to stripe.com passes."""
    signal = {
        "company": "Stripe",
        "title": "Developer tooling updates for modern SaaS",
        "url": "https://stripe.com/blog/saas-tooling-2026",
        "raw_excerpt": "New developer SDK features announced today.",
    }
    is_rel, reason = verify_news_relevance(signal)
    assert is_rel
    assert "Direct domain match" in reason


def test_stripe_branded_term_collison():
    """Verify that mentioning Patrick Collison passes."""
    signal = {
        "company": "Stripe",
        "title": "Tech CEO interview on global commerce trends",
        "url": "https://bloomberg.com/interview",
        "raw_excerpt": "Patrick Collison shared thoughts on macroeconomic stability and software growth.",
    }
    is_rel, reason = verify_news_relevance(signal)
    assert is_rel
    assert "Product/brand pattern match" in reason


def test_gobble_meal_kit_vs_idiom():
    """Verify Gobble meal kit passes but 'gobble up' fails."""
    # Real meal kit news
    good_signal = {
        "company": "Gobble",
        "title": "Gobble launches 15-minute dinner kits for busy families",
        "url": "https://foodnews.com/gobble-expansion",
        "raw_excerpt": "Meal kit delivery company Gobble adds new chef-designed recipes.",
    }
    is_rel, _ = verify_news_relevance(good_signal)
    assert is_rel

    # Idiom "gobble up"
    bad_signal = {
        "company": "Gobble",
        "title": "Tech giants continue to gobble up smaller AI startups in European market",
        "url": "https://techcrunch.com/mergers",
        "raw_excerpt": "Acquisition fever grips Europe as tech incumbents gobble up local talent.",
    }
    is_rel, reason = verify_news_relevance(bad_signal)
    assert not is_rel
    assert "Negative idiom" in reason or "Common-noun" in reason


def test_coined_company_names():
    """Verify distinctive coined names like Vercel and Netlify pass."""
    vercel_signal = {
        "company": "Vercel",
        "title": "Frontend ecosystem update September 2026",
        "url": "https://example.com/frontend",
        "raw_excerpt": "Vercel announces Next.js performance improvements at global summit.",
    }
    is_rel, _ = verify_news_relevance(vercel_signal)
    assert is_rel
