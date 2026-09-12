import os
import re
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from src import config, discovery_agent, storage

app = FastAPI(
    title="PrismIQ API",
    description="Multi-tenant competitive intelligence API serving markdown briefs, findings, and discovery onboarding under Row Level Security (RLS).",
    version="2.0.0",
)

# Restricted CORS configuration locking access to production Vercel frontend and local dev
ALLOWED_ORIGINS = [
    "https://prism-iq-red.vercel.app",
    "https://prism-iq-git-main-preeti21.vercel.app",
    "https://prism-iq-preeti21.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ============================================================================
# Pydantic Schemas
# ============================================================================

class OnboardDiscoverRequest(BaseModel):
    target_company: str = Field(..., min_length=1, description="Target company to run competitor discovery for")


class OnboardConfirmRequest(BaseModel):
    target_company: str = Field(..., min_length=1, description="Target company being confirmed")
    confirmed_competitors: List[str] = Field(default_factory=list, description="List of confirmed competitor company names")


class CreateResearchTopicRequest(BaseModel):
    topic_label: str = Field(..., min_length=1, description="Topic label to monitor")
    keywords: List[str] = Field(default_factory=list, description="Keywords or embedding terms for topic")


class UpdateTopicStatusRequest(BaseModel):
    is_active: bool = Field(..., description="Active status for topic (false = paused)")


class AddTrackedCompanyRequest(BaseModel):
    company_name: str = Field(..., min_length=1, description="Company name to track")
    is_target: bool = Field(False, description="Whether this company is the primary target company")


class SaveDeliveryConfigRequest(BaseModel):
    slack_webhook_url: str = Field(..., description="Incoming Slack webhook URL")
    channel_name: str = Field("#competitive-intelligence", description="Slack channel name")
    is_active: bool = Field(True, description="Whether Slack alerts are actively enabled")


# ============================================================================
# JWT Authentication & Verification Dependency
# ============================================================================

def verify_jwt_token(token: str) -> Dict[str, Any]:
    """
    Validate and decode incoming Supabase / Auth JWT token.
    1. Rejects malformed or non-JWT strings with 401.
    2. Enforces expiration (exp claim).
    3. Enforces valid UUID subject (sub claim) corresponding to auth.uid().
    4. If SUPABASE_JWT_SECRET is configured, verifies HMAC-SHA256 signature.
    """
    if not token or not isinstance(token, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or empty authorization token",
        )

    jwt_secret = os.getenv("SUPABASE_JWT_SECRET")

    try:
        if jwt_secret:
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256", "RS256"],
                options={"verify_signature": True, "verify_exp": True, "verify_aud": False},
            )
        else:
            # Decode without secret for testing/environments where secret is managed by Supabase API gateway
            payload = jwt.decode(
                token,
                options={"verify_signature": False, "verify_exp": True},
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or tampered token",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification error: {str(e)}",
        )

    # Validate subject UUID
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject ('sub') claim",
        )

    try:
        uuid.UUID(str(sub))
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token subject ('sub') is not a valid UUID",
        )

    return payload


