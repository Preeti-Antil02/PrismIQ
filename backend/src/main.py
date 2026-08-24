import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Union

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

from src import config, monitoring_agent, storage, analysis_agent, report_agent

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
) -> str:
    """
    Execute the Stage 1 Competitive Intelligence Pipeline:
    1. Monitoring: Gather recent signals for target and competitors from News and GitHub.
    2. Storage: Persist collected raw signals to flat JSON (both timestamped historical file and latest).
    3. Analysis: Run LLM analysis to produce 'why it matters' and confidence scores.
    4. Report: Render structured markdown brief starting with Top 3 decisions.
    5. Output: Write the final brief to disk (both timestamped historical file and latest) and return content.
    """
    data_dir = _get_data_dir()
    default_report_file = data_dir / "brief.md"

    logger.info(f"Starting PrismIQ pipeline for target: {config.TARGET_COMPANY}")
    logger.info(f"Competitors: {config.COMPETITORS}")
    logger.info(f"Sources: {config.SOURCES}")

    # Stage 1: Monitoring
    logger.info("Stage 1/4: Monitoring - Fetching signals...")
    signals = monitoring_agent.run()
    logger.info(f"Collected {len(signals)} signals across all sources.")

    # Stage 2: Storage
    logger.info("Stage 2/4: Storage - Persisting raw signals...")
    saved_signals_path = storage.save_signals(signals, filepath=signals_storage_path)
    logger.info(f"Signals persisted to {saved_signals_path}")

    # Stage 3: Analysis
    logger.info("Stage 3/4: Analysis - Analyzing signals for strategic impact...")
    findings = analysis_agent.run(signals)
    logger.info(f"Analyzed {len(findings)} findings.")

    # Stage 4: Report Generation
    logger.info("Stage 4/4: Report - Generating markdown intelligence brief...")
    report_content = report_agent.run(findings)

    # Stage 5: Output Persistence
    if output_report_path:
        report_file = Path(output_report_path)
        report_file.parent.mkdir(parents=True, exist_ok=True)
        with open(report_file, "w", encoding="utf-8") as f:
            f.write(report_content)
        logger.info(f"Competitive brief successfully written to {report_file}")
    else:
        data_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        timestamped_report = data_dir / f"brief_{timestamp}.md"

        # Write timestamped historical brief
        with open(timestamped_report, "w", encoding="utf-8") as f:
            f.write(report_content)
        # Write latest snapshot brief
        with open(default_report_file, "w", encoding="utf-8") as f:
            f.write(report_content)
        logger.info(f"Competitive brief successfully written to {timestamped_report} and {default_report_file}")

    return report_content


if __name__ == "__main__":
    brief = run_pipeline()
    print("\n--- Pipeline Complete ---\n")
    print(brief)
