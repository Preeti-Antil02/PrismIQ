import pytest
from src import research_classifier


def test_arxiv_affiliation_verification_positives():
    # Cloudflare verified affiliations
    assert research_classifier.is_verified_arxiv_affiliation("Cloudflare", ["Cloudflare Research", "MIT"])
    assert research_classifier.is_verified_arxiv_affiliation("Cloudflare Pages/Workers", ["Cloudflare, Inc."])
    assert research_classifier.is_verified_arxiv_affiliation("Cloudflare", ["Cloudflare"])
    
    # Vercel verified affiliations
    assert research_classifier.is_verified_arxiv_affiliation("Vercel", ["Vercel Labs"])
    assert research_classifier.is_verified_arxiv_affiliation("Vercel", ["Vercel, Inc."])
    
    # Netlify verified affiliations
    assert research_classifier.is_verified_arxiv_affiliation("Netlify", ["Netlify, Inc."])


def test_arxiv_affiliation_verification_negatives():
    # Third-party university papers that merely mention the company name in text/abstract
    assert not research_classifier.is_verified_arxiv_affiliation(
        "Cloudflare", ["Department of Computer Science, Stanford University", "UC Berkeley"]
    )
    assert not research_classifier.is_verified_arxiv_affiliation(
        "Vercel", ["IIT Bombay", "Case Western Reserve University"]
    )
    assert not research_classifier.is_verified_arxiv_affiliation(
        "Netlify", ["Oxford University", "Carnegie Mellon University"]
    )
    assert not research_classifier.is_verified_arxiv_affiliation("Cloudflare", [])
    assert not research_classifier.is_verified_arxiv_affiliation("Cloudflare", ["None", ""])


def test_classifier_named_true_positives_technical_depth():
    """
    Validation against real technical deep-dives and engineering write-ups.
    """
    technical_posts = [
        (
            "How we could save petabytes of cache storage with Zstandard and Pingora",
            "We prototyped compression inside Cloudflare's cache to find out.",
            "https://blog.cloudflare.com/cache-transcoding/",
        ),
        (
            "How we saved 100 terabytes of memory by optimizing 1.1.1.1's DNS cache",
            "Five Rust-level memory optimizations to the DNS cache layout of Big Pineapple cut per-entry memory by 56%.",
            "https://blog.cloudflare.com/dns-cache-memory-optimization-1111/",
        ),
        (
            "A revisit of remote Spectre attacks on Cloudflare Workers",
            "In 2024 and 2025, we reassessed remote Spectre attacks on our Workers infrastructure.",
            "https://blog.cloudflare.com/revisiting-spectre-attacks-on-workers/",
        ),
        (
            "BGP Role model: tracking the adoption of RFC 9234",
            "RFC 9234 lets routers reject route leaks on their own, using BGP Roles. We measured route leak prevention.",
            "https://blog.cloudflare.com/rfc9234-bgp-role-model/",
        ),
        (
            "Introducing Meerkat: an experiment in global consensus",
            "Cloudflare Research is building a global consensus service called Meerkat that uses a new consensus algorithm.",
            "https://blog.cloudflare.com/meerkat-introduction/",
        ),
        (
            "Choosing an AI model: one prompt, 11 models, very different results",
            "We tested 11 of them on the same build benchmark with comparative empirical methodology.",
            "https://www.netlify.com/blog/one-prompt-11-models-very-different-results",
        ),
        (
            "The full power of Git, without the friction: A conversation with Netlify CTO Dana Lawson",
            "Netlify CTO Dana Lawson explains why Netlify brought Git infrastructure in-house and rebuilt its architecture.",
            "https://www.netlify.com/blog/netlify-source-with-netlify-cto-dana-lawson",
        ),
        (
            "MCP goes stateless and extensible",
            "The new stateless MCP spec makes building AI tools simpler. Learn how Netlify supports stateless MCP today.",
            "https://www.netlify.com/blog/mcp-goes-stateless-and-extensible",
        ),
        (
            "Compute that takes any shape",
            "Deep architectural dive into fluid compute runtime internals and serverless memory scaling.",
            "https://vercel.com/blog/fluid-compute-takes-any-shape",
        ),
    ]

    for title, excerpt, url in technical_posts:
        is_res, reason, indicators = research_classifier.classify_research_content(
            title, excerpt, url=url, source="blog"
        )
        assert is_res, f"Expected '{title}' to be classified as RESEARCH, but got False: {reason}"
        assert len(indicators) > 0


