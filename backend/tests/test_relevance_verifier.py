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


def test_qualified_company_names_amazon_india():
    """Verify qualified company names like 'Amazon (India)' match both qualified and base entity mentions."""
    # Qualified match with region
    signal_regional = {
        "company": "Amazon (India)",
        "title": "Amazon launches Alexa+ in India with Hindi support | TechCrunch",
        "url": "https://techcrunch.com/2026/09/amazon-india-alexa",
        "raw_excerpt": "Amazon introduced its new conversational AI assistant Alexa+ in India today.",
    }
    is_rel, reason = verify_news_relevance(signal_regional)
    assert is_rel
    assert "Qualified entity match" in reason or "Verified" in reason

    # Base entity match
    signal_base = {
        "company": "Amazon (India)",
        "title": "Amazon Now reaches $1b annualized sales in India",
        "url": "https://example.com/amazon-sales",
        "raw_excerpt": "Quick commerce arm reaches new milestone across urban hubs.",
    }
    is_rel, _ = verify_news_relevance(signal_base)
    assert is_rel

    # Completely unrelated article should still be suppressed
    signal_unrelated = {
        "company": "Amazon (India)",
        "title": "Local high school football scores and highlights",
        "url": "https://sportsweekly.com/high-school-scores",
        "raw_excerpt": "The Tigers defeated the Eagles 24-14 in Friday night action.",
    }
    is_rel, reason = verify_news_relevance(signal_unrelated)
    assert not is_rel
    assert "Suppressed" in reason


def test_amazon_india_geographical_homonym_suppressed():
    """Verify El Niño / Amazon rainforest homonym articles with separate India mentions are suppressed."""
    signal = {
        "company": "Amazon (India)",
        "title": "El Niño arrived early. Why its impact was felt from India to the Panama Canal",
        "url": "https://economictimes.indiatimes.com/news/environment/global-warming/el-nio-arrived-early",
        "raw_excerpt": (
            "El Niño's early onset has triggered a cascade of atypical weather events worldwide. "
            "India faced not only monsoon challenges but also significant shifts in policy due to insufficient rainfall. "
            "Meanwhile, South America grappled with both severe flooding and drought conditions affecting the Amazon."
        ),
    }
    is_rel, reason = verify_news_relevance(signal)
    assert not is_rel
    assert "geographical/environmental context" in reason or "lacks bounded association" in reason


def test_amazon_india_unbounded_us_corporate_news_suppressed():
    """Verify US corporate/labor articles without India operational relevance are suppressed for Amazon (India)."""
    signal = {
        "company": "Amazon (India)",
        "title": "Amazon Unveils $1.5 Billion Pay Hike, Pushing Average Compensation Over $32/Hour",
        "url": "https://www.ndtvprofit.com/business/amazon-unveils-pay-hike",
        "raw_excerpt": "Amazon has raised its minimum starting pay to $20 an hour. Its average total compensation is now over $32 per hour.",
    }
    is_rel, reason = verify_news_relevance(signal)
    assert not is_rel
    assert "lacks bounded association with qualifier 'India'" in reason


def test_amazon_india_bengaluru_hub_prevents_false_negative():
    """Verify major Indian tech hubs (e.g. Bengaluru, Hyderabad) satisfy qualifier association even without literal 'India'."""
    signal = {
        "company": "Amazon (India)",
        "title": "Amazon opens massive 10,000-seat tech hub in Bengaluru for AI workloads",
        "url": "https://techcrunch.com/2026/09/amazon-bengaluru-ai-hub",
        "raw_excerpt": "The new Bengaluru campus will house global engineering teams focusing on agentic architectures.",
    }
    is_rel, reason = verify_news_relevance(signal)
    assert is_rel
    assert "Verified" in reason


def test_amazon_india_currency_investment_prevents_false_negative():
    """Verify domestic currency and financial markers (₹, crore) satisfy regional grounding."""
    signal = {
        "company": "Amazon (India)",
        "title": "Amazon commits ₹10,000 crore investment to expand quick delivery network",
        "url": "https://economictimes.indiatimes.com/amazon-investment",
        "raw_excerpt": "The capital injection will support dark store infrastructure across top tier-2 clusters.",
    }
    is_rel, reason = verify_news_relevance(signal)
    assert is_rel
    assert "Verified" in reason
