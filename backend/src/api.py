import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="PrismIQ API",
    description="Read-only competitive intelligence API serving weekly markdown briefs and historical archives.",
    version="1.0.0",
)

# Open CORS configuration for public read-only resume/portfolio project
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _get_data_dir() -> Path:
    """Get the active data directory, supporting DATA_DIR env override."""
    env_dir = os.getenv("DATA_DIR")
    if env_dir:
        p = Path(env_dir)
        if p.is_absolute():
            return p
        backend_root = Path(__file__).resolve().parent.parent
        resolved = backend_root / p
        if resolved.exists():
            return resolved
        return Path.cwd() / p
    return Path(__file__).resolve().parent.parent / "data"


def _extract_preview(content: str) -> Optional[str]:
    """
    Extract a concise preview headline from the Top 3 decisions section of a brief.
    Matches the first item (e.g. '1. **Company** (Signal Title): ...')
    """
    if not content:
        return None

    # Try matching structured Top 1 item: '1. **Company** (Title): ...'
    match = re.search(r"(?:^|\n)1\.\s+\*\*([^*]+)\*\*\s*\(([^)]+)\)", content)
    if match:
        company = match.group(1).strip()
        title = match.group(2).strip()
        return f"{company}: {title}"

    # Fallback: match any first item under Top 3
    match_fallback = re.search(r"(?:^|\n)1\.\s+([^\n]+)", content)
    if match_fallback:
        return match_fallback.group(1).strip()[:140]

    return None


def _parse_date(filename: str, file_path: Path) -> str:
    """Derive an ISO formatted UTC date string from a brief's filename or file mtime."""
    # Match brief_YYYYMMDD_HHMMSS.md
    m = re.match(r"brief_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.md$", filename)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}T{m.group(4)}:{m.group(5)}:{m.group(6)}Z"

    # Match brief_YYYY-MM-DD.md
    m_date = re.match(r"brief_(\d{4}-\d{2}-\d{2})\.md$", filename)
    if m_date:
        return f"{m_date.group(1)}T00:00:00Z"

    # Fallback to file modification time
    try:
        mtime = file_path.stat().st_mtime
        return datetime.fromtimestamp(mtime, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _get_brief_id(filename: str) -> str:
    """Extract a clean identifier from a filename (e.g. '20260823_115500' or 'latest')."""
    if filename == "brief.md":
        return "latest"
    m = re.match(r"brief_(.+)\.md$", filename)
    if m:
        return m.group(1)
    return filename.replace(".md", "")


@app.get("/")
@app.get("/health")
def health_check() -> Dict[str, str]:
    """Root health check endpoint for monitoring and uptime verification."""
    return {"status": "ok", "service": "PrismIQ Competitive Intelligence API"}


@app.get("/briefs")
def list_briefs() -> Dict[str, List[Dict[str, Any]]]:
    """
    List all available competitive briefs, sorted newest first.
    Returns identifiers, formatted dates, and short preview headlines.
    """
    data_dir = _get_data_dir()
    if not data_dir.exists():
        return {"briefs": []}

    brief_entries: List[Dict[str, Any]] = []
    seen_ids = set()

    # Find all timestamped brief files first
    timestamped_files = sorted(data_dir.glob("brief_*.md"), reverse=True)
    for file_path in timestamped_files:
        filename = file_path.name
        brief_id = _get_brief_id(filename)
        date_str = _parse_date(filename, file_path)
        
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            content = ""

        preview = _extract_preview(content)
        seen_ids.add(brief_id)
        brief_entries.append({
            "id": brief_id,
            "date": date_str,
            "filename": filename,
            "preview": preview,
        })

    # If no timestamped briefs exist but brief.md exists, include it
    latest_path = data_dir / "brief.md"
    if latest_path.exists() and not timestamped_files:
        date_str = _parse_date("brief.md", latest_path)
        try:
            content = latest_path.read_text(encoding="utf-8")
        except Exception:
            content = ""
        preview = _extract_preview(content)
        brief_entries.append({
            "id": "latest",
            "date": date_str,
            "filename": "brief.md",
            "preview": preview,
        })

    # Sort newest first by date string
    brief_entries.sort(key=lambda x: x["date"], reverse=True)
    return {"briefs": brief_entries}


@app.get("/briefs/latest")
def get_latest_brief() -> Dict[str, Any]:
    """
    Get the most recent competitive intelligence brief as raw markdown content.
    """
    data_dir = _get_data_dir()
    latest_file = data_dir / "brief.md"

    # If brief.md doesn't exist, check for the newest timestamped brief
    target_file: Optional[Path] = None
    if latest_file.exists():
        target_file = latest_file
    else:
        timestamped_files = sorted(data_dir.glob("brief_*.md"), reverse=True)
        if timestamped_files:
            target_file = timestamped_files[0]

    if not target_file or not target_file.exists():
        raise HTTPException(status_code=404, detail="No competitive briefs available.")

    try:
        content = target_file.read_text(encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read brief file: {str(e)}")

    date_str = _parse_date(target_file.name, target_file)
    return {
        "id": "latest",
        "date": date_str,
        "filename": target_file.name,
        "content": content,
    }


@app.get("/briefs/{brief_id}")
def get_brief_by_id(brief_id: str) -> Dict[str, Any]:
    """
    Get a specific historical competitive intelligence brief by date/identifier or filename.
    """
    if brief_id == "latest":
        return get_latest_brief()

    data_dir = _get_data_dir()
    if not data_dir.exists():
        raise HTTPException(status_code=404, detail=f"Brief '{brief_id}' not found.")

    # Candidate file resolution paths
    candidate_names = [
        f"brief_{brief_id}.md",
        f"{brief_id}.md" if not brief_id.endswith(".md") else brief_id,
        brief_id,
    ]

    target_file: Optional[Path] = None
    for name in candidate_names:
        candidate_path = data_dir / name
        if candidate_path.exists() and candidate_path.is_file():
            target_file = candidate_path
            break

    # If not found by exact candidate names, search by date prefix in filename
    if not target_file:
        clean_id = brief_id.replace("-", "").replace("T", "_").replace("Z", "").replace(":", "")
        for file_path in data_dir.glob("brief_*.md"):
            if clean_id in file_path.name or brief_id in file_path.name:
                target_file = file_path
                break

    if not target_file or not target_file.exists():
        raise HTTPException(status_code=404, detail=f"Brief '{brief_id}' not found.")

    try:
        content = target_file.read_text(encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read brief file: {str(e)}")

    date_str = _parse_date(target_file.name, target_file)
    return {
        "id": _get_brief_id(target_file.name),
        "date": date_str,
        "filename": target_file.name,
        "content": content,
    }
