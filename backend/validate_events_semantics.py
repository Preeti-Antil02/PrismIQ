import sys
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import json
import jwt

# Generate dev token
payload = {
    "sub": "c8f13b91-46ef-4682-9975-f85764d8a12e",
    "role": "authenticated",
    "aud": "authenticated",
    "exp": 253402300799
}
token = jwt.encode(payload, "test-jwt-secret-key-32-chars-long!", algorithm="HS256")

def test_events_endpoint():
    print("=== Testing Backend /events ===")
    url = "http://127.0.0.1:8000/events?limit=30"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        total_count = data.get("count", 0)
        events = data.get("events", [])
        print(f"Backend Total Events: {total_count}")
        print(f"Returned Batch Size: {len(events)}")
        
        # Invariant 1: No routine GitHub noise in events
        noise_titles = []
        for e in events:
            t = e.get("title", "")
            if any(p in t.lower() for p in ["started watching", "forked", "push to", "created branch", "issuecommentevent", "pullrequestevent"]):
                if e.get("corroboration_count", 1) == 1:
                    noise_titles.append(t)
        
        # Invariant 2: No rate limit strings in why_it_matters
        rate_limit_errors = []
        for e in events:
            w = e.get("why_it_matters") or ""
            if "rate limit" in w.lower() or "analysis unavailable" in w.lower():
                rate_limit_errors.append((e.get("title"), w))

        print(f"Routine GitHub Noise Violations: {len(noise_titles)}")
        if noise_titles:
            for nt in noise_titles[:5]:
                print(f"  VIOLATION: {nt}")

        print(f"Rate Limit String Violations: {len(rate_limit_errors)}")
        if rate_limit_errors:
            for rt, rw in rate_limit_errors[:5]:
                print(f"  VIOLATION in '{rt}': {rw}")

        assert len(noise_titles) == 0, f"Found {len(noise_titles)} noise events in Events stream!"
        assert len(rate_limit_errors) == 0, f"Found {len(rate_limit_errors)} rate limit error strings in why_it_matters!"
        print("Backend /events invariants PASSED!\n")
        return events

def test_frontend_proxy():
    print("=== Testing Frontend /api/events Proxy ===")
    url = "http://localhost:3000/api/events?limit=10"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print(f"Frontend Proxy Count: {data.get('count')}")
        print(f"Frontend Proxy Events: {len(data.get('events', []))}")
        assert data.get("count") == 425, f"Expected 425 events, got {data.get('count')}"
        print("Frontend proxy PASSED!\n")

def test_signals_retention():
    print("=== Testing Signals Retention ===")
    url = "http://localhost:3000/api/signals?limit=10"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print(f"Signals Count: {data.get('count')}")
        print(f"Signals Noise Suppressed Count: {data.get('noise_suppressed_count')}")
        assert data.get("count") > 1500, f"Expected >1500 signals, got {data.get('count')}"
        print("Signals retention PASSED!\n")

if __name__ == "__main__":
    events = test_events_endpoint()
    test_frontend_proxy()
    test_signals_retention()
    print("ALL VALIDATION CHECKS PASSED PERFECTLY!")
