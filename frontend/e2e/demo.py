"""A safe demo of CareerPilot: a fake AI, a fake job board and a throwaway database.

    python e2e/demo.py            (from frontend/, with the backend's Python)

Opens on http://localhost:5175. Nothing real is used: no AI key, no job-board key, no email,
and your own data and Documents folder are never touched. Everything is deleted on exit.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parent
BACKEND = FRONTEND.parent / "backend"
BACKEND_PORT, FRONTEND_PORT = 8200, 5175
API = f"http://127.0.0.1:{BACKEND_PORT}/api"

# A made-up person, and a tracker like a real graduate's spreadsheet.
PROFILE = {
    "full_name": "Jane Example",
    "email": "jane@example.com",
    "phone": "+44 7700 900123",
    "location": "Manchester, UK",
    "linkedin_url": "https://www.linkedin.com/in/jane-example",
    "summary": "Software engineering student who builds APIs and desktop apps.",
    "skills": ["Python", "C#", "SQL", "Java", "Spring Boot"],
    "experience": [
        {
            "title": "Junior Software Engineer",
            "company": "Example Ltd",
            "start": "September 2025",
            "end": "Present",
            "summary": "- Built Python APIs used by 3 teams\n- Wrote automated tests",
        }
    ],
    "education": [
        {"qualification": "BSc Software Engineering", "institution": "Example University"}
    ],
    "projects": [{"name": "Job tracker", "summary": "A Python tool that tracks job applications"}],
}
# A made-up tracker; pass the path of your own CSV to try the demo with it instead.
TRACKER_CSV = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "demo_tracker.csv"


def request(method: str, path: str, body: object | None = None, headers=None) -> object:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{API}{path}", data=data, method=method)
    req.add_header("X-CareerPilot", "1")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    for key, value in (headers or {}).items():
        req.add_header(key, value)
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read() or b"null")


def upload(path: str, filename: str, content: bytes, fields: dict[str, str]) -> object:
    boundary = "careerpilotdemo"
    parts = []
    for name, value in fields.items():
        parts.append(
            f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'
        )
    head = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        "Content-Type: text/csv\r\n\r\n"
    )
    body = "".join(parts).encode() + head.encode() + content + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(f"{API}{path}", data=body, method="POST")
    req.add_header("X-CareerPilot", "1")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read())


def wait_for(url: str, seconds: int = 60) -> None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=2)
            return
        except OSError:
            time.sleep(0.5)
    raise SystemExit(f"{url} didn't start")


def main() -> None:
    tmp = Path(tempfile.mkdtemp(prefix="careerpilot-demo-"))
    env = {
        **os.environ,
        "E2E_TMP": str(tmp),
        "CAREERPILOT_HOME": str(tmp / "home"),
        "CAREERPILOT_DOCUMENTS": str(tmp / "Documents" / "CareerPilot"),
        "AI_PROVIDER": "ollama",
        "OLLAMA_BASE_URL": "http://127.0.0.1:11500",
        "REED_API_KEY": "demo-fake-key",
        "REED_API_BASE": "http://127.0.0.1:11500/reed/api/1.0",
        "GEMINI_API_KEY": "",
        "EMAIL_PASSWORD": "",
        "VITE_PROXY_TARGET": f"http://127.0.0.1:{BACKEND_PORT}",
    }
    processes = [
        subprocess.Popen([sys.executable, str(HERE / "fake_services.py")], env=env),
        subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--port", str(BACKEND_PORT)],
            cwd=BACKEND,
            env=env,
        ),
        subprocess.Popen(
            f"npx vite --port {FRONTEND_PORT} --strictPort",
            cwd=FRONTEND,
            env=env,
            shell=True,  # npx is a .cmd on Windows
        ),
    ]
    try:
        wait_for(f"{API}/health")
        request("PUT", "/profile", PROFILE)
        content = TRACKER_CSV.read_bytes()
        preview = upload("/imports/preview", "tracker.csv", content, {})
        mapping = json.dumps(preview["suggested_mapping"])
        result = upload("/imports/commit", "tracker.csv", content, {"mapping": mapping})
        print(f"Demo tracker: {result['imported']} jobs imported", flush=True)
        wait_for(f"http://localhost:{FRONTEND_PORT}")
        print(f"CareerPilot demo ready on http://localhost:{FRONTEND_PORT}", flush=True)
        processes[1].wait()
    finally:
        for process in processes:
            process.terminate()
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
