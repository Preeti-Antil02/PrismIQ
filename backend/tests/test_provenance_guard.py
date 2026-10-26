"""
Unit tests for the Trend Evolution Provenance Guard.
Ensures that no trend cluster or member export accepts non-DB row objects or synthetic data.
Every member MUST have a non-empty event_id (from consolidated_events) or id (from research_items).
"""
import pytest
from typing import Dict, Any

def validate_db_member_provenance(member: Dict[str, Any]) -> None:
    """
    Enforce strict DB row provenance.
    Raises ValueError or AssertionError if the member is not a verified DB row.
    """
    event_id = member.get("event_id") or member.get("id")
    if not event_id or not isinstance(event_id, str):
        raise ValueError(f"Provenance violation: Missing or invalid event_id in member: {member.get('title')}")
    
    # Must have a real URL starting with http:// or https://
    url = member.get("url") or member.get("source_url") or member.get("canonical_url")
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        raise ValueError(f"Provenance violation: Missing or invalid URL in member {event_id}: {url}")

    # Must have a resolved publisher
    publisher = member.get("publisher") or member.get("publisher_domain")
    if not publisher:
        raise ValueError(f"Provenance violation: Missing publisher in member {event_id}")

    # Must have valid date provenance
    date_source = member.get("date_source")
    if not date_source:
        raise ValueError(f"Provenance violation: Missing date_source provenance in member {event_id}")


def test_provenance_guard_accepts_valid_db_row():
    valid_row = {
        "event_id": "evt_c9d1a631695f902d",
        "company": "Anthropic",
        "title": "Anthropic Bans Cruelty to Claude",
        "url": "https://rews.cc/a/anthropic-bans-cruelty-to-claude",
        "publisher": "rews.cc",
        "date_source": "source_publication_timestamp",
        "date_precision": "second"
    }
    # Should pass without error
    validate_db_member_provenance(valid_row)


def test_provenance_guard_rejects_missing_event_id():
    synthetic_row = {
        "company": "Anthropic",
        "title": "Fabricated Title Without DB ID",
        "url": "https://example.com/fake",
        "publisher": "example.com",
        "date_source": "source_publication_timestamp"
    }
    with pytest.raises(ValueError, match="Missing or invalid event_id"):
        validate_db_member_provenance(synthetic_row)


def test_provenance_guard_rejects_missing_url():
    invalid_row = {
        "event_id": "evt_12345",
        "company": "OpenAI",
        "title": "Some Title",
        "url": "",
        "publisher": "techcrunch.com",
        "date_source": "source_publication_timestamp"
    }
    with pytest.raises(ValueError, match="Missing or invalid URL"):
        validate_db_member_provenance(invalid_row)


def test_provenance_guard_rejects_missing_date_source():
    invalid_row = {
        "event_id": "evt_12345",
        "company": "OpenAI",
        "title": "Some Title",
        "url": "https://techcrunch.com/article",
        "publisher": "techcrunch.com"
    }
    with pytest.raises(ValueError, match="Missing date_source provenance"):
        validate_db_member_provenance(invalid_row)
