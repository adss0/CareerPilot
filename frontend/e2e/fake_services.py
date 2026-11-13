"""Fake outside services for the end-to-end test (never real AI, never real email).

- An Ollama-compatible AI on 127.0.0.1:11500 that writes a simple cover letter, a tailored
  CV and a job summary (it works out which from the prompt).
- A Reed-compatible job board on the same port under /reed/api/1.0 (two made-up jobs).
- A mail server on 127.0.0.1:2526 that saves each email's recipient, subject and attachment
  names to emails.json in the run folder (E2E_TMP).
"""

import email
import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from aiosmtpd.controller import Controller

TMP = Path(os.environ.get("E2E_TMP", Path(__file__).parent / ".tmp"))
TMP.mkdir(exist_ok=True)
EMAILS = TMP / "emails.json"
EMAILS.write_text("[]")


class FakeAI(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/reed/api/1.0/search"):
            return self._json({"results": REED_JOBS, "totalResults": len(REED_JOBS)})
        if self.path.startswith("/reed/api/1.0/jobs/"):
            job_id = int(self.path.rsplit("/", 1)[1])
            job = next(j for j in REED_JOBS if j["jobId"] == job_id)
            return self._json(
                {
                    **job,
                    "jobDescription": REED_DESCRIPTIONS[job_id],
                    "contractType": "permanent",
                    "fullTime": True,
                }
            )
        self.send_response(200)  # health check for Playwright's webServer
        self.end_headers()
        self.wfile.write(b"ok")

    def _json(self, value):
        data = json.dumps(value).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.path.startswith("/jooble/api/"):  # a fake Jooble (POST search)
            return self._json({"totalCount": len(JOOBLE_JOBS), "jobs": JOOBLE_JOBS})
        prompt = body["messages"][-1]["content"]
        system = body["messages"][0]["content"]
        if "Connection test" in prompt:
            reply = {"ok": True}
        elif "copied from a website" in system:  # "add a job from any site"
            reply = {
                "company": "Initech",
                "role": "Graduate Software Developer",
                "deadline": "15/12/2099",
                "salary": "£29,000",
                "location": "Bristol",
                "summary": "A graduate developer role on Initech's two-year scheme.",
                "requirements": ["A computing degree"],
                "match_score": 70,
                "strengths": ["Python APIs at Example Ltd"],
                "gaps": [],
            }
        elif "expert CV writer" in system:
            reply = {
                "summary": "Software engineering graduate who builds APIs in Python.",
                "skills": ["Python", "SQL"],
                "experience": [{"index": 0, "bullets": ["Built APIs in Python for 3 teams"]}],
                "projects": [{"index": 0, "summary": "A Python tool that tracks job applications"}],
                "changes": ["Led with Python, the job's main language"],
            }
        elif "decide whether a job is worth applying" in system:
            reply = {
                "summary": "A two-year graduate scheme building internal tools in Python.",
                "salary": "£28,000 – £32,000 a year",
                "location": "Manchester (hybrid)",
                "work_type": "Full-time graduate scheme",
                "requirements": ["A computing degree", "Python or Java"],
                "nice_to_have": ["SQL"],
                "match_score": 78,
                "strengths": ["Python APIs at Example Ltd"],
                "gaps": [],
            }
        else:
            company = re.search(r"Company: (.+)", prompt).group(1).strip()
            role = re.search(r"Role: (.+)", prompt).group(1).strip()
            reply = {
                "requirements": ["Python"],
                "matches": [{"requirement": "Python", "evidence": "Built APIs in Python"}],
                "match_score": 72,
                "letter": (
                    f"Dear Hiring Manager,\n\nI'd like to apply for the {role} role at {company}. "
                    "I build APIs in Python every day.\n\nKind regards,\nJane Example"
                ),
                "email_subject": f"{role} application",
                "email_body": "Hello,\n\nMy CV and cover letter are attached.\n\nJane Example",
            }
        data = json.dumps({"message": {"content": json.dumps(reply)}}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


REED_JOBS = [
    {
        "jobId": 9001,
        "employerName": "Acme Ltd",
        "jobTitle": "Graduate Software Engineer",
        "locationName": "Manchester",
        "minimumSalary": 28000.0,
        "maximumSalary": 32000.0,
        "date": "10/11/2026",
        "expirationDate": "30/11/2026",
        "jobDescription": "Join our two-year graduate scheme building internal tools...",
        "jobUrl": "https://example.com/jobs/9001",
    },
    {
        "jobId": 9002,
        "employerName": "Globex",
        "jobTitle": "Graduate Data Analyst",
        "locationName": "Leeds",
        "minimumSalary": 26000.0,
        "maximumSalary": 26000.0,
        "date": "08/11/2026",
        "expirationDate": "",
        "jobDescription": "Help our teams make sense of their data...",
        "jobUrl": "https://example.com/jobs/9002",
    },
]
JOOBLE_JOBS = [
    {
        "id": 7001,
        "title": "Graduate Cloud Engineer",
        "company": "Hooli",
        "location": "London",
        "snippet": "Join our cloud platform team...",
        "salary": "£31,000",
        "type": "Full-time",
        "link": "https://example.com/jobs/7001",
        "updated": "2026-11-12T08:00:00.0000000",
    }
]
REED_DESCRIPTIONS = {
    9001: "<p>Build internal tools in Python.</p><ul><li>A computing degree</li>"
    "<li>Python or Java</li></ul>",
    9002: "<p>Analyse data with SQL and Python.</p>",
}


class Mailbox:
    async def handle_DATA(self, server, session, envelope):
        message = email.message_from_bytes(envelope.content)
        saved = json.loads(EMAILS.read_text())
        saved.append(
            {
                "to": envelope.rcpt_tos,
                "subject": message["Subject"],
                "attachments": [p.get_filename() for p in message.walk() if p.get_filename()],
            }
        )
        EMAILS.write_text(json.dumps(saved))
        return "250 OK"


if __name__ == "__main__":
    Controller(Mailbox(), hostname="127.0.0.1", port=2526).start()
    server = ThreadingHTTPServer(("127.0.0.1", 11500), FakeAI)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    print("fake services ready", flush=True)
    threading.Event().wait()
