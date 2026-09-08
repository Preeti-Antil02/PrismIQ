import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

def seed():
    conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
    cur = conn.cursor()

    # 1. Insert persistent test tenant 2 into auth.users if not exists
    cur.execute("""
        INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role)
        VALUES (
            'e4b2a7d1-1234-4567-89ab-cdef01234567',
            'tenant2@prismiq.ai',
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Test Tenant 2"}',
            NOW(),
            NOW(),
            'authenticated'
        )
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    """)

    # 2. Seed tenant_tracked_companies for Tenant 2
    # Target: Stripe, Competitor: Netlify
    cur.execute("""
        INSERT INTO tenant_tracked_companies (tenant_id, company_name, is_target, status)
        VALUES 
            ('e4b2a7d1-1234-4567-89ab-cdef01234567', 'Stripe', TRUE, 'active'),
            ('e4b2a7d1-1234-4567-89ab-cdef01234567', 'Netlify', FALSE, 'active')
        ON CONFLICT (tenant_id, company_name) DO UPDATE
        SET is_target = EXCLUDED.is_target, status = EXCLUDED.status;
    """)

    conn.commit()

    # Verify
    cur.execute("SELECT id, email FROM auth.users ORDER BY email;")
    print("AUTH USERS:", cur.fetchall())

    cur.execute("SELECT tenant_id, company_name, is_target, status FROM tenant_tracked_companies ORDER BY tenant_id, company_name;")
    print("TRACKED COMPANIES:")
    for r in cur.fetchall():
        print(" ", r)

    cur.execute("SELECT DISTINCT company_name FROM tenant_tracked_companies WHERE status = 'active' ORDER BY company_name;")
    print("DISTINCT COMPANIES ACROSS ALL TENANTS:", [r[0] for r in cur.fetchall()])

    conn.close()

if __name__ == "__main__":
    seed()
