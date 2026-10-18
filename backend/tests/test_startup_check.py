import os
import pytest
from unittest.mock import MagicMock, patch
from src import storage, workflow


def test_get_active_tenants_missing_scheduled_table_fails():
    """Verify that when scope='scheduled' and scheduled_tenants table is missing, raises RuntimeError."""
    mock_cursor = MagicMock()
    # Mock information_schema query returning None (table does not exist)
    mock_cursor.fetchone.return_value = None

    with patch.dict(os.environ, {"PRISMIQ_ENV": "production", "PIPELINE_SCOPE": "scheduled"}), \
         patch.object(storage, "is_test_environment", return_value=False), \
         patch.object(storage, "get_db_cursor") as mock_get_cur:
        mock_get_cur.return_value.__enter__.return_value = mock_cursor
        with pytest.raises(RuntimeError, match="Table 'scheduled_tenants' does not exist"):
            storage.get_active_tenants(scope="scheduled")


def test_get_active_tenants_empty_scheduled_table_returns_empty_list():
    """Verify that when scheduled_tenants has 0 rows, returns empty list without synthetic fallback."""
    mock_cursor = MagicMock()
    # Table exists
    mock_cursor.fetchone.return_value = (1,)
    # Query returns no active tenants
    mock_cursor.fetchall.return_value = []

    with patch.dict(os.environ, {"PRISMIQ_ENV": "production", "PIPELINE_SCOPE": "scheduled"}), \
         patch.object(storage, "is_test_environment", return_value=False), \
         patch.object(storage, "get_db_cursor") as mock_get_cur:
        mock_get_cur.return_value.__enter__.return_value = mock_cursor
        tenants = storage.get_active_tenants(scope="scheduled")
        assert tenants == []


def test_run_pipeline_startup_check_fails_on_empty_tenants():
    """Verify that run_pipeline_with_status raises RuntimeError and fails when active_tenants is empty."""
    with patch.object(storage, "get_active_tenants", return_value=[]), \
         patch.object(storage, "get_all_tracked_companies", return_value=[]):
        with pytest.raises(RuntimeError, match="FATAL: No scheduled or active tenants found"):
            workflow.run_pipeline_with_status()


def test_get_active_tenants_scope_owner():
    """Verify scope='owner' queries strictly for OWNER_TENANT_ID."""
    owner_id = "c8f13b91-46ef-4682-9975-f85764d8a12e"
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = [
        (owner_id, "Vercel", ["Netlify"], ["Vercel", "Netlify"], "https://hooks.slack.com/xyz", "daily", True)
    ]

    with patch.dict(os.environ, {"PRISMIQ_ENV": "production", "OWNER_TENANT_ID": owner_id}), \
         patch.object(storage, "is_test_environment", return_value=False), \
         patch.object(storage, "get_db_cursor") as mock_get_cur:
        mock_get_cur.return_value.__enter__.return_value = mock_cursor
        tenants = storage.get_active_tenants(scope="owner")
        assert len(tenants) == 1
        assert tenants[0]["tenant_id"] == owner_id
        assert tenants[0]["target_company"] == "Vercel"


def test_get_active_tenants_scope_scheduled_success():
    """Verify scope='scheduled' joins scheduled_tenants and returns active tenants."""
    owner_id = "c8f13b91-46ef-4682-9975-f85764d8a12e"
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = (1,)  # Table exists
    mock_cursor.fetchall.return_value = [
        (owner_id, "Vercel", ["Netlify"], ["Vercel", "Netlify"], None, "daily", True)
    ]

    with patch.dict(os.environ, {"PRISMIQ_ENV": "production", "PIPELINE_SCOPE": "scheduled"}), \
         patch.object(storage, "is_test_environment", return_value=False), \
         patch.object(storage, "get_db_cursor") as mock_get_cur:
        mock_get_cur.return_value.__enter__.return_value = mock_cursor
        tenants = storage.get_active_tenants(scope="scheduled")
        assert len(tenants) == 1
        assert tenants[0]["tenant_id"] == owner_id


def test_resolve_owner_tenant_id_default():
    """Verify resolve_owner_tenant_id returns default valid UUID when env var is unset or empty."""
    with patch.dict(os.environ, {}, clear=True):
        res = workflow.resolve_owner_tenant_id()
        assert res == "c8f13b91-46ef-4682-9975-f85764d8a12e"

    with patch.dict(os.environ, {"OWNER_TENANT_ID": ""}):
        res = workflow.resolve_owner_tenant_id()
        assert res == "c8f13b91-46ef-4682-9975-f85764d8a12e"


def test_resolve_owner_tenant_id_invalid_uuid_fails():
    """Verify resolve_owner_tenant_id fails loudly with ValueError if configured with invalid UUID."""
    with patch.dict(os.environ, {"OWNER_TENANT_ID": "not-a-valid-uuid"}):
        with pytest.raises(ValueError, match="empty or not a valid UUID"):
            workflow.resolve_owner_tenant_id()


def test_startup_fails_if_owner_id_not_uuid():
    """Verify pipeline startup fails immediately if OWNER_TENANT_ID is malformed."""
    with patch.dict(os.environ, {"OWNER_TENANT_ID": "malformed_tenant_string"}):
        with pytest.raises(ValueError, match="empty or not a valid UUID"):
            workflow.run_pipeline_with_status()
