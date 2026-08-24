import os
import sys
from pathlib import Path

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from src import config


def test_target_company():
    assert config.TARGET_COMPANY == "Vercel"


def test_competitors_exact_inclusion():
    expected = ["Netlify", "Cloudflare Pages", "Cloudflare Workers"]
    assert config.COMPETITORS == expected
    assert set(config.COMPETITORS) == {"Netlify", "Cloudflare Pages", "Cloudflare Workers"}
    assert len(config.COMPETITORS) == 3


def test_competitors_exclusions():
    # AWS Amplify is explicitly excluded for Stage 1
    assert "AWS Amplify" not in config.COMPETITORS
    assert not any("amplify" in c.lower() for c in config.COMPETITORS)


def test_sources_exact_inclusion():
    expected = ["news", "github"]
    assert config.SOURCES == expected
    assert set(config.SOURCES) == {"news", "github"}
    assert len(config.SOURCES) == 2


def test_sources_exclusions():
    # Pricing, job postings, patents, and research papers are explicitly excluded
    excluded_sources = {
        "pricing",
        "jobs",
        "job postings",
        "job_postings",
        "patents",
        "research papers",
        "research_papers",
        "research-papers",
    }
    for excluded in excluded_sources:
        assert excluded not in config.SOURCES
        assert excluded not in [s.lower() for s in config.SOURCES]
