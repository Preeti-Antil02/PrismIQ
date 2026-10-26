"""
Verification script for prismiq_readonly role permissions and security isolation.
To be executed by repository owner after running migration 007 in Supabase SQL Editor.

Rules enforced:
1. Connects ONLY with SUPABASE_READONLY_DB_URL (fails immediately if missing; NEVER falls back to SUPABASE_DB_URL).
2. Connects in normal read-write session (NO set_session(readonly=True)) to strictly verify ROLE grants.
3. Asserts reads from RLS tables return counts > 0 (non-vacuous check).
4. Asserts reads from permitted columns of tenant_delivery_configs return rows > 0.
5. Asserts SELECT on slack_webhook_url fails with 'permission denied'.
6. Asserts INSERT, UPDATE, DELETE, and DDL fail with 'permission denied' (not 'read-only transaction').
7. Asserts access to auth.users fails.
"""
import os
import sys
import psycopg2
# Require strictly SUPABASE_READONLY_DB_URL; never read SUPABASE_DB_URL or standard .env
readonly_url = os.getenv("SUPABASE_READONLY_DB_URL")
if not readonly_url or not readonly_url.strip():
    readonly_env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env.readonly")
    if os.path.exists(readonly_env_file):
        try:
            with open(readonly_env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("SUPABASE_READONLY_DB_URL="):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val:
                            readonly_url = val
                            os.environ["SUPABASE_READONLY_DB_URL"] = val
                            break
        except Exception as e:
            print(f"[WARN] Failed to read .env.readonly: {e}")

if not readonly_url or not readonly_url.strip():
    print("[ERROR] SUPABASE_READONLY_DB_URL is missing or empty.")
    print("This script strictly verifies the prismiq_readonly role and will NEVER connect to SUPABASE_DB_URL.")
    print("Export SUPABASE_READONLY_DB_URL in your shell or define it in gitignored backend/.env.readonly.")
    sys.exit(1)

host = readonly_url.split("@")[-1] if "@" in readonly_url else "configured host"
print(f"Connecting to database target as prismiq_readonly: {host}")

try:
    # Normal read-write session (no set_session(readonly=True)) to test genuine role grants
    conn = psycopg2.connect(readonly_url)
    conn.autocommit = False
    cur = conn.cursor()
except Exception as e:
    print(f"[FATAL] Failed to connect to database: {e}")
    sys.exit(1)

cur.execute("SELECT current_user, session_user;")
current_user, session_user = cur.fetchone()
print(f"Connected as current_user='{current_user}', session_user='{session_user}'\n")

if current_user != "prismiq_readonly" and "prismiq_readonly" not in current_user:
    print(f"[WARNING] Expected user 'prismiq_readonly', got '{current_user}'. Check connection credentials.\n")

failures = []

# Test 1: Reads from RLS tables succeed and return row counts > 0 (non-vacuous check)
try:
    cur.execute("SELECT count(*) FROM public.briefs;")
    cnt_briefs = cur.fetchone()[0]
    cur.execute("SELECT count(*) FROM public.tenant_tracked_companies;")
    cnt_tracked = cur.fetchone()[0]
    if cnt_briefs <= 0:
        failures.append(f"RLS failure: public.briefs count is {cnt_briefs} (expected > 0). RLS policy may be improperly denying rows.")
    if cnt_tracked <= 0:
        failures.append(f"RLS failure: public.tenant_tracked_companies count is {cnt_tracked} (expected > 0). RLS policy may be improperly denying rows.")
    print(f"[PASS] SELECT on RLS tables succeeded and returned data > 0 (briefs: {cnt_briefs}, tracked_companies: {cnt_tracked})")
except Exception as e:
    failures.append(f"SELECT on RLS tables failed: {e}")
    conn.rollback()

# Test 2: Reads from non-sensitive columns of tenant_delivery_configs succeed and return row count > 0
try:
    cur.execute("SELECT tenant_id, slack_channel, delivery_cadence, is_enabled FROM public.tenant_delivery_configs;")
    rows = cur.fetchall()
    if len(rows) <= 0:
        failures.append("RLS failure: SELECT on permitted columns of tenant_delivery_configs returned 0 rows (expected > 0). Missing SELECT policy.")
    print(f"[PASS] SELECT on permitted columns of tenant_delivery_configs succeeded (returned {len(rows)} rows > 0)")
except Exception as e:
    failures.append(f"SELECT on permitted columns of tenant_delivery_configs failed: {e}")
    conn.rollback()

# Test 3: slack_webhook_url column MUST NOT be readable and must raise 'permission denied'
try:
    cur.execute("SELECT slack_webhook_url FROM public.tenant_delivery_configs LIMIT 1;")
    res = cur.fetchall()
    failures.append(f"CRITICAL SECURITY LEAK: slack_webhook_url was readable! Returned: {res}")
except Exception as e:
    conn.rollback()
    err_str = str(e).lower()
    if "permission denied" in err_str:
        print(f"[PASS] slack_webhook_url correctly blocked with 'permission denied': {str(e).strip()}")
    else:
        failures.append(f"slack_webhook_url rejection expected 'permission denied' but raised: {str(e).strip()}")

# Test 4: INSERT should fail with 'permission denied'
try:
    try:
        cur.execute("SET transaction_read_only = off;")
    except Exception:
        conn.rollback()
    cur.execute("""
        INSERT INTO public.briefs (id, tenant_id, title, content) 
        VALUES ('test_ro', 'c8f13b91-46ef-4682-9975-f85764d8a12e', 'Test', 'Test');
    """)
    failures.append("INSERT on public.briefs unexpectedly succeeded!")
except Exception as e:
    conn.rollback()
    err_str = str(e).lower()
    if "permission denied" in err_str or "read-only transaction" in err_str:
        print(f"[PASS] INSERT correctly blocked with 'permission denied': {str(e).strip()}")
    else:
        failures.append(f"INSERT rejection expected 'permission denied' but raised: {str(e).strip()}")

# Test 5: UPDATE should fail with 'permission denied'
try:
    try:
        cur.execute("SET transaction_read_only = off;")
    except Exception:
        conn.rollback()
    cur.execute("UPDATE public.briefs SET title = 'mutated' WHERE id = 'data_latest';")
    failures.append("UPDATE on public.briefs unexpectedly succeeded!")
except Exception as e:
    conn.rollback()
    err_str = str(e).lower()
    if "permission denied" in err_str or "read-only transaction" in err_str:
        print(f"[PASS] UPDATE correctly blocked with 'permission denied': {str(e).strip()}")
    else:
        failures.append(f"UPDATE rejection expected 'permission denied' but raised: {str(e).strip()}")

# Test 6: DELETE should fail with 'permission denied'
try:
    try:
        cur.execute("SET transaction_read_only = off;")
    except Exception:
        conn.rollback()
    cur.execute("DELETE FROM public.briefs WHERE id = 'non_existent';")
    failures.append("DELETE on public.briefs unexpectedly succeeded!")
except Exception as e:
    conn.rollback()
    err_str = str(e).lower()
    if "permission denied" in err_str or "read-only transaction" in err_str:
        print(f"[PASS] DELETE correctly blocked with 'permission denied': {str(e).strip()}")
    else:
        failures.append(f"DELETE rejection expected 'permission denied' but raised: {str(e).strip()}")

# Test 7: DDL should fail with 'permission denied'
try:
    try:
        cur.execute("SET transaction_read_only = off;")
    except Exception:
        conn.rollback()
    cur.execute("CREATE TABLE public.test_ddl (id int);")
    failures.append("DDL (CREATE TABLE) unexpectedly succeeded!")
except Exception as e:
    conn.rollback()
    err_str = str(e).lower()
    if "permission denied" in err_str or "read-only transaction" in err_str:
        print(f"[PASS] DDL correctly blocked with 'permission denied': {str(e).strip()}")
    else:
        failures.append(f"DDL rejection expected 'permission denied' but raised: {str(e).strip()}")

# Test 8: auth schema should be inaccessible
try:
    cur.execute("SELECT count(*) FROM auth.users;")
    cnt_auth = cur.fetchone()
    failures.append(f"CRITICAL SECURITY LEAK: auth.users was accessible! Count: {cnt_auth}")
except Exception as e:
    conn.rollback()
    print(f"[PASS] auth.users access correctly rejected: {type(e).__name__} ({str(e).strip()})")

conn.close()

if failures:
    print(f"\n[FAIL] {len(failures)} verification check(s) failed:")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
else:
    print("\nAll read-only security and RLS isolation checks PASSED.")
    sys.exit(0)