def test_classifier_named_true_negatives_routine_marketing_and_changelogs():
    """
    Validation against real routine product changelogs, marketing, and UI updates.
    """
    routine_posts = [
        (
            "Build with Netlify came to Atlanta",
            "What happened when we brought Netlify to builders in Atlanta for our community tour.",
            "https://www.netlify.com/blog/build-with-netlify-came-to-atlanta",
        ),
        (
            "Compete in OpenAI's WebMCP Challenge with Netlify",
            "Join the OpenAI WebMCP Challenge with Netlify and compete for $5,000 in prizes.",
            "https://www.netlify.com/blog/compete-openai-webmcp-challenge",
        ),
        (
            "New Netlify projects are now private by default",
            "Sites & apps on Netlify now start private. You can toggle public access in settings.",
            "https://www.netlify.com/blog/new-netlify-projects-are-now-private-by-default",
        ),
        (
            "Gemini 3.8 Flash now available on AI Gateway",
            "Gemini 3.8 Flash is now supported on Vercel AI Gateway.",
            "https://vercel.com/changelog/gemini-3-8-flash-now-available-on-ai-gateway",
        ),
        (
            "GLM-5.3 is 50% off through DigitalOcean on AI Gateway",
            "Get 50% discount on GLM-5.3 models on AI Gateway through DigitalOcean.",
            "https://vercel.com/changelog/glm-5-3-is-50-off-through-digitalocean-on-ai-gateway",
        ),
        (
            "App and dev domains included with free domain for Pro",
            "Pro subscribers now get .app and .dev domain names included for free.",
            "https://vercel.com/changelog/app-and-dev-domains-included-with-free-domain-for-pro",
        ),
        (
            "BotBase for Operators: A clearer path to joining Cloudflare's directory of bots and agents",
            "Bot operators now have a home in the Cloudflare dashboard to manage directory submissions.",
            "https://blog.cloudflare.com/botbase-for-operators/",
        ),
        (
            "Say it once: Introducing Bot Preference Sync",
            "Automatically align your robots.txt file with your AI bot dashboard settings.",
            "https://blog.cloudflare.com/bot-preference-sync/",
        ),
        (
            "From all-or-nothing to task-based OAuth consent",
            "Cloudflare OAuth now supports optional scopes for user permission consent screens.",
            "https://blog.cloudflare.com/task-based-oauth-consent/",
        ),
    ]

    for title, excerpt, url in routine_posts:
        is_res, reason, indicators = research_classifier.classify_research_content(
            title, excerpt, url=url, source="blog"
        )
        assert not is_res, f"Expected '{title}' to be classified as ROUTINE, but got True ({reason})"


def test_classify_signal_structure():
    raw_sig = {
        "source": "research",
        "company": "Cloudflare Pages/Workers",
        "title": "How we saved 100 terabytes of memory by optimizing 1.1.1.1's DNS cache",
        "url": "https://blog.cloudflare.com/dns-cache-memory-optimization-1111/",
        "raw_excerpt": "Rust-level memory optimization cut per-entry memory by 56%.",
    }
    enriched = research_classifier.classify_signal(raw_sig)
    assert enriched["source_subtype"] == "research"
    assert enriched["research_details"]["type"] == "technical_writeup"
    assert "indicators" in enriched["research_details"]
