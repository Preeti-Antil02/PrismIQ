import os
import sys
import re
from datetime import datetime, timezone
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath('.'))
load_dotenv('backend/.env')

import psycopg2
from psycopg2.extras import RealDictCursor
from backend.src.storage import get_db_url

conn = psycopg2.connect(get_db_url())
conn.autocommit = False

try:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # 1. Inspect findings for Place and Carousel
        cur.execute('''
            SELECT f.id as finding_id, f.event_id, f.company_name, f.tier, f.confidence, ce.title, ce.contributing_sources
            FROM findings f
            JOIN consolidated_events ce ON ce.event_id = f.event_id
            WHERE f.company_name IN ('Place', 'Carousel');
        ''')
        findings_to_quarantine = cur.fetchall()
        print(f"Found {len(findings_to_quarantine)} findings to quarantine for Place and Carousel.")

        finding_ids = [r['finding_id'] for r in findings_to_quarantine]
        event_ids = list(set(r['event_id'] for r in findings_to_quarantine))

        # Quarantine findings
        if finding_ids:
            cur.execute('''
                UPDATE findings
                SET tier = 'quarantined',
                    confidence = 'Suppressed',
                    inference_confidence = 'Unreliable',
                    why_it_matters = '[DISCLOSED FALSE POSITIVE - QUARANTINED]: Common-noun homonym collision (' || company_name || '). Stored news signal confirmed false positive.'
                WHERE id = ANY(%s::uuid[]);
            ''', (finding_ids,))
            print(f"Successfully quarantined {cur.rowcount} findings in PostgreSQL.")

        # Quarantine consolidated events
        if event_ids:
            cur.execute('''
                UPDATE consolidated_events
                SET fact_confidence = 'Quarantined',
                    event_summary = CASE 
                        WHEN event_summary LIKE '[DISCLOSED FALSE POSITIVE - QUARANTINED]%%' THEN event_summary
                        ELSE '[DISCLOSED FALSE POSITIVE - QUARANTINED] ' || event_summary
                    END
                WHERE event_id = ANY(%s);
            ''', (event_ids,))
            print(f"Successfully quarantined {cur.rowcount} consolidated events in PostgreSQL.")

        # 2. Update the live brief for Meesho tenant (8553449a-c998-4727-be01-9aeb724038cb)
        tenant_id = '8553449a-c998-4727-be01-9aeb724038cb'
        cur.execute('SELECT content, headline_preview FROM briefs WHERE tenant_id = %s;', (tenant_id,))
        brief_row = cur.fetchone()
        if brief_row:
            old_content = brief_row['content']
            # Remove the fabricated Top 3 decisions and insert clean disclosure
            disclosure_banner = (
                "> [!WARNING]\n"
                "> **Data Quality Disclosure (Quarantined Homonyms)**: Stored news signals for common-noun competitors "
                "'Place' and 'Carousel' were quarantined due to confirmed homonym collision rates. "
                "Fabricated decisions regarding airport baggage carousels and battery plant fires have been retracted. "
                "Genuine coverage for 'Place' remains active via verified ATS job postings.\n\n"
            )
            
            # Replace Top 3 decisions section with clean disclosure
            new_top3 = (
                "## Top decisions this informs\n\n"
                "- 🛡️ **Place & Carousel Coverage Notice**: News signals for common-noun competitors 'Place' and 'Carousel' "
                "are quarantined pending domain-grounded search implementation. Real job signals from `place.com` are retained.\n"
                "- 📦 **Amazon (India) Monitoring**: Autonomous monitoring active under tightened bounded association rule.\n"
                "- 🛒 **Flipkart & Myntra Continuous Monitoring**: Continuous tracking active across e-commerce candidate signals.\n\n"
            )

            # Replace Top 3 section in content
            content_cleaned = re.sub(
                r"##\s+Top\s+3\s+decisions[^\n]*\n+[\s\S]*?(?=\n##|\Z)",
                new_top3,
                old_content,
                flags=re.IGNORECASE
            )
            # Add banner under Pipeline Execution
            if "## Pipeline Execution & Data Coverage" in content_cleaned:
                content_cleaned = content_cleaned.replace(
                    "## Pipeline Execution & Data Coverage\n\n",
                    "## Pipeline Execution & Data Coverage\n\n" + disclosure_banner
                )
            else:
                content_cleaned = disclosure_banner + content_cleaned

            clean_preview = (
                "Data Quality Notice: News signals for common-noun competitors 'Place' and 'Carousel' "
                "have been quarantined. Legitimate coverage for Place is preserved via verified Greenhouse ATS job postings."
            )

            import hashlib
            new_hash = hashlib.sha256(content_cleaned.encode('utf-8')).hexdigest()

            cur.execute('''
                UPDATE briefs
                SET content = %s,
                    headline_preview = %s,
                    content_hash = %s,
                    published_at = NOW()
                WHERE tenant_id = %s;
            ''', (content_cleaned, clean_preview, new_hash, tenant_id))
            print(f"Successfully updated live brief for tenant {tenant_id} with quarantine disclosure.")

    conn.commit()
    print("Quarantine transaction committed successfully.")
except Exception as e:
    conn.rollback()
    print(f"Error during quarantine: {e}")
    sys.exit(1)
finally:
    conn.close()
