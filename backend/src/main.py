import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

# Ensure UTF-8 stdout on Windows
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Ensure backend root is in sys.path
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from src import config, storage

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def _get_data_dir() -> Path:
    """Get active data directory, supporting DATA_DIR env override."""
    env_dir = os.getenv("DATA_DIR")
    if env_dir:
        p = Path(env_dir)
        if p.is_absolute():
            return p
        resolved = backend_root / p
        if resolved.exists():
            return resolved
        return Path.cwd() / p
    return backend_root / "data"


def run_pipeline(
    output_report_path: Optional[Union[str, Path]] = None,
    signals_storage_path: Optional[Union[str, Path]] = None,
    events_storage_path: Optional[Union[str, Path]] = None,
    companies: Optional[List[str]] = None,
    sources: Optional[List[str]] = None,
    tenants: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """
    Execute the Multi-Tenant Competitive Intelligence Pipeline via LangGraph State Machine:
    Phase 1 (Global Shared):
      1. supervisor: Evaluates per-cycle run policies and skip conditions (e.g. 24h pricing cadence).
      2. monitoring: Gathers signals across distinct union of all tracked companies.
      3. noise_suppression: Upstream filtering of bot/CI noise with audit decisions.
      4. event_consolidation: Clusters signals into events with canonical fact_confidence.
    Phase 2 (Per-Tenant Scoped):
      5. per_tenant_processing: Runs Analysis, Synthesis, Report, and Delivery per active tenant.
    
    Returns:
      The primary/owner tenant's markdown intelligence brief content.
    """
    from src.workflow import create_pipeline_graph

    tracked_companies = companies or storage.get_all_tracked_companies()
    active_tenants = tenants or storage.get_active_tenants()

    logger.info(f"Starting PrismIQ Multi-Tenant Pipeline across {len(tracked_companies)} distinct companies: {tracked_companies}")
    logger.info(f"Active Tenants ({len(active_tenants)}): {[t.get('tenant_id') for t in active_tenants]}")
    logger.info(f"Configured Sources: {sources or config.SOURCES}")

    app = create_pipeline_graph()
    initial_state = {
        "target_company": config.TARGET_COMPANY,
        "competitors": list(config.COMPETITORS),
        "configured_sources": sources or list(config.SOURCES),
        "companies": tracked_companies,
        "tenants": active_tenants,
        "output_report_path": output_report_path,
        "signals_storage_path": signals_storage_path,
        "events_storage_path": events_storage_path,
    }

    final_state = app.invoke(initial_state)
    report_content = final_state.get("report_content", "")

    return report_content


def run_multi_tenant_pipeline(
    companies: Optional[List[str]] = None,
    sources: Optional[List[str]] = None,
    tenants: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Execute full multi-tenant pipeline and return complete state dictionary with all tenant outputs."""
    from src.workflow import create_pipeline_graph

    tracked_companies = companies or storage.get_all_tracked_companies()
    active_tenants = tenants or storage.get_active_tenants()

    app = create_pipeline_graph()
    initial_state = {
        "target_company": config.TARGET_COMPANY,
        "competitors": list(config.COMPETITORS),
        "configured_sources": sources or list(config.SOURCES),
        "companies": tracked_companies,
        "tenants": active_tenants,
    }

    final_state = app.invoke(initial_state)
    return final_state


if __name__ == "__main__":
    brief = run_pipeline()
    print("\n--- Pipeline Complete ---\n")
    print(brief)
