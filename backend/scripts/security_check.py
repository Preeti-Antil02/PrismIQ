"""
PrismIQ Pre-Merge & Pull Request Security Verification CLI.

Enforces:
1. Secret & Credential Leak Detection (API keys, DB connection strings, Slack webhooks, tracked .env files).
2. Database Isolation Guard (preventing test runs or scripts from accessing/mutating production DB).
3. AST & Pattern Static Analysis for unisolated database write calls.
4. Security & Tenant Isolation Pytest Suite execution (fail-closed tenant boundaries).

Usage:
    python backend/scripts/security_check.py [--skip-tests] [--strict]
"""

import os
import re
import sys
import subprocess
from pathlib import Path
from typing import List, Tuple

# Reconfigure stdout for utf-8 on Windows
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
backend_dir = REPO_ROOT / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Regex patterns for secret detection
SECRET_PATTERNS = [
    (r"gsk_[A-Za-z0-9_-]{24,}", "Groq API Key"),
    (r"sbp_[a-f0-9]{40}", "Supabase Service/Access Token"),
    (r"xox[baprs]-[0-9a-zA-Z-]{24,}", "Slack Token"),
    (r"https://hooks\.slack\.com/services/T[0-9A-Za-z]+/B[0-9A-Za-z]+/[0-9A-Za-z]+", "Live Slack Webhook URL"),
    (r"ghp_[0-9a-zA-Z]{36}", "GitHub Personal Access Token"),
    (r"glpat-[0-9a-zA-Z_-]{20,}", "GitLab Personal Access Token"),
    (r"postgres(?:ql)?://([a-zA-Z0-9_\.-]+):([a-zA-Z0-9_\.\#\$\%\^\&\*\!\?\-]+)@[a-zA-Z0-9\.-]+:\d+/[a-zA-Z0-9_-]+", "Hardcoded PostgreSQL Connection String with Password"),
]

# Files/extensions to ignore during secret scan
IGNORED_PATHS = [
    ".git",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
    ".next",
    "venv",
    ".venv",
    ".env.example",
    "pytest_raw_output.txt",
    "branch.patch",
    "workflow.diff",
]


def log_header(title: str):
    print(f"\n{'='*70}\n[SECURITY CHECK] {title}\n{'='*70}")


def check_tracked_env_files() -> List[str]:
    """Check git index to ensure no active .env credential files are tracked."""
    print("Checking for tracked .env files in Git index...")
    issues = []
    try:
        res = subprocess.run(
            ["git", "ls-files", "*.env", "**/*.env"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
            check=True,
        )
        tracked = [line.strip() for line in res.stdout.strip().splitlines() if line.strip()]
        for f in tracked:
            if not f.endswith(".example") and not f.endswith(".sample"):
                issues.append(f"Tracked environment secret file in git index: {f}")
    except Exception as e:
        print(f"[WARN] Unable to inspect git ls-files: {e}")
    return issues


def check_local_env_files_for_db_url() -> List[str]:
    """Ensure SUPABASE_DB_URL never appears in any local .env file (Rule R1 compliance)."""
    print("Checking local environment files for forbidden SUPABASE_DB_URL (Rule R1)...")
    issues = []
    # Search all .env files in repository workspace
    env_files = list(REPO_ROOT.glob("**/.env*"))
    for ef in env_files:
        # Ignore template/example files
        if ef.name.endswith(".example") or ef.name.endswith(".sample"):
            continue
        try:
            content = ef.read_text(encoding="utf-8", errors="ignore")
            for line_idx, line in enumerate(content.splitlines(), start=1):
                clean = line.strip()
                if clean.startswith("#"):
                    continue
                if re.search(r"^\s*SUPABASE_DB_URL\s*=", line):
                    rel = ef.relative_to(REPO_ROOT)
                    issues.append(
                        f"CRITICAL R1 VIOLATION: Forbidden production write variable SUPABASE_DB_URL found in local file {rel}:{line_idx}. "
                        "Local files must NEVER contain production write credentials."
                    )
        except Exception as e:
            print(f"[WARN] Unable to read {ef}: {e}")
    return issues


def scan_file_for_secrets(file_path: Path) -> List[Tuple[int, str, str]]:
    """Scan a single file for known secret patterns."""
    findings = []
    is_test_file = "tests" in file_path.parts or file_path.name.startswith("test_")
    try:
        text = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return findings

    for line_idx, line in enumerate(text.splitlines(), start=1):
        # Ignore comments or mock values in test files
        line_clean = line.strip()
        if is_test_file:
            line_lower = line_clean.lower()
            if any(dummy in line_lower for dummy in [
                "t00/b00/", "test_key", "dummy", "example", "placeholder",
                "localhost:5432", "mock", "test", "prismiq_readonly",
                "fake_prod", "postgres:secret", "postgres:prod", "badpass", "baduser", "127.0.0.1",
            ]):
                continue

        for pattern, label in SECRET_PATTERNS:
            if re.search(pattern, line_clean):
                findings.append((line_idx, label, line_clean[:100]))
    return findings


def check_secrets_in_workspace() -> List[str]:
    """Scan code files in backend/ and .github/ for credential leaks."""
    print("Scanning codebase for hardcoded secrets, connection strings, and API keys...")
    issues = []
    scan_dirs = [REPO_ROOT / "backend", REPO_ROOT / ".github"]
    
    for base in scan_dirs:
        if not base.exists():
            continue
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in IGNORED_PATHS]
            for file in files:
                fpath = Path(root) / file
                if any(ign in str(fpath) for ign in IGNORED_PATHS):
                    continue
                if fpath.suffix in [".py", ".yml", ".yaml", ".json", ".sql", ".sh"]:
                    findings = scan_file_for_secrets(fpath)
                    for line_no, label, snippet in findings:
                        rel = fpath.relative_to(REPO_ROOT)
                        issues.append(f"{rel}:{line_no} - {label} detected: `{snippet}`")
    return issues


