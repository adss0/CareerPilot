"""Fake outside services for the end-to-end test (never real AI, never real email).

- An Ollama-compatible AI on 127.0.0.1:11500 that writes a simple, honest cover letter.
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
    def do_GET(self):  # health check for Playwright's webServer
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        prompt = body["messages"][-1]["content"]
        if "Connection test" in prompt:
            reply = {"ok": True}
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
