import os
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

TARGET_COMPANY: str = os.getenv("TARGET_COMPANY", "Vercel").strip()

_raw_competitors: str = os.getenv(
    "COMPETITORS", "Netlify,Cloudflare Pages,Cloudflare Workers"
)
COMPETITORS: list[str] = [c.strip() for c in _raw_competitors.split(",") if c.strip()]

_raw_sources: str = os.getenv("SOURCES", "news,github")
SOURCES: list[str] = [s.strip() for s in _raw_sources.split(",") if s.strip()]
