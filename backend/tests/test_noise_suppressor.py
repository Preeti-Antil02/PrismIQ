import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import noise_suppressor


def test_security_whitelist_protection():
    # Security vulnerability issue must never be suppressed
    sec_signal = {
        "source": "github",
        "company": "Vercel",
        "title": "GitHub Issue in vercel/ai: Security: no working private channel to report tool-approval signing issue",
        "raw_excerpt": "Vulnerability report on signing mechanism.",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(sec_signal)
    assert is_noise is False
    assert cat is None
    assert "Security" in reason

    # Spectre isolate vulnerability must never be suppressed
    spectre_signal = {
        "source": "news",
        "company": "Cloudflare",
        "title": "Spectre side-channel vulnerability in Workers isolate runtime",
        "raw_excerpt": "Discloses credentials across tenants.",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(spectre_signal)
    assert is_noise is False
    assert "Security" in reason


def test_strategic_ai_whitelist_protection():
    # Agent tooling branch creation must never be suppressed
    agent_signal = {
        "source": "github",
        "company": "Vercel",
        "title": "GitHub Created branch chore/configure-agent-steps-per-workflow-step in vercel/eve",
        "raw_excerpt": "The Open Framework for Building Agents",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(agent_signal)
    assert is_noise is False
    assert "Strategic" in reason

    # Kitesurf announcement must never be suppressed
    kitesurf_signal = {
        "source": "news",
        "company": "Cloudflare",
        "title": "Cloudflare Kitesurf browser engine for AI agents",
        "raw_excerpt": "Headless browser automation runtime.",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(kitesurf_signal)
    assert is_noise is False


def test_bot_and_dependency_suppression():
    # Kodiak bot automated PR review
    kodiak_signal = {
        "source": "github",
        "company": "Netlify",
        "title": "GitHub PullRequestReviewEvent created in netlify/build",
        "raw_excerpt": "Activity on repository netlify/build by kodiakhq[bot]",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(kodiak_signal)
    assert is_noise is True
    assert cat == noise_suppressor.CAT_BOT_DEPENDENCY

    # Dependabot lockfile bump
    dependabot_signal = {
        "source": "github",
        "company": "Cloudflare",
        "title": "GitHub Created branch dependabot/npm_and_yarn/packages-dcf6cd in cloudflare/web-bot-auth",
        "raw_excerpt": "Activity on repository cloudflare/web-bot-auth by dependabot[bot]",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(dependabot_signal)
    assert is_noise is True
    assert cat == noise_suppressor.CAT_BOT_DEPENDENCY


def test_ci_and_doc_formatting_suppression():
    # CI badge / README typo update
    doc_signal = {
        "source": "github",
        "company": "Vercel",
        "title": "Update README.md and fix typo in installation section",
        "raw_excerpt": "Fixed spelling mistake in markdown documentation.",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(doc_signal)
    assert is_noise is True
    assert cat == noise_suppressor.CAT_CI_DOC_FORMATTING


def test_isolated_github_social_noise():
    # Routine single watch event without strategic keywords
    watch_signal = {
        "source": "github",
        "company": "Vercel",
        "title": "GitHub WatchEvent started in vercel/repository-dispatch",
        "raw_excerpt": "Activity on repository vercel/repository-dispatch by mudbang",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(watch_signal)
    assert is_noise is True
    assert cat == noise_suppressor.CAT_ISOLATED_SOCIAL

    # Docs fork event
    fork_signal = {
        "source": "github",
        "company": "Cloudflare",
        "title": "GitHub ForkEvent forked in cloudflare/cloudflare-docs",
        "raw_excerpt": "Activity on repository cloudflare/cloudflare-docs by anascah",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(fork_signal)
    assert is_noise is True
    assert cat == noise_suppressor.CAT_ISOLATED_SOCIAL


def test_placeholder_job_postings():
    # Test ATS posting
    test_job = {
        "source": "jobs",
        "company": "Vercel",
        "title": "Test Posting — Do Not Apply",
        "raw_excerpt": "Sample test requisition.",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(test_job)
    assert is_noise is True
    assert cat == noise_suppressor.CAT_PLACEHOLDER_JOB

    # Real job posting must be preserved
    real_job = {
        "source": "jobs",
        "company": "Cloudflare",
        "title": "Senior Director of Engineering, Billing Platform",
        "raw_excerpt": "Engineering leadership role.",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(real_job)
    assert is_noise is False


def test_boundary_and_conservative_preservation():
    # Dependency bump that contains a CVE security patch -> MUST BE KEPT
    sec_dep = {
        "source": "github",
        "company": "Vercel",
        "title": "bump lodash from 4.17.20 to 4.17.21 to fix CVE-2021-23337",
        "raw_excerpt": "Fixes command injection vulnerability in lodash template.",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(sec_dep)
    assert is_noise is False
    assert "Security" in reason

    # Framework version release -> MUST BE KEPT
    release_signal = {
        "source": "github",
        "company": "Vercel",
        "title": "GitHub Release in vercel/next.js: v15.2.0",
        "raw_excerpt": "Added support for React 19 canary.",
    }
    is_noise, cat, reason = noise_suppressor.classify_signal(release_signal)
    assert is_noise is False


def test_filter_and_run_pipeline():
    signals = [
        {"source": "jobs", "company": "Vercel", "title": "Test Posting — Do Not Apply", "raw_excerpt": "Test"},
        {"source": "jobs", "company": "Vercel", "title": "Senior Staff Engineer", "raw_excerpt": "Hiring"},
        {"source": "github", "company": "Netlify", "title": "GitHub PullRequestReviewEvent created in netlify/build", "raw_excerpt": "by kodiakhq[bot]"},
        {"source": "news", "company": "Vercel", "title": "Vercel launches is-agentic.com", "raw_excerpt": "AI agent readiness"},
    ]

    result = noise_suppressor.run(signals)
    assert result["metrics"]["total_signals_in"] == 4
    assert result["metrics"]["signals_suppressed"] == 2
    assert result["metrics"]["signals_kept"] == 2
    assert len(result["kept_signals"]) == 2
    assert len(result["suppressed_signals"]) == 2
