import json
import hashlib
from pathlib import Path
from collections import defaultdict

backend = Path('c:/Users/preet/Documents/GitHub/PrismIQ/backend')

def generate_signal_id(company: str, source: str, url: str, title: str, published_at: str) -> str:
    raw = f"{company.strip()}::{source.strip()}::{url.strip()}::{title.strip()}::{str(published_at).strip()}"
    return "sig_" + hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

def audit_raw_signals_thoroughly():
    signal_files = sorted(list(backend.glob("data/signals*.json")) + list(backend.glob("published_briefs/signals*.json")))
    
    # 1. Signals from signals*.json
    raw_signals_list = []
    for sf in signal_files:
        rel = f"{sf.parent.name}/{sf.name}"
        with open(sf, "r", encoding="utf-8") as f:
            data = json.load(f)
            for idx, item in enumerate(data):
                raw_signals_list.append((rel, idx, item))
                
    # 2. Also check signals embedded inside events*.json
    event_files = sorted(list(backend.glob("data/events*.json")) + list(backend.glob("published_briefs/events*.json")))
    embedded_signals_list = []
    for ef in event_files:
        rel = f"{ef.parent.name}/{ef.name}"
        with open(ef, "r", encoding="utf-8") as f:
            data = json.load(f)
            for e_idx, ev in enumerate(data):
                for s_idx, s in enumerate(ev.get("raw_signals", [])):
                    embedded_signals_list.append((rel, e_idx, s_idx, s))

    print(f"Signals directly in signals*.json files: {len(raw_signals_list)}")
    print(f"Signals embedded in events*.json files: {len(embedded_signals_list)}")
    
    # Check uniqueness of all signals by exact dictionary comparison vs hash ID
    by_hash = defaultdict(list)
    by_full_tuple = defaultdict(list)
    
    for rel, idx, item in raw_signals_list:
        comp = item.get("company", "Unknown").strip()
        src = item.get("source", "").strip()
        url = item.get("url", "").strip()
        title = item.get("title", "").strip()
        pub = str(item.get("published_at", "")).strip()
        excerpt = item.get("raw_excerpt", "").strip()
        
        hid = generate_signal_id(comp, src, url, title, pub)
        by_hash[hid].append((rel, item))
        by_full_tuple[(comp, src, url, title, pub, excerpt)].append((rel, item))

    print(f"\nUnique by hash (company, src, url, title, pub): {len(by_hash)}")
    print(f"Unique by full tuple (including raw_excerpt): {len(by_full_tuple)}")
    
    diff = len(by_full_tuple) - len(by_hash)
    print(f"Signals with same hash but differing excerpt: {diff}")
    
    # Check all embedded signals against by_hash
    new_from_events = 0
    for rel, e_idx, s_idx, s in embedded_signals_list:
        comp = s.get("company", "Unknown").strip()
        src = s.get("source", "").strip()
        url = s.get("url", "").strip()
        title = s.get("title", "").strip()
        pub = str(s.get("published_at", "")).strip()
        hid = generate_signal_id(comp, src, url, title, pub)
        if hid not in by_hash:
            new_from_events += 1
            by_hash[hid].append((rel, s))
            
    print(f"Signals embedded in events that were not in any signals*.json: {new_from_events}")
    print(f"Grand total unique signals across all files: {len(by_hash)}")

if __name__ == "__main__":
    audit_raw_signals_thoroughly()
