import json
import sys
from pathlib import Path
from collections import defaultdict

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

backend = Path('c:/Users/preet/Documents/GitHub/PrismIQ/backend')

def audit_event_variations():
    event_files = sorted(list(backend.glob("data/events*.json")) + list(backend.glob("published_briefs/events*.json")))
    events_by_id = defaultdict(list)
    
    for ef in event_files:
        rel = f"{ef.parent.name}/{ef.name}"
        with open(ef, "r", encoding="utf-8") as f:
            data = json.load(f)
            for idx, item in enumerate(data):
                eid = item.get("event_id")
                events_by_id[eid].append({
                    "file": rel,
                    "title": item.get("title"),
                    "corroboration_count": item.get("corroboration_count"),
                    "signals_count": len(item.get("raw_signals", [])),
                    "first_detected_at": item.get("first_detected_at"),
                    "latest_detected_at": item.get("latest_detected_at"),
                    "item": item
                })

    diffs = []
    for eid, entries in events_by_id.items():
        if len(entries) > 1:
            titles = set(e["title"] for e in entries)
            sig_counts = set(e["signals_count"] for e in entries)
            if len(titles) > 1 or len(sig_counts) > 1:
                diffs.append((eid, entries))
                
    print(f"Total event IDs with variations across run snapshots: {len(diffs)}")
    for idx, (eid, entries) in enumerate(diffs[:10], 1):
        print(f"\nEvent Variation #{idx} (Event ID: {eid}):")
        for e in entries:
            print(f"  File: {e['file']} | Corroboration: {e['corroboration_count']} | Signals: {e['signals_count']} | Title: {e['title'][:50]}")

if __name__ == "__main__":
    audit_event_variations()