def check_database_isolation() -> List[str]:
    """Verify that CI and pre-merge environments enforce strict DB isolation."""
    print("Verifying database isolation controls and environment safeguards...")
    issues = []
    
    # Check 1: ALLOW_LIVE_WRITE must not be active
    if os.environ.get("ALLOW_LIVE_WRITE", "").lower() == "true":
        issues.append("ALLOW_LIVE_WRITE is enabled in current execution environment. Pre-merge checks must run isolated.")

    # Check 2: workflow file validation
    wf_path = REPO_ROOT / ".github" / "workflows" / "daily-pipeline.yml"
    if wf_path.exists():
        content = wf_path.read_text(encoding="utf-8")
        if "SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}" in content:
            # Check if it is isolated inside conditional live step
            dry_step_match = re.search(r"name:\s*Run LangGraph Pipeline \(Dry-Run Simulation\)[\s\S]*?run:", content)
            if dry_step_match and "SUPABASE_DB_URL" in dry_step_match.group(0):
                issues.append("Security regression: SUPABASE_DB_URL is exported to Dry-Run step in daily-pipeline.yml!")

    # Check 3: run_mode.py fail-closed assertions
    try:
        from src.run_mode import resolve_run_mode
        # Test 1: Missing dry_run secret must fail closed
        try:
            resolve_run_mode("workflow_dispatch", inputs={"dry_run": True}, env={})
            issues.append("FAIL-OPEN BUG: resolve_run_mode did not raise ValueError when SUPABASE_READONLY_DB_URL is missing.")
        except ValueError:
            pass # correctly failed closed

        # Test 2: Missing live secret must fail closed
        try:
            resolve_run_mode("schedule", env={})
            issues.append("FAIL-OPEN BUG: resolve_run_mode did not raise ValueError when SUPABASE_DB_URL is missing.")
        except ValueError:
            pass # correctly failed closed
    except Exception as e:
        issues.append(f"Could not validate src.run_mode: {e}")

    return issues


def check_migration_safety() -> List[str]:
    """Verify that SQL migrations do not contain uncommented destructive statements."""
    print("Verifying migration file safety (no live DROP ROLE/TABLE/OWNED or TRUNCATE)...")
    issues = []
    migrations_dir = REPO_ROOT / "backend" / "migrations"
    if not migrations_dir.exists():
        return issues

    destructive_pattern = re.compile(
        r"^\s*(DROP\s+ROLE|DROP\s+TABLE|DROP\s+OWNED|TRUNCATE)\b",
        re.IGNORECASE
    )

    for sql_file in migrations_dir.glob("*.sql"):
        try:
            lines = sql_file.read_text(encoding="utf-8").splitlines()
        except Exception:
            continue
        for idx, line in enumerate(lines, start=1):
            stripped = line.strip()
            # If line is commented out with '--', it's safe (e.g. inside documented ROLLBACK block)
            if stripped.startswith("--") or stripped.startswith("/*") or not stripped:
                continue
            if destructive_pattern.search(stripped):
                rel = sql_file.relative_to(REPO_ROOT)
                issues.append(
                    f"{rel}:{idx} - Live destructive SQL statement found outside comment block: `{stripped}`"
                )
    return issues


def run_isolation_tests() -> bool:
    """Run security and multitenancy isolation pytest suite."""
    print("Executing security and tenant isolation test suite (pytest)...")
    test_files = [
        "backend/tests/test_delivery_isolation.py",
        "backend/tests/test_multitenancy.py",
        "backend/tests/test_run_mode.py",
        "backend/tests/test_startup_check.py",
        "backend/tests/test_storage.py",
    ]
    
    cmd = [sys.executable, "-m", "pytest"] + test_files + ["-v", "-m", "not integration"]
    res = subprocess.run(cmd, cwd=str(REPO_ROOT))
    return res.returncode == 0


