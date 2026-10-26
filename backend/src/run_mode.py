"""
Run mode resolution for PrismIQ execution.
Decouples execution mode decisions from workflow string expressions and provides strict validation.
"""
import os
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def resolve_run_mode(
    event_name: str,
    inputs: Optional[Dict[str, Any]] = None,
    env: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Resolve pipeline execution mode, scoping, and database target based on trigger event.

    Rules:
    1. schedule:
       - Live database writes: ON (ALLOW_LIVE_WRITE="true", DRY_RUN=False)
       - Scope: "scheduled" (queries scheduled_tenants whitelist)
       - Database URL: Production SUPABASE_DB_URL (fails if empty)
    2. workflow_dispatch with dry_run=True:
       - Live database writes: OFF (ALLOW_LIVE_WRITE="false", DRY_RUN=True)
       - Database URL: Strictly SUPABASE_READONLY_DB_URL. Fails immediately if empty/missing.
         Production SUPABASE_DB_URL is NEVER used or exported.
       - Scope: inputs.scope (defaults to "owner")
    3. workflow_dispatch with dry_run=False:
       - Live database writes: ON (ALLOW_LIVE_WRITE="true", DRY_RUN=False)
       - Database URL: Production SUPABASE_DB_URL (fails if empty)
       - Scope: inputs.scope (defaults to "owner")
    4. Unknown event_name:
       - Fails loudly with ValueError.
    """
    inputs = inputs or {}
    env = env or dict(os.environ)

    event_name = (event_name or "").strip().lower()

    if event_name == "schedule":
        prod_url = env.get("SUPABASE_DB_URL", "").strip()
        if not prod_url:
            raise ValueError("FATAL: SUPABASE_DB_URL is missing or empty for scheduled run.")
        return {
            "trigger_mode": "scheduled",
            "scope": "scheduled",
            "dry_run": False,
            "allow_live_write": True,
            "db_url": prod_url,
        }

    if event_name == "workflow_dispatch":
        raw_dry = inputs.get("dry_run")
        if isinstance(raw_dry, str):
            is_dry = raw_dry.strip().lower() in ("true", "1", "yes")
        else:
            is_dry = bool(raw_dry)

        scope = (inputs.get("scope") or "owner").strip().lower()
        if scope == "all":
            logger.warning("Scope 'all' is deprecated and risks 26-tenant timeout; automatically remapping to 'scheduled'.")
            scope = "scheduled"
        if scope not in ("owner", "scheduled"):
            raise ValueError(f"Invalid scope '{scope}'. Must be 'owner' or 'scheduled'.")

        if is_dry:
            ro_url = env.get("SUPABASE_READONLY_DB_URL", "").strip()
            if not ro_url:
                raise ValueError("FATAL: SUPABASE_READONLY_DB_URL is required for dry-run mode but is missing or empty.")
            return {
                "trigger_mode": "manual",
                "scope": scope,
                "dry_run": True,
                "allow_live_write": False,
                "db_url": ro_url,
            }
        else:
            prod_url = env.get("SUPABASE_DB_URL", "").strip()
            if not prod_url:
                raise ValueError("FATAL: SUPABASE_DB_URL is missing or empty for live dispatch run.")
            return {
                "trigger_mode": "manual",
                "scope": scope,
                "dry_run": False,
                "allow_live_write": True,
                "db_url": prod_url,
            }

    raise ValueError(f"FATAL: Unsupported pipeline execution event '{event_name}'. Supported events: 'schedule', 'workflow_dispatch'.")
