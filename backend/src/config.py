import os
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

TARGET_COMPANY: str = os.getenv("TARGET_COMPANY", "Vercel").strip()

_raw_competitors: str = os.getenv(
    "COMPETITORS", "Netlify,Cloudflare Pages/Workers"
)
COMPETITORS: list[str] = [c.strip() for c in _raw_competitors.split(",") if c.strip()]

_raw_sources: str = os.getenv("SOURCES", "news,github,jobs,pricing")
SOURCES: list[str] = [s.strip() for s in _raw_sources.split(",") if s.strip()]

# Autonomous Scheduling Configuration (Render Cron Job)
DEFAULT_CRON_SCHEDULE: str = os.getenv("PIPELINE_CRON_SCHEDULE", "0 0 * * 0").strip()  # Weekly on Sunday 00:00 UTC
SCHEDULE_CADENCE_NAME: str = os.getenv("PIPELINE_CADENCE_NAME", "weekly").strip()
PIPELINE_LOCK_KEY: int = int(os.getenv("PIPELINE_LOCK_KEY", "74829103"))  # 64-bit PostgreSQL advisory lock ID
TRIGGER_MODE: str = os.getenv("PIPELINE_TRIGGER_MODE", "manual").strip()