def check_unmasked_postgres_urls() -> List[str]:
    """Scan all files across repo and scratch/ for unmasked PostgreSQL URLs with passwords."""
    print("Verifying absence of unmasked PostgreSQL connection strings across repo and scratch/...")
    issues = []
    scan_dirs = [REPO_ROOT / "backend", REPO_ROOT / ".github", REPO_ROOT / "docs", REPO_ROOT / "scratch"]
    pattern = re.compile(r"postgres(?:ql)?://([^:\s]+):([^@\s]+)@[^/\s:]+", re.IGNORECASE)
    
    for base in scan_dirs:
        if not base.exists():
            continue
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in IGNORED_PATHS]
            for file in files:
                fpath = Path(root) / file
                if any(ign in str(fpath) for ign in IGNORED_PATHS):
                    continue
                if fpath.suffix in [".py", ".yml", ".yaml", ".json", ".sql", ".sh", ".md", ".diff", ".patch"]:
                    is_test_file = "tests" in fpath.parts or fpath.name.startswith("test_")
                    try:
                        text = fpath.read_text(encoding="utf-8", errors="ignore")
                    except Exception:
                        continue
                    for idx, line in enumerate(text.splitlines(), start=1):
                        m = pattern.search(line)
                        if m:
                            user = m.group(1).lower()
                            pwd = m.group(2).lower()
                            # Allow safe placeholders/dummies in tests or documentation
                            if any(dummy in (user + ":" + pwd) for dummy in [
                                "****", "[password]", "[readonly_password]", "xxx", "placeholder", "dummy"
                            ]):
                                continue
                            if is_test_file and any(dummy in (user + ":" + pwd) for dummy in [
                                "fake", "mock", "secret", "badpass", "baduser", "postgres:prod", "test:test", "prismiq_readonly"
                            ]):
                                continue
                            rel = fpath.relative_to(REPO_ROOT)
                            masked_user = user[:6] + "..." if len(user) > 6 else user
                            issues.append(f"{rel}:{idx} - Unmasked PostgreSQL URL with password detected: postgresql://{masked_user}:****@...")
    return issues


def main() -> int:
    log_header("PrismIQ Pre-Merge Security & Isolation Verification")
    
    all_failures = []
    
    # 1. Tracked .env files
    env_issues = check_tracked_env_files()
    if env_issues:
        all_failures.extend(env_issues)
        print(f" [FAIL] {len(env_issues)} tracked environment file issue(s) found.")
    else:
        print(" [PASS] No active .env files tracked in Git index.")

    # 1b. Check local environment files for SUPABASE_DB_URL (Rule R1)
    local_env_issues = check_local_env_files_for_db_url()
    if local_env_issues:
        all_failures.extend(local_env_issues)
        print(f" [FAIL] {len(local_env_issues)} local env file R1 issue(s) found.")
    else:
        print(" [PASS] No forbidden SUPABASE_DB_URL found in local .env files.")

    # 1c. Check migration files for uncommented destructive SQL
    mig_issues = check_migration_safety()
    if mig_issues:
        all_failures.extend(mig_issues)
        print(f" [FAIL] {len(mig_issues)} migration safety issue(s) found.")
    else:
        print(" [PASS] All migration files free of live destructive statements.")

    # 1d. Check for unmasked PostgreSQL URLs across repo and scratch/
    unmasked_url_issues = check_unmasked_postgres_urls()
    if unmasked_url_issues:
        all_failures.extend(unmasked_url_issues)
        print(f" [FAIL] {len(unmasked_url_issues)} unmasked PostgreSQL URL issue(s) found.")
    else:
        print(" [PASS] Zero unmasked PostgreSQL URLs found across codebase and scratch/.")

    # 2. Hardcoded Secrets Scan
    secret_issues = check_secrets_in_workspace()
    if secret_issues:
        all_failures.extend(secret_issues)
        print(f" [FAIL] {len(secret_issues)} hardcoded secret / connection string issue(s) found.")
    else:
        print(" [PASS] No hardcoded credentials or API keys found.")

    # 3. Database Isolation Safeguards
    iso_issues = check_database_isolation()
    if iso_issues:
        all_failures.extend(iso_issues)
        print(f" [FAIL] {len(iso_issues)} database isolation check(s) failed.")
    else:
        print(" [PASS] Database isolation safeguards and fail-closed rules verified.")

    # 4. Isolation Pytest Suite
    if "--skip-tests" not in sys.argv:
        tests_passed = run_isolation_tests()
        if not tests_passed:
            all_failures.append("Isolation pytest suite execution failed.")
            print(" [FAIL] Security & isolation test suite failed.")
        else:
            print(" [PASS] Security & tenant isolation test suite passed cleanly.")

    print("\n" + "="*70)
    if all_failures:
        print(f"[REJECTED] {len(all_failures)} security check(s) FAILED. Merging is BLOCKED:")
        for idx, f in enumerate(all_failures, start=1):
            print(f"  {idx}. {f}")
        print("="*70)
        return 1
    else:
        print("[APPROVED] All security, secret scanning, and isolation checks PASSED.")
        print("="*70)
        return 0


if __name__ == "__main__":
    sys.exit(main())
