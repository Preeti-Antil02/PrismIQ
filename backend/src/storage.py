import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union


def _get_data_dir() -> Path:
    """
    Get active data directory.
    1. Checks DATA_DIR env override (resolves absolute or relative paths).
    2. Falls back to backend/published_briefs if it contains brief files.
    3. Defaults to backend/data.
    """
    env_dir = os.getenv("DATA_DIR")
    backend_root = Path(__file__).resolve().parent.parent

    if env_dir:
        p = Path(env_dir)
        if p.is_absolute() and p.exists():
            return p
        resolved = backend_root / p
        if resolved.exists():
            return resolved
        cwd_resolved = Path.cwd() / p
        if cwd_resolved.exists():
            return cwd_resolved
        return resolved

    published_dir = backend_root / "published_briefs"
    if published_dir.exists() and any(published_dir.glob("brief*.md")):
        return published_dir

    return backend_root / "data"


def save_signals(
    signals: List[Dict[str, Any]],
    filepath: Optional[Union[str, Path]] = None,
) -> Path:
    """
    Save a list of normalized signal dictionaries to a flat JSON file.
    When filepath is not specified, saves to a timestamped file (signals_YYYYMMDD_HHMMSS.json)
    to retain run history, and also updates the latest snapshot (signals.json).
    Creates parent directories if they don't exist.
    """
    data_dir = _get_data_dir()
    default_signals_file = data_dir / "signals.json"

    if filepath:
        target_path = Path(filepath)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(signals, f, indent=2, ensure_ascii=False)
        return target_path

    data_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    timestamped_file = data_dir / f"signals_{timestamp}.json"

    # Write timestamped historical run file
    with open(timestamped_file, "w", encoding="utf-8") as f:
        json.dump(signals, f, indent=2, ensure_ascii=False)

    # Write latest snapshot file
    with open(default_signals_file, "w", encoding="utf-8") as f:
        json.dump(signals, f, indent=2, ensure_ascii=False)

    return timestamped_file


def load_signals(
    filepath: Optional[Union[str, Path]] = None,
) -> List[Dict[str, Any]]:
    """
    Load a list of normalized signal dictionaries from a flat JSON file.
    Returns an empty list if the file does not exist.
    """
    data_dir = _get_data_dir()

    if filepath:
        target_path = Path(filepath)
        if not target_path.exists():
            return []
    else:
        default_signals_file = data_dir / "signals.json"
        if default_signals_file.exists():
            target_path = default_signals_file
        else:
            # Fallback to the latest timestamped file if signals.json doesn't exist
            timestamped_files = sorted(data_dir.glob("signals_*.json"), reverse=True)
            if timestamped_files:
                target_path = timestamped_files[0]
            else:
                return []

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                return data
            return []
    except Exception:
        return []
