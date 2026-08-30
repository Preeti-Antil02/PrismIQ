import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Union

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

from src import config, monitoring_agent, noise_suppressor, event_consolidator, storage, analysis_agent, synthesis_agent, report_agent

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
) -> str:
    """
    Execute the Stage 3 Competitive Intelligence Pipeline via LangGraph State Machine:
    1. supervisor: Evaluates per-cycle run policies and skip conditions (e.g. 24h pricing cadence).
    2. monitoring: Gathers signals across sources with conditional retry and graceful fallback.
    3. noise_suppression: Upstream filtering of bot/CI noise with audit decisions.
    4. event_consolidation: Clusters signals into events with root-signal identity anchoring.
    5. analysis: Evaluates strategic impact and produces 'Why It Matters' insights.
    6. synthesis: Cross-competitor theme rollups and pattern detection.
    7. report: Renders structured brief with explicit health and supervisor disclosures.
    """
    from src.workflow import create_pipeline_graph

    logger.info(f"Starting PrismIQ pipeline (LangGraph State Machine) for target: {config.TARGET_COMPANY}")
    logger.info(f"Competitors: {config.COMPETITORS}")
    logger.info(f"Configured Sources: {config.SOURCES}")

    app = create_pipeline_graph()
    initial_state = {
        "target_company": config.TARGET_COMPANY,
        "competitors": config.COMPETITORS,
        "configured_sources": sources or list(config.SOURCES),
        "companies": companies or [config.TARGET_COMPANY] + config.COMPETITORS,
        "output_report_path": output_report_path,
        "signals_storage_path": signals_storage_path,
        "events_storage_path": events_storage_path,
    }

    final_state = app.invoke(initial_state)
    report_content = final_state.get("report_content", "")

    return report_content


if __name__ == "__main__":
    brief = run_pipeline()
    print("\n--- Pipeline Complete ---\n")
    print(brief)
