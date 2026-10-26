import time
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


_LAST_RUN_SUMMARY: Dict[str, Any] = {}


def get_pipeline_summary_metrics() -> Dict[str, Any]:
    """Retrieve structured metrics dictionary from the last pipeline execution."""
    global _LAST_RUN_SUMMARY
    return dict(_LAST_RUN_SUMMARY)


def run_pipeline(
    output_report_path: Optional[Union[str, Path]] = None,
    signals_storage_path: Optional[Union[str, Path]] = None,
    events_storage_path: Optional[Union[str, Path]] = None,
    companies: Optional[List[str]] = None,
    sources: Optional[List[str]] = None,
    tenants: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """Execute pipeline via run_pipeline_with_status and return primary markdown report."""
    global _LAST_RUN_SUMMARY
    from src.workflow import run_pipeline_with_status
    start_m = time.monotonic()
    result = run_pipeline_with_status(
        output_report_path=output_report_path,
        signals_storage_path=signals_storage_path,
        events_storage_path=events_storage_path,
        companies=companies,
        sources=sources,
        tenants=tenants,
        process_start_monotonic=start_m,
    )
    _LAST_RUN_SUMMARY = result.get("metrics_summary") or {
        "status": result.get("status"),
        "duration_seconds": round(time.monotonic() - start_m, 2),
        "phase_timing": result.get("phase_timing", {}),
    }
    if result.get("status") == "failed" and result.get("is_owner_fatal"):
        errors = result.get("errors", [])
        raise RuntimeError(f"Owner pipeline execution failed: {'; '.join(errors)}")
    return result.get("report_content", "")



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
