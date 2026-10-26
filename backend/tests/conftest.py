import os
import sys
import pytest

@pytest.fixture(autouse=True, scope="session")
def enforce_test_isolation_guard():
    """
    Hard test isolation safeguard:
    1. Sets PRISMIQ_ENV='test'
    2. Strips production SUPABASE_DB_URL from the test environment.
    3. Guarantees that tests execute in complete isolation without network or DB pollution.
    """
    os.environ["PRISMIQ_ENV"] = "test"
    prod_url = os.environ.pop("SUPABASE_DB_URL", None)
    yield
    if prod_url:
        os.environ["SUPABASE_DB_URL"] = prod_url


@pytest.fixture(autouse=True)
def isolate_test_data_dir(tmp_path, monkeypatch):
    """
    Ensure all tests run with isolated temporary DATA_DIR to prevent
    polluting git-tracked published_briefs or backend/data.
    """
    test_dir = tmp_path / "test_isolated_data"
    test_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("DATA_DIR", str(test_dir))

