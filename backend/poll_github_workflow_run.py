import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv
import requests

if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

backend = Path(__file__).resolve().parent
load_dotenv(backend / ".env")
token = os.getenv("GITHUB_TOKEN")

headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
url = "https://api.github.com/repos/Preeti-Antil02/PrismIQ/actions/runs"

r = requests.get(url, headers=headers)
if r.status_code == 200:
    runs = r.json().get("workflow_runs", [])
    print(f"Total Workflow Runs: {len(runs)}")
    for run in runs:
        print("=" * 80)
        print(f"Run ID        : {run.get('id')}")
        print(f"Workflow Name : {run.get('name')}")
        print(f"Event Trigger : {run.get('event')}")  # 'workflow_dispatch' or 'schedule'
        print(f"Status        : {run.get('status')}") # 'queued', 'in_progress', 'completed'
        print(f"Conclusion    : {run.get('conclusion')}") # 'success', 'failure'
        print(f"Started At    : {run.get('run_started_at')}")
        print(f"Updated At    : {run.get('updated_at')}")
        print(f"HTML URL      : {run.get('html_url')}")
else:
    print(f"Error querying GitHub Actions API: HTTP {r.status_code} - {r.text[:200]}")