def get_current_tenant(authorization: Optional[str] = Header(None)) -> str:
    """
    FastAPI dependency extracting and verifying the authenticated tenant UUID.
    Rejects missing, malformed, or unauthenticated requests with HTTP 401.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    parts = authorization.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'",
        )

    token = parts[1]
    payload = verify_jwt_token(token)
    return str(payload["sub"])


# ============================================================================
# Helper Functions
# ============================================================================

def _get_data_dir() -> Path:
    """
    Get the active data directory.
    1. Checks DATA_DIR env override.
    2. Falls back to backend/published_briefs if it exists.
    3. Defaults to backend/data.
    """
    backend_root = Path(__file__).resolve().parent.parent
    env_dir = os.getenv("DATA_DIR")

    if env_dir:
        clean_env = env_dir.split(" ")[0].strip()
        if clean_env:
            p = Path(clean_env)
            if p.is_absolute() and p.exists():
                return p
            resolved = backend_root / p
            if resolved.exists():
                return resolved
            cwd_resolved = Path.cwd() / p
            if cwd_resolved.exists():
                return cwd_resolved

    published_dir = backend_root / "published_briefs"
    if published_dir.exists() and any(published_dir.glob("*.md")):
        return published_dir

    cwd_published = Path.cwd() / "published_briefs"
    if cwd_published.exists() and any(cwd_published.glob("*.md")):
        return cwd_published

    return backend_root / "data"


def _extract_preview(content: str) -> Optional[str]:
    """Extract a concise preview headline from Top 3 decisions section."""
    if not content:
        return None

    match = re.search(r"(?:^|\n)1\.\s+\*\*([^*]+)\*\*\s*\(([^)]+)\)", content)
    if match:
        company = match.group(1).strip()
        title = match.group(2).strip()
        return f"{company}: {title}"

    match_fallback = re.search(r"(?:^|\n)1\.\s+([^\n]+)", content)
    if match_fallback:
        return match_fallback.group(1).strip()[:140]

    return None


def _parse_date(filename: str, file_path: Path) -> str:
    """Derive an ISO formatted UTC date string from brief filename or file mtime."""
    m = re.match(r"brief_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.md$", filename)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}T{m.group(4)}:{m.group(5)}:{m.group(6)}Z"

    m_date = re.match(r"brief_(\d{4}-\d{2}-\d{2})\.md$", filename)
    if m_date:
        return f"{m_date.group(1)}T00:00:00Z"

    try:
        mtime = file_path.stat().st_mtime
        return datetime.fromtimestamp(mtime, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _get_brief_id(filename: str) -> str:
    """Extract a clean identifier from a filename."""
    if filename == "brief.md":
        return "latest"
    m = re.match(r"brief_(.+)\.md$", filename)
    if m:
        return m.group(1)
    return filename.replace(".md", "")


# ============================================================================
# Public Endpoints
# ============================================================================

@app.get("/")
@app.get("/health")
def health_check() -> Dict[str, str]:
    """Root public health check endpoint for monitoring and uptime verification."""
    return {"status": "ok", "service": "PrismIQ Competitive Intelligence API"}


def _is_db_active() -> bool:
    """Check if primary PostgreSQL database is configured and active."""
    return bool(storage.get_db_url()) and (not storage.is_test_environment() or bool(os.getenv("TEST_DATABASE_URL")))


# ============================================================================
# Authenticated Multi-Tenant Endpoints (Enforced by PostgreSQL RLS)
# ============================================================================

@app.get("/briefs")
def list_briefs(tenant_id: str = Depends(get_current_tenant)) -> Dict[str, List[Dict[str, Any]]]:
    """
    List all available competitive briefs visible to the authenticated tenant.
    Executes under PostgreSQL RLS context (SET LOCAL "request.jwt.claim.sub" = tenant_id).
    """
    if _is_db_active():
        try:
            with storage.get_tenant_db_cursor(tenant_id) as cur:
                cur.execute("""
                    SELECT id, title, published_at, headline_preview, content
                    FROM briefs
                    ORDER BY published_at DESC NULLS LAST;
                """)
                rows = cur.fetchall()
                brief_entries = []
                for r in rows:
                    bid = str(r[0])
                    title = r[1] or "PrismIQ Competitive Intelligence Brief"
                    pub_dt = r[2]
                    date_str = pub_dt.isoformat() if pub_dt else datetime.now(timezone.utc).isoformat()
                    preview = r[3] or _extract_preview(r[4] or "")
                    brief_entries.append({
                        "id": bid,
                        "date": date_str,
                        "title": title,
                        "filename": f"brief_{bid}.md",
                        "preview": preview,
                    })
                return {"briefs": brief_entries}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database query error: {e}")

    # Fallback to local files in offline / DB-less test mode
    data_dir = _get_data_dir()
    if not data_dir.exists():
        return {"briefs": []}

    brief_entries: List[Dict[str, Any]] = []
    timestamped_files = sorted(data_dir.glob("brief_*.md"), reverse=True)
    for file_path in timestamped_files:
        filename = file_path.name
        bid = _get_brief_id(filename)
        date_str = _parse_date(filename, file_path)
        try:
            content = file_path.read_text(encoding="utf-8")
        except Exception:
            content = ""

        preview = _extract_preview(content)
        brief_entries.append({
            "id": bid,
            "date": date_str,
            "filename": filename,
            "preview": preview,
        })

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

    brief_entries.sort(key=lambda x: x["date"], reverse=True)
    return {"briefs": brief_entries}


@app.get("/briefs/latest")
def get_latest_brief(tenant_id: str = Depends(get_current_tenant)) -> Dict[str, Any]:
    """
    Get the most recent competitive intelligence brief for the authenticated tenant.
    Enforces PostgreSQL RLS so tenant only receives their own latest brief.
    """
    if _is_db_active():
        try:
            with storage.get_tenant_db_cursor(tenant_id) as cur:
                cur.execute("""
                    SELECT id, title, published_at, content
                    FROM briefs
                    ORDER BY (id = 'data_latest') DESC, published_at DESC NULLS LAST
                    LIMIT 1;
                """)
                row = cur.fetchone()
                if row:
                    bid = str(row[0])
                    pub_dt = row[2]
                    date_str = pub_dt.isoformat() if pub_dt else datetime.now(timezone.utc).isoformat()
                    return {
                        "id": bid,
                        "date": date_str,
                        "filename": f"brief_{bid}.md",
                        "content": row[3],
                    }
                raise HTTPException(status_code=404, detail="No competitive briefs available.")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database query error: {e}")

    # Fallback to local files in offline / DB-less test mode
    data_dir = _get_data_dir()
    latest_file = data_dir / "brief.md"
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
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to read brief.")

    date_str = _parse_date(target_file.name, target_file)
    return {
        "id": "latest",
        "date": date_str,
        "filename": target_file.name,
        "content": content,
    }


@app.get("/briefs/{brief_id}")
def get_brief_by_id(brief_id: str, tenant_id: str = Depends(get_current_tenant)) -> Dict[str, Any]:
    """
    Get a specific brief by ID for the authenticated tenant.
    PostgreSQL RLS blocks cross-tenant access and returns 404.
    """
    if brief_id == "latest":
        return get_latest_brief(tenant_id=tenant_id)

    if _is_db_active():
        try:
            with storage.get_tenant_db_cursor(tenant_id) as cur:
                cur.execute("""
                    SELECT id, title, published_at, content
                    FROM briefs
                    WHERE id = %s;
                """, (brief_id,))
                row = cur.fetchone()
                if row:
                    bid = str(row[0])
                    pub_dt = row[2]
                    date_str = pub_dt.isoformat() if pub_dt else datetime.now(timezone.utc).isoformat()
                    return {
                        "id": bid,
                        "date": date_str,
                        "filename": f"brief_{bid}.md",
                        "content": row[3],
                    }
                # RLS filtered row or row does not exist -> strictly return 404 Not Found
                raise HTTPException(status_code=404, detail=f"Brief '{brief_id}' not found.")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database query error: {e}")

    # Fallback to local files in offline / DB-less test mode
    data_dir = _get_data_dir()
    if not data_dir.exists():
        raise HTTPException(status_code=404, detail=f"Brief '{brief_id}' not found.")

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
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to read brief.")

    date_str = _parse_date(target_file.name, target_file)
    return {
        "id": _get_brief_id(target_file.name),
        "date": date_str,
        "filename": target_file.name,
        "content": content,
    }


@app.get("/findings")
def list_findings(tenant_id: str = Depends(get_current_tenant)) -> Dict[str, Any]:
    """
    List all strategic findings visible to the authenticated tenant under RLS.
    """
    try:
        with storage.get_tenant_db_cursor(tenant_id) as cur:
            cur.execute("""
                SELECT f.id, f.event_id, f.company_name, f.tier, f.confidence,
                       f.inference_confidence, ce.fact_confidence, f.why_it_matters, f.created_at
                FROM findings f
                JOIN consolidated_events ce ON f.event_id = ce.event_id
                ORDER BY f.created_at DESC;
            """)
            rows = cur.fetchall()
            findings = []
            for r in rows:
                findings.append({
                    "id": str(r[0]),
                    "event_id": str(r[1]),
                    "company_name": r[2],
                    "tier": r[3],
                    "confidence": r[4],
                    "inference_confidence": r[5],
                    "fact_confidence": r[6],
                    "why_it_matters": r[7],
                    "created_at": r[8].isoformat() if r[8] else None,
                })
            return {"findings": findings, "count": len(findings)}
    except Exception as e:
        if not storage.is_test_environment():
            raise HTTPException(status_code=500, detail=f"Database query error: {e}")
        return {"findings": [], "count": 0}


@app.get("/tracked-companies")
def list_tracked_companies(tenant_id: str = Depends(get_current_tenant)) -> Dict[str, Any]:
    """
    List companies currently tracked by the authenticated tenant under RLS.
    """
    try:
        with storage.get_tenant_db_cursor(tenant_id) as cur:
            cur.execute("""
                SELECT company_name, is_target, status, added_at
                FROM tenant_tracked_companies
                WHERE status = 'active'
                ORDER BY is_target DESC, company_name ASC;
            """)
            rows = cur.fetchall()
            comps = []
            for r in rows:
                comps.append({
                    "company_name": r[0],
                    "is_target": r[1],
                    "status": r[2],
                    "added_at": r[3].isoformat() if r[3] else None,
                })
            return {"tracked_companies": comps, "count": len(comps)}
    except Exception as e:
        if not storage.is_test_environment():
            raise HTTPException(status_code=500, detail=f"Database query error: {e}")
        return {"tracked_companies": [], "count": 0}


@app.post("/workspace/watchlist/add")
def add_tracked_company_endpoint(
    req: AddTrackedCompanyRequest,
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Add or reactivate a competitor to the authenticated tenant's active watchlist.
    """
    comp = req.company_name.strip()
    if not comp:
        raise HTTPException(status_code=400, detail="Company name cannot be empty")

    tracked_entry = storage.track_tenant_company(
        tenant_id=tenant_id,
        company_name=comp,
        is_target=req.is_target,
    )
    return {"status": "tracked", "company": tracked_entry}


