import os
import sys
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))
load_dotenv('backend/.env')

import psycopg2
from psycopg2.extras import RealDictCursor
from backend.src.storage import get_db_url

CANONICAL_COMPANY_METADATA = {
    "meesho": {"domain": "meesho.com", "category": "Social Commerce / E-Commerce"},
    "Meesho": {"domain": "meesho.com", "category": "Social Commerce / E-Commerce"},
    "Flipkart": {"domain": "flipkart.com", "category": "E-Commerce"},
    "flipkart": {"domain": "flipkart.com", "category": "E-Commerce"},
    "Myntra": {"domain": "myntra.com", "category": "Fashion E-Commerce"},
    "Amazon (India)": {"domain": "amazon.in", "category": "E-Commerce"},
    "Amazon India": {"domain": "amazon.in", "category": "E-Commerce"},
    "Amazon": {"domain": "amazon.com", "category": "E-Commerce & Cloud"},
    "Anthropic": {"domain": "anthropic.com", "category": "Artificial Intelligence / LLMs"},
    "BigCommerce": {"domain": "bigcommerce.com", "category": "E-Commerce SaaS"},
    "Carousel": {"domain": "carousell.com", "category": "C2C Marketplace / Classifieds"},
    "Cloudflare Pages/Workers": {"domain": "cloudflare.com", "category": "Cloud / Edge Computing"},
    "Croma": {"domain": "croma.com", "category": "Consumer Electronics Retail"},
    "EAB": {"domain": "eab.com", "category": "Education Consulting & Technology"},
    "EverCommerce": {"domain": "evercommerce.com", "category": "Service Commerce SaaS"},
    "Gobble": {"domain": "gobble.com", "category": "Meal Kit Delivery"},
    "Lazada": {"domain": "lazada.com", "category": "Southeast Asia E-Commerce"},
    "Netlify": {"domain": "netlify.com", "category": "Web Hosting & DevOps"},
    "Nykaa Fashion": {"domain": "nykaafashion.com", "category": "Beauty & Fashion E-Commerce"},
    "OpenAI": {"domain": "openai.com", "category": "Artificial Intelligence"},
    "Place": {"domain": "place.com", "category": "Real Estate Technology / SaaS"},
    "Poshmark": {"domain": "poshmark.com", "category": "Secondhand Fashion Marketplace"},
    "PostHog": {"domain": "posthog.com", "category": "Product Analytics"},
    "Sagazo": {"domain": "sagazo.com", "category": "AI E-Commerce Optimization"},
    "Segment": {"domain": "segment.com", "category": "Customer Data Platform / Analytics"},
    "Shopify": {"domain": "shopify.com", "category": "E-Commerce Platform"},
    "Shopsy": {"domain": "shopsy.in", "category": "Budget Social Commerce"},
    "Stripe": {"domain": "stripe.com", "category": "Fintech & Payments Infrastructure"},
    "StyleBuddy": {"domain": "stylebuddy.fashion", "category": "Fashion Styling & Personal Shopping"},
    "Temu": {"domain": "temu.com", "category": "Discount E-Commerce"},
    "Vercel": {"domain": "vercel.com", "category": "Frontend Cloud Platform"},
    "WooCommerce": {"domain": "woocommerce.com", "category": "Open-Source E-Commerce"},
    "66Analytics": {"domain": "66analytics.com", "category": "Web Analytics"},
    "Ajio": {"domain": "ajio.com", "category": "Fashion E-Commerce"},
}

conn = psycopg2.connect(get_db_url())
conn.autocommit = False

try:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # 1. Backfill tenant_tracked_companies
        cur.execute("SELECT id, tenant_id, company_name, primary_domain, industry_category FROM tenant_tracked_companies;")
        rows = cur.fetchall()
        print(f"Total tenant_tracked_companies rows: {len(rows)}")

        ttc_updated = 0
        for r in rows:
            cname = r['company_name']
            meta = CANONICAL_COMPANY_METADATA.get(cname) or CANONICAL_COMPANY_METADATA.get(cname.lower())
            if meta:
                dom = meta['domain']
                cat = meta['category']
                cur.execute('''
                    UPDATE tenant_tracked_companies
                    SET primary_domain = %s,
                        industry_category = %s,
                        updated_at = NOW()
                    WHERE id = %s;
                ''', (dom, cat, r['id']))
                ttc_updated += 1

        print(f"Successfully backfilled {ttc_updated} rows in tenant_tracked_companies.")

        # 2. Backfill discovery_candidates
        cur.execute("SELECT id, name, domain, category FROM discovery_candidates;")
        cands = cur.fetchall()
        print(f"Total discovery_candidates rows: {len(cands)}")

        cand_updated = 0
        for c in cands:
            cname = c['name']
            meta = CANONICAL_COMPANY_METADATA.get(cname) or CANONICAL_COMPANY_METADATA.get(cname.lower())
            if meta:
                dom = meta['domain']
                cat = meta['category']
                cur.execute('''
                    UPDATE discovery_candidates
                    SET domain = %s,
                        category = %s
                    WHERE id = %s;
                ''', (dom, cat, c['id']))
                cand_updated += 1

        print(f"Successfully backfilled {cand_updated} rows in discovery_candidates.")

    conn.commit()
    print("Backfill committed successfully.")
except Exception as e:
    conn.rollback()
    print(f"Backfill error: {e}")
    sys.exit(1)
finally:
    conn.close()
