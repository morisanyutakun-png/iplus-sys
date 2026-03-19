#!/usr/bin/env python3
import os
import time
import requests
import subprocess

API_BASE = os.environ.get("IPRINT_API", "http://localhost:8000/api/jobs")
POLL_INTERVAL = int(os.environ.get("IPRINT_POLL", "5"))
PRINTER_FALLBACK = os.environ.get("IPRINT_PRINTER")


def poll_jobs():
    r = requests.get(f"{API_BASE}/agent/poll", timeout=10)
    r.raise_for_status()
    return r.json().get("jobs", [])


def ack(job_id, status, results):
    payload = {"job_id": job_id, "status": status, "results": results}
    r = requests.post(f"{API_BASE}/agent/ack", json=payload, timeout=10)
    r.raise_for_status()


def run_job(job):
    printer = job.get("printer_name") or PRINTER_FALLBACK
    results = []
    all_success = True
    for item in job.get("items", []):
        uri = item.get("pdf_resolved")
        if not uri:
            msg = f"PDF not found: {item.get('pdf_relpath')}"
            results.append({"item_id": item["id"], "success": False, "message": msg})
            all_success = False
            continue
        cmd = ["lp"]
        if printer:
            cmd += ["-d", printer]
        if item.get("duplex"):
            cmd += ["-o", "sides=two-sided-long-edge"]
        cmd.append(uri)
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=60)
            results.append({"item_id": item["id"], "success": True, "message": "printed"})
        except Exception as e:
            results.append({"item_id": item["id"], "success": False, "message": str(e)})
            all_success = False
    ack(job["job_id"], "done" if all_success else "failed", results)


def main():
    while True:
        try:
            jobs = poll_jobs()
            for job in jobs:
                run_job(job)
        except Exception as e:
            print(f"[agent] error: {e}")
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