@app.delete("/workspace/watchlist/{company_name}")
def untrack_company_endpoint(
    company_name: str,
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Untrack a competitor from the authenticated tenant's active watchlist.
    Preserves signal and finding history under RLS while removing from active views.
    """
    comp = company_name.strip()
    if not comp:
        raise HTTPException(status_code=400, detail="Company name cannot be empty")

    success = storage.untrack_tenant_company(tenant_id=tenant_id, company_name=comp)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Company '{comp}' not found in active watchlist for tenant",
        )
    return {"status": "untracked", "company_name": comp}



@app.get("/signals")
def list_signals(
    company: Optional[str] = Query(None, description="Filter by company name"),
    source: Optional[str] = Query(None, description="Filter by signal source: news, github, jobs, pricing, research"),
    tier: Optional[str] = Query(None, description="Filter by tier: Must-Know, Should-Know, Nice-to-Know"),
    confidence: Optional[str] = Query(None, description="Filter by confidence: High, Medium, Low"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    List individual signals detected for tenant's tracked companies.
    Per spec section 3.3:
    - Primary question: What individual signals were detected?
    - Data source: raw_signals (shared) filtered/joined to findings (per-tenant) for why-it-matters + confidence.
    - Also computes noise-suppressed count for honest disclosure.
    """
    try:
        with storage.get_tenant_db_cursor(tenant_id) as cur:
            if isinstance(cur, storage.MockCursor):
                return {"signals": [], "count": 0, "noise_suppressed_count": 0}

            # Query total noise suppressed count for tenant's tracked companies
            cur.execute("""
                SELECT COUNT(DISTINCT nsd.signal_id)
                FROM noise_suppression_decisions nsd
                JOIN raw_signals rs ON nsd.signal_id = rs.id
                JOIN tenant_tracked_companies ttc ON rs.company_name = ttc.company_name
                WHERE nsd.is_noise = TRUE
                  AND ttc.status = 'active';
            """)
            noise_row = cur.fetchone()
            noise_suppressed_count = noise_row[0] if noise_row else 0

            # Query signals joined with events and tenant findings
            base_query = """
                SELECT DISTINCT ON (rs.id)
                    rs.id,
                    rs.company_name,
                    rs.source,
                    rs.title,
                    rs.url,
                    rs.published_at,
                    rs.published_timestamp,
                    rs.raw_excerpt,
                    ce.event_id,
                    COALESCE(ce.corroboration_count, 1) as corroboration_count,
                    f.why_it_matters,
                    COALESCE(f.confidence, ce.fact_confidence, 'Medium') as confidence,
                    f.inference_confidence,
                    ce.fact_confidence,
                    COALESCE(f.tier, 'Nice-to-Know') as tier
                FROM raw_signals rs
                JOIN tenant_tracked_companies ttc ON rs.company_name = ttc.company_name
                LEFT JOIN event_signals es ON rs.id = es.signal_id
                LEFT JOIN consolidated_events ce ON es.event_id = ce.event_id
                LEFT JOIN findings f ON (ce.event_id = f.event_id AND f.tenant_id = %s::uuid)
                WHERE ttc.status = 'active'
            """
            params: List[Any] = [tenant_id]

            if company:
                base_query += " AND rs.company_name = %s"
                params.append(company)
            if source:
                base_query += " AND LOWER(rs.source) = LOWER(%s)"
                params.append(source)
            if tier:
                base_query += " AND (LOWER(f.tier) = LOWER(%s) OR (f.tier IS NULL AND LOWER(%s) = 'nice-to-know'))"
                params.extend([tier, tier])
            if confidence:
                base_query += " AND (LOWER(f.confidence) = LOWER(%s) OR LOWER(ce.fact_confidence) = LOWER(%s))"
                params.extend([confidence, confidence])

            # Get total count before pagination
            count_query = f"SELECT COUNT(*) FROM ({base_query}) AS count_sub;"
            cur.execute(count_query, params)
            count_row = cur.fetchone()
            total_count = count_row[0] if count_row else 0

            # Order and paginate
            final_query = f"""
                SELECT * FROM ({base_query}) sub
                ORDER BY sub.published_timestamp DESC NULLS LAST, sub.published_at DESC
                LIMIT %s OFFSET %s;
            """
            params.extend([limit, offset])

            cur.execute(final_query, params)
            rows = cur.fetchall()

            signals = []
            for r in rows:
                signals.append({
                    "id": r[0],
                    "company_name": r[1],
                    "source": r[2],
                    "title": r[3],
                    "url": r[4],
                    "published_at": r[5],
                    "published_timestamp": r[6].isoformat() if r[6] else None,
                    "raw_excerpt": r[7],
                    "event_id": r[8],
                    "corroboration_count": r[9],
                    "why_it_matters": r[10],
                    "confidence": r[11],
                    "inference_confidence": r[12],
                    "fact_confidence": r[13],
                    "tier": r[14],
                })

            return {
                "signals": signals,
                "count": total_count,
                "noise_suppressed_count": noise_suppressed_count,
            }
    except Exception as e:
        if not storage.is_test_environment():
            raise HTTPException(status_code=500, detail=f"Database query error: {e}")
        return {"signals": [], "count": 0, "noise_suppressed_count": 0}


@app.get("/events")
def list_events(
    company: Optional[str] = Query(None, description="Filter by company name"),
    tier: Optional[str] = Query(None, description="Filter by tier: Must-Know, Should-Know, Nice-to-Know"),
    confidence: Optional[str] = Query(None, description="Filter by confidence: High, Medium, Low"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    List consolidated real-world events for tenant's tracked companies.
    Per spec section 3.4:
    - Primary question: What real-world events happened, and what's the evidence behind each one?
    - Data source: consolidated_events + event_signals + findings.
    """
    try:
        with storage.get_tenant_db_cursor(tenant_id) as cur:
            if isinstance(cur, storage.MockCursor):
                return {"events": [], "count": 0}

            base_query = """
                SELECT DISTINCT ON (ce.event_id)
                    ce.event_id,
                    ce.company_name,
                    ce.title,
                    ce.event_summary,
                    ce.corroboration_count,
                    ce.contributing_sources,
                    ce.first_detected_at,
                    ce.latest_detected_at,
                    ce.published_at,
                    ce.published_timestamp,
                    ce.url,
                    ce.raw_excerpt,
                    ce.fact_confidence,
                    f.why_it_matters,
                    f.confidence as blended_confidence,
                    f.inference_confidence,
                    COALESCE(f.tier, 'Nice-to-Know') as tier
                FROM consolidated_events ce
                JOIN tenant_tracked_companies ttc ON ce.company_name = ttc.company_name
                LEFT JOIN findings f ON (ce.event_id = f.event_id AND f.tenant_id = %s::uuid)
                WHERE ttc.status = 'active'
            """
            params: List[Any] = [tenant_id]

            if company:
                base_query += " AND ce.company_name = %s"
                params.append(company)
            if tier:
                base_query += " AND (LOWER(f.tier) = LOWER(%s) OR (f.tier IS NULL AND LOWER(%s) = 'nice-to-know'))"
                params.extend([tier, tier])
            if confidence:
                base_query += " AND (LOWER(ce.fact_confidence) = LOWER(%s) OR LOWER(f.confidence) = LOWER(%s))"
                params.extend([confidence, confidence])

            count_query = f"SELECT COUNT(*) FROM ({base_query}) AS count_sub;"
            cur.execute(count_query, params)
            count_row = cur.fetchone()
            total_count = count_row[0] if count_row else 0

            final_query = f"""
                SELECT * FROM ({base_query}) sub
                ORDER BY sub.published_timestamp DESC NULLS LAST, sub.published_at DESC
                LIMIT %s OFFSET %s;
            """
            params.extend([limit, offset])

            cur.execute(final_query, params)
            rows = cur.fetchall()

            events = []
            for r in rows:
                contrib = r[5]
                if isinstance(contrib, str):
                    import json
                    try:
                        contrib = json.loads(contrib)
                    except Exception:
                        contrib = [contrib]

                events.append({
                    "event_id": r[0],
                    "company_name": r[1],
                    "title": r[2],
                    "event_summary": r[3],
                    "corroboration_count": r[4],
                    "contributing_sources": contrib or [],
                    "first_detected_at": r[6],
                    "latest_detected_at": r[7],
                    "published_at": r[8],
                    "published_timestamp": r[9].isoformat() if r[9] else None,
                    "url": r[10],
                    "raw_excerpt": r[11],
                    "fact_confidence": r[12] or "Medium",
                    "why_it_matters": r[13],
                    "confidence": r[14] or r[12] or "Medium",
                    "inference_confidence": r[15],
                    "tier": r[16] or "Nice-to-Know",
                })

            return {"events": events, "count": total_count}
    except Exception as e:
        if not storage.is_test_environment():
            raise HTTPException(status_code=500, detail=f"Database query error: {e}")
        return {"events": [], "count": 0}


@app.get("/events/{event_id}")
def get_event_detail(
    event_id: str,
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Retrieve single consolidated event with its full tree of contributing signals.
    Per spec section 3.4:
    - Visual consolidation tree: root event at top, branching to each contributing signal.
    - Single-signal event: tree renders with one branch.
    """
    try:
        with storage.get_tenant_db_cursor(tenant_id) as cur:
            if isinstance(cur, storage.MockCursor):
                raise HTTPException(status_code=404, detail=f"Event {event_id} not found")

            # Fetch root consolidated event
            cur.execute("""
                SELECT
                    ce.event_id,
                    ce.company_name,
                    ce.title,
                    ce.event_summary,
                    ce.corroboration_count,
                    ce.contributing_sources,
                    ce.first_detected_at,
                    ce.latest_detected_at,
                    ce.published_at,
                    ce.published_timestamp,
                    ce.url,
                    ce.raw_excerpt,
                    ce.fact_confidence,
                    f.why_it_matters,
                    f.confidence as blended_confidence,
                    f.inference_confidence,
                    COALESCE(f.tier, 'Nice-to-Know') as tier
                FROM consolidated_events ce
                JOIN tenant_tracked_companies ttc ON ce.company_name = ttc.company_name
                LEFT JOIN findings f ON (ce.event_id = f.event_id AND f.tenant_id = %s::uuid)
                WHERE ce.event_id = %s
                  AND ttc.status = 'active';
            """, (tenant_id, event_id))
            r = cur.fetchone()
            if not r:
                raise HTTPException(status_code=404, detail=f"Event {event_id} not found")

            contrib = r[5]
            if isinstance(contrib, str):
                import json
                try:
                    contrib = json.loads(contrib)
                except Exception:
                    contrib = [contrib]

            event_obj = {
                "event_id": r[0],
                "company_name": r[1],
                "title": r[2],
                "event_summary": r[3],
                "corroboration_count": r[4],
                "contributing_sources": contrib or [],
                "first_detected_at": r[6],
                "latest_detected_at": r[7],
                "published_at": r[8],
                "published_timestamp": r[9].isoformat() if r[9] else None,
                "url": r[10],
                "raw_excerpt": r[11],
                "fact_confidence": r[12] or "Medium",
                "why_it_matters": r[13],
                "confidence": r[14] or r[12] or "Medium",
                "inference_confidence": r[15],
                "tier": r[16] or "Nice-to-Know",
            }

            # Fetch contributing signals via event_signals join
            cur.execute("""
                SELECT
                    rs.id,
                    rs.source,
                    rs.title,
                    rs.url,
                    rs.published_at,
                    rs.published_timestamp,
                    rs.raw_excerpt
                FROM event_signals es
                JOIN raw_signals rs ON es.signal_id = rs.id
                WHERE es.event_id = %s
                ORDER BY rs.published_timestamp DESC NULLS LAST, rs.published_at DESC;
            """, (event_id,))
            sig_rows = cur.fetchall()

            signals = []
            for s in sig_rows:
                signals.append({
                    "id": s[0],
                    "source": s[1],
                    "title": s[2],
                    "url": s[3],
                    "published_at": s[4],
                    "published_timestamp": s[5].isoformat() if s[5] else None,
                    "raw_excerpt": s[6],
                })

            event_obj["contributing_signals"] = signals
            return {"event": event_obj}
    except HTTPException:
        raise
    except Exception as e:
        if not storage.is_test_environment():
            raise HTTPException(status_code=500, detail=f"Database query error: {e}")
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")


# ============================================================================
# Discovery Agent Onboarding Endpoints
# ============================================================================

@app.post("/api/onboarding/discover")
def onboard_discover_candidates(
    req: OnboardDiscoverRequest,
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Run Discovery Agent to propose grounded candidate competitors for a target company.
    STRICT INVARIANT (Part 2.6): Saves discovery proposal under tenant_id, but NEVER
    writes to tenant_tracked_companies without explicit tenant confirmation.
    """
    target = req.target_company.strip()
    if not target:
        raise HTTPException(status_code=400, detail="Target company name cannot be empty")

    candidates = discovery_agent.run(target, tenant_id=tenant_id)
    return {
        "status": "proposed",
        "tenant_id": tenant_id,
        "target_company": target,
        "candidates_count": len(candidates),
        "candidates": candidates,
    }


@app.post("/api/onboarding/confirm")
def onboard_confirm_candidates(
    req: OnboardConfirmRequest,
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Confirm and write human-reviewed competitor selections into tenant_tracked_companies.
    Writes target company (is_target=True) and confirmed competitors (is_target=False).
    """
    target = req.target_company.strip()
    if not target:
        raise HTTPException(status_code=400, detail="Target company name cannot be empty")

    tracked = storage.save_tenant_confirmed_companies(
        tenant_id=tenant_id,
        target_company=target,
        confirmed_competitors=req.confirmed_competitors,
    )

    return {
        "status": "confirmed",
        "tenant_id": tenant_id,
        "target_company": target,
        "tracked_companies": tracked,
    }


# ============================================================================
# Field Research Radar Endpoints (Stage 3/4)
# ============================================================================

@app.get("/research-radar/topics")
def list_research_topics(
    include_paused: bool = Query(False, description="Whether to include paused research topics"),
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """List configured research topics for the authenticated tenant under RLS."""
    topics = storage.get_tenant_research_topics(tenant_id, include_paused=include_paused)
    return {"topics": topics, "count": len(topics)}


@app.post("/research-radar/topics")
def create_research_topic(
    req: CreateResearchTopicRequest,
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Configure a new research topic for the tenant.
    Stage 1: Manual entry only.
    """
    clean_label = req.topic_label.strip()
    if not clean_label:
        raise HTTPException(status_code=400, detail="Topic label cannot be empty")
    topic = storage.save_tenant_research_topic(
        tenant_id=tenant_id,
        topic_label=clean_label,
        keywords=req.keywords,
        source="manual",
    )
    return {"status": "created", "topic": topic}


@app.patch("/research-radar/topics/{topic_id}")
def update_research_topic_status(
    topic_id: str,
    req: UpdateTopicStatusRequest,
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Pause or resume a research topic under RLS.
    Preserves historical evaluation records in research_radar_evaluations per spec § 3.11.
    """
    success = storage.update_tenant_research_topic_status(
        tenant_id=tenant_id,
        topic_id_or_label=topic_id,
        is_active=req.is_active,
    )
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Topic '{topic_id}' not found for authenticated tenant",
        )
    return {
        "status": "updated",
        "topic_id": topic_id,
        "is_active": req.is_active,
    }


@app.delete("/research-radar/topics/{topic_id}")
def delete_research_topic(
    topic_id: str,
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """Delete or deactivate a configured research topic."""
    success = storage.delete_tenant_research_topic(tenant_id, topic_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Topic '{topic_id}' not found or already deleted")
    return {"status": "deleted", "topic_id": topic_id}


@app.get("/research-radar/history")
def get_radar_history_endpoint(
    topic_label: Optional[str] = None,
    competitor: Optional[str] = None,
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Query historical radar evaluation records for the authenticated tenant.
    Filterable by topic_label and competitor.
    """
    history = storage.get_radar_history(tenant_id, topic_label=topic_label, competitor=competitor)
    return {"history": history, "count": len(history)}


@app.get("/research-radar/latest")
def get_latest_radar_endpoint(
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Fetch the latest radar evaluation snapshot across active topics for the authenticated tenant.
    """
    from src import research_radar
    topics = storage.get_tenant_research_topics(tenant_id)
    if not topics:
        return {"evaluations": [], "count": 0}

    evals = []
    for top in topics:
        lbl = top.get("topic_label", "")
        prior = storage.get_prior_radar_evaluation(tenant_id, lbl)
        if prior:
            evals.append(prior)
        else:
            topic_items = storage.get_research_items_for_topics([lbl])
            competitors = list(config.COMPETITORS)
            ev = research_radar.evaluate_topic_radar(
                topic=top,
                research_items=topic_items,
                competitors=competitors,
                pipeline_signals=[],
                tenant_id=tenant_id,
            )
            evals.append(ev)

    return {"evaluations": evals, "count": len(evals)}


# ============================================================================
# Workspace Endpoints (Spec § 3.11)
# ============================================================================

@app.get("/workspace/delivery")
def get_delivery_config_endpoint(
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Retrieve delivery alert configuration for the authenticated tenant under RLS.
    """
    cfg = storage.get_tenant_delivery_config(tenant_id)
    return {"delivery_config": cfg}


@app.post("/workspace/delivery")
def save_delivery_config_endpoint(
    req: SaveDeliveryConfigRequest,
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Configure or update Slack webhook alert channel for the tenant under RLS.
    """
    webhook = req.slack_webhook_url.strip()
    if not webhook:
        raise HTTPException(status_code=400, detail="Slack webhook URL cannot be empty")
    if not webhook.startswith("https://hooks.slack.com/"):
        raise HTTPException(
            status_code=400,
            detail="Invalid Slack webhook URL format. Must start with https://hooks.slack.com/",
        )

    saved = storage.save_tenant_delivery_config(
        tenant_id=tenant_id,
        slack_webhook_url=webhook,
        channel_name=req.channel_name.strip() or "#competitive-intelligence",
        is_active=req.is_active,
    )
    return {"status": "saved", "delivery_config": saved}


@app.get("/workspace/settings")
def get_workspace_settings_endpoint(
    tenant_id: str = Depends(get_current_tenant),
) -> Dict[str, Any]:
    """
    Retrieve tenant-level settings and status metadata under RLS.
    All counts and metrics are calculated directly from PostgreSQL.
    """
    with storage.get_tenant_db_cursor(tenant_id) as cur:
        cur.execute("SELECT COUNT(*) FROM tenant_tracked_companies WHERE status = 'active';")
        tracked_count = cur.fetchone()[0]

    topics = storage.get_tenant_research_topics(tenant_id, include_paused=True)
    active_topics = [t for t in topics if t.get("is_active", True)]
    paused_topics = [t for t in topics if not t.get("is_active", True)]

    # Real signal and noise suppression metrics from PostgreSQL
    total_signals_evaluated = 0
    noise_suppressed_count = 0
    try:
        with storage.get_db_cursor() as cur:
            cur.execute("SELECT COUNT(*), COUNT(*) FILTER (WHERE is_noise = true) FROM noise_suppression_decisions;")
            row = cur.fetchone()
            if row:
                total_signals_evaluated = row[0]
                noise_suppressed_count = row[1]
    except Exception:
        pass

    return {
        "tenant_id": tenant_id,
        "workspace_name": "PrismIQ Production Intelligence",
        "owner_email": "preetiantil006@gmail.com",
        "auth_role": "authenticated",
        "rls_enforcement": "Active (PostgreSQL Row-Level Security)",
        "tracked_companies_count": tracked_count,
        "active_topics_count": len(active_topics),
        "paused_topics_count": len(paused_topics),
        "total_signals_evaluated": total_signals_evaluated,
        "noise_suppressed_count": noise_suppressed_count,
        "cadence": config.SCHEDULE_CADENCE_NAME,
        "schedule": config.DEFAULT_CRON_SCHEDULE,
        "api_version": app.version,
        "api_status": "Online",
    }

