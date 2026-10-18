"""
Unit tests for delivery isolation and webhook URL resolution.
Verifies that non-owner tenants never leak or fall back to the owner's webhook,
and that delivery_node dispatches to the correct endpoints without crashing on failures.
"""
import pytest
from unittest.mock import patch, MagicMock
from src.workflow import resolve_tenant_webhook_url, delivery_node

OWNER_ID = "c8f13b91-46ef-4682-9975-f85764d8a12e"
NON_OWNER_ID = "33b6429f-fde1-48c2-a52b-98272e62ff57"
OTHER_ID = "e4b2a7d1-1234-4567-89ab-cdef01234567"


def test_resolve_tenant_webhook_non_owner_with_custom_url():
    """Non-owner tenant with custom URL returns their URL."""
    custom_url = "https://hooks.slack.com/services/T00/B00/custom33b"
    res = resolve_tenant_webhook_url(
        tenant_id=NON_OWNER_ID,
        tenant_cfg={"slack_webhook_url": custom_url},
        state={"slack_webhook_url": "https://hooks.slack.com/services/OWNER"},
        owner_id=OWNER_ID,
    )
    assert res == custom_url


def test_resolve_tenant_webhook_non_owner_without_custom_url_never_leaks_owner():
    """Non-owner tenant without custom URL gets None and NEVER falls back to owner URL."""
    res = resolve_tenant_webhook_url(
        tenant_id=NON_OWNER_ID,
        tenant_cfg={"slack_webhook_url": ""},
        state={"slack_webhook_url": "https://hooks.slack.com/services/OWNER"},
        owner_id=OWNER_ID,
    )
    assert res is None

    res2 = resolve_tenant_webhook_url(
        tenant_id=OTHER_ID,
        tenant_cfg=None,
        state={"slack_webhook_url": "https://hooks.slack.com/services/OWNER"},
        owner_id=OWNER_ID,
    )
    assert res2 is None


def test_resolve_tenant_webhook_owner_falls_back_to_state_or_global():
    """Owner tenant falls back to state webhook or config if no custom cfg is set."""
    state_url = "https://hooks.slack.com/services/OWNER_STATE"
    res = resolve_tenant_webhook_url(
        tenant_id=OWNER_ID,
        tenant_cfg={"slack_webhook_url": ""},
        state={"slack_webhook_url": state_url},
        owner_id=OWNER_ID,
    )
    assert res == state_url


def test_delivery_node_isolated_execution():
    """delivery_node calls delivery_agent for each tenant with isolated webhooks."""
    state = {
        "tenants": [
            {"tenant_id": OWNER_ID, "slack_webhook_url": "https://hooks.slack.com/services/OWNER"},
            {"tenant_id": NON_OWNER_ID, "slack_webhook_url": ""},
            {"tenant_id": OTHER_ID, "slack_webhook_url": "https://hooks.slack.com/services/OTHER"},
        ],
        "tenant_results": {
            OWNER_ID: {"synthesis": {"brief": "Owner Brief"}},
            NON_OWNER_ID: {"synthesis": {"brief": "33b Brief"}},
            OTHER_ID: {"synthesis": {"brief": "Other Brief"}},
        },
        "supervisor_decisions": {},
        "source_health": {},
    }

    with patch("src.delivery_agent.run") as mock_delivery_run, \
         patch("src.storage.complete_pipeline_run") as mock_complete:
        mock_delivery_run.side_effect = lambda **kwargs: {
            "digest_text": f"Digest for {kwargs.get('webhook_url')}",
            "delivery_status": {"status": "success" if kwargs.get("webhook_url") else "skipped"},
        }

        res = delivery_node(state)

        assert mock_delivery_run.call_count == 3
        # Verify kwargs of each call
        calls = mock_delivery_run.call_args_list
        urls_called = [c.kwargs.get("webhook_url") for c in calls]
        assert "https://hooks.slack.com/services/OWNER" in urls_called
        assert None in urls_called  # NON_OWNER_ID has None, never owner's URL
        assert "https://hooks.slack.com/services/OTHER" in urls_called

        # Verify tenant_results in output
        assert res["tenant_results"][NON_OWNER_ID]["delivery_status"]["status"] == "skipped"
