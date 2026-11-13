# CareerPilot ✈️

**Your personal job-application assistant. CareerPilot reads your job list from Excel, writes a tailored cover letter for every job using free AI, sends email applications for you (after you approve them), and tracks every application from "sent" to "offer".**

> ✅ Status: version 1.4. Find jobs, a tracker like your own spreadsheet, and a one-page Apply flow with a tailored CV and cover letter. New here? Read the **[user guide](docs/USER_GUIDE.md)**. Changes are in the [changelog](CHANGELOG.md) and the roadmap is in the [plan](PLAN.md).

---

## Why CareerPilot?

Applying for jobs is repetitive: copy the job details, rewrite a cover letter, attach your CV, send the email, then try to remember who you applied to and when to follow up. CareerPilot does the boring parts for you, so you can spend your time on the applications that matter.

- 💸 **Completely free.** It uses free AI (Google Gemini's free tier), or a local model on your own PC.
- 🔒 **Private.** Everything runs on your computer. Your CV and job list never sit on someone else's server.
- 🛡️ **Safe.** Nothing is ever sent without your approval, and no bots touch LinkedIn or other job sites.

---

## How it works

```
 1. Import          2. Profile          3. Write             4. Apply             5. Track
┌──────────┐      ┌──────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Excel of │ ──▶  │ Your CV  │ ──▶  │ AI writes a  │ ──▶  │ You approve, │ ──▶  │ Status board │
│   jobs   │      │ (parsed) │      │ cover letter │      │ app sends    │      │ + follow-ups │
└──────────┘      └──────────┘      └──────────────┘      └──────────────┘      └──────────────┘
```

1. **Import your jobs.** Drop in an Excel or CSV file with the jobs you want (company, role, link, contact email, description). CareerPilot recognises the columns, cleans the data, skips duplicates and adds each job to your tracker.
2. **Add your profile.** Upload your CV (PDF or Word) once. CareerPilot pulls out your skills, experience and projects to reuse for every application.
3. **Generate cover letters.** For each job, the AI writes a tailored letter that matches your real experience to what the job asks for. It never makes things up. Pick a tone, edit it, regenerate it, or export it as PDF/Word.
4. **Apply.**
   - **Email jobs:** CareerPilot writes the email, attaches your letter and CV, and sends it from your own email account (Gmail, Outlook…) **after you click approve**. Test mode is on until you switch it off, so the first emails come to you. Sends are spaced out and capped each day so you never look like spam.
   - **Job-site jobs (LinkedIn, Indeed, company portals):** *Assisted apply.* CareerPilot copies your letter, gets your CV ready and opens the job page, then **you** click submit. It's fast and keeps your accounts safe.
5. **Track everything.** A board, a table and a calendar show every application: *Imported → Drafted → Ready → Sent → Followed up → Replied → Interview → Offer / Rejected*. CareerPilot notices replies, reminds you to follow up when a company goes quiet, shows your stats, and exports everything back to Excel.

---

## Features

| | Feature |
|---|---|
| 🔎 | Find jobs on UK job boards (Reed, Adzuna, Jooble), each summarised by AI with salary and how well you match; a shortlist; one-click searches of Gradcracker, The Trackr, Bright Network, Prospects and TARGETjobs; add a job from any site |
| 🚀 | One-page Apply: tailored CV + cover letter, preview, download, then open the employer's site with your details ready to copy |
| 📥 | Excel / CSV import (even your own tracker layout) with automatic column matching, status import and duplicate detection |
| 👤 | CV upload and parsing into a reusable profile (multiple CV versions supported) |
| ✍️ | AI cover letters tailored to each job, with tone options, things to highlight and version history |
| 🎯 | A CV tailored to every job (reworded and reordered, never invented) |
| 📁 | Every CV and letter saved as Word + PDF in Documents\CareerPilot, one folder per company |
| 📄 | Export letters to PDF and Word |
| 📤 | Approve-then-send email applications via Gmail, Outlook or any SMTP account, with daily limits |
| 🧭 | Assisted apply for job portals |
| 📊 | A tracker like your own spreadsheet (totals, interview stages, next steps, deadlines due, hide closed, delete with a 30-day recycle bin), a Kanban board and a dashboard |
| 🔔 | Follow-up reminders and AI-drafted follow-up emails |
| 📬 | Reply detection from your inbox (IMAP) |
| 🔁 | Export your tracker to Excel any time |
| 🖥️ | Installable desktop app for Windows, with one-click signed auto-updates |
| 💾 | Backup and restore of all your data in one file |

---

## Tech stack

| Area | Technology |
|---|---|
| AI | Google Gemini (free tier) · Groq (free tier) · Ollama (local, offline) |
| Frontend | React · TypeScript · Vite · Tailwind CSS · shadcn/ui · TanStack Query / Table |
| Backend | Python · FastAPI · openpyxl · SQLModel |
| Database | SQLite (a single local file) |
| Email | SMTP + IMAP (Gmail/Outlook App Password) |
| Desktop | Tauri |

### Architecture

- **Frontend: MVVM.** Each screen is split into a **Model** (API calls and types), a **ViewModel** (a React hook holding the screen's state and actions) and a **View** (components that only display things).
- **Backend: layered.** **Routers** handle HTTP, **services** hold the business logic, **repositories** talk to the database, and **integrations** wrap outside services (AI, Gmail) so they can be swapped.

```
frontend/src/features/<feature>/
  api.ts               ← Model
  use<X>ViewModel.ts   ← ViewModel
  <X>View.tsx          ← View

backend/app/
  api/ → services/ → repositories/ → models/
                  ↘ integrations/ (AI, Gmail)
```

---

## Development plan

The roadmap, every development phase step by step, and the progress log are in **[PLAN.md](PLAN.md)**.

---

## Desktop app (Windows)

CareerPilot installs like a normal Windows app. Nothing else (Python, Node) is needed.

1. Download the installer: from a [GitHub Release](https://github.com/adss0/CareerPilot/releases), or from the latest **Desktop app** run on the [Actions tab](https://github.com/adss0/CareerPilot/actions/workflows/desktop.yml) (artifact *CareerPilot-windows-installer*).
2. Run `CareerPilot_x.y.z_x64-setup.exe`. It installs for your user only; no admin rights are needed.
3. Your data (database, CVs, settings) lives in `%APPDATA%\app.careerpilot.desktop`. Paste your keys in **Settings → Keys & passwords** (they're saved to the `.env` file there). Tailored CVs and cover letters are saved in `Documents\CareerPilot`.

**Building it yourself** needs Rust and Node: build the backend with `pyinstaller careerpilot-server.spec` in `backend/`, copy it to `desktop/src-tauri/binaries/careerpilot-server-x86_64-pc-windows-msvc.exe`, run `npm run build:desktop` in `frontend/`, then `npx tauri build` in `desktop/`. The [workflow](.github/workflows/desktop.yml) does exactly this.

---

## Getting started (development)

**Requirements:** Python 3.12+ and Node.js 20+

```bash
# 1. Backend
cd backend
py -m venv .venv            # macOS/Linux: python3 -m venv .venv
.venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
copy .env.example .env      # macOS/Linux: cp .env.example .env
uvicorn app.main:app --reload
```

```bash
# 2. Frontend (in a second terminal)
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The dashboard shows **Backend: Online** when everything is connected. API docs are at <http://localhost:8000/docs>.

Get a free Gemini API key at <https://aistudio.google.com/apikey> and paste it in **Settings → Keys & passwords** (it's saved to `backend/.env`).

**Checks:** `pytest` and `ruff check .` in `backend/`; `npm run lint`, `npm test` and `npm run e2e` in `frontend/` (the end-to-end test needs `npx playwright install chromium` once, and uses a fake AI and a local test mail server).

---

## Responsible use

CareerPilot is built to help you apply **better**, not to spam employers:

- Every email is personalised and needs your approval.
- Daily send limits and delays protect your email account.
- There's no automated submitting on LinkedIn, Indeed or other job portals, which ban bots in their terms.
- The AI only uses facts from your own CV. Always read your letter before sending it.

**Your data:** your CVs, profile and applications are stored only on your computer (`backend/data/` and `backend/careerpilot.db`, both git-ignored). Reading a CV with AI is opt-in: it sends the CV's text to the AI provider (on Google's free tier, prompts may be used to improve Google's products). The built-in CV reader works fully offline. Writing a cover letter sends your name, location, summary, skills, experience, education and project summaries plus the job details to the AI provider you choose; your email, phone and links are never sent. Choose **Ollama** in Settings to keep everything on your own computer. API keys live only in `.env` and are never in the database, the screens or a backup. The local server only answers requests from your own computer and from CareerPilot itself.

---

## License

[MIT](LICENSE)
