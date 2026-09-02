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

# Autonomous Scheduling Configuration
DEFAULT_CRON_SCHEDULE: str = os.getenv("PIPELINE_CRON_SCHEDULE", "0 0 * * 0").strip()  # Weekly on Sunday 00:00 UTC
SCHEDULE_CADENCE_NAME: str = os.getenv("PIPELINE_CADENCE_NAME", "weekly").strip()
PIPELINE_LOCK_KEY: int = int(os.getenv("PIPELINE_LOCK_KEY", "74829103"))  # 64-bit PostgreSQL advisory lock ID
TRIGGER_MODE: str = os.getenv("PIPELINE_TRIGGER_MODE", "manual").strip()

# LangSmith Observability & Tracing Configuration
LANGCHAIN_TRACING_V2: bool = os.getenv("LANGCHAIN_TRACING_V2", "false").lower() in ("true", "1", "yes")
LANGCHAIN_PROJECT: str = os.getenv("LANGCHAIN_PROJECT", "prismiq-production").strip()
LANGCHAIN_API_KEY: str = os.getenv("LANGCHAIN_API_KEY", "").strip()
LANGCHAIN_ENDPOINT: str = os.getenv("LANGCHAIN_ENDPOINT", "https://api.smith.langchain.com").strip()

if LANGCHAIN_TRACING_V2 and LANGCHAIN_API_KEY:
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_PROJECT"] = LANGCHAIN_PROJECT
    os.environ["LANGCHAIN_API_KEY"] = LANGCHAIN_API_KEY
    os.environ["LANGCHAIN_ENDPOINT"] = LANGCHAIN_ENDPOINT
