# CareerPilot ✈️

**Your personal job-application assistant. CareerPilot reads your job list from Excel, writes a tailored cover letter for every job using free AI, sends email applications for you (after you approve them), and tracks every application from "sent" to "offer".**

> 🚧 Status: early development. Phase 0 (project setup) is done, and Phase 1 (database) is next. See the [roadmap](#roadmap).

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
   - **Email jobs:** CareerPilot writes the email, attaches your letter and CV, and sends it from your own Gmail **after you click approve**. Sends are spaced out and capped each day so you never look like spam.
   - **Job-site jobs (LinkedIn, Indeed, company portals):** *Assisted apply.* CareerPilot copies your letter, gets your CV ready and opens the job page, then **you** click submit. It's fast and keeps your accounts safe.
5. **Track everything.** A board and a table show every application: *Imported → Drafted → Ready → Sent → Interview → Offer / Rejected*. CareerPilot notices replies, reminds you to follow up when a company goes quiet, shows your stats, and exports everything back to Excel.

---

## Features

| | Feature |
|---|---|
| 📥 | Excel / CSV import with automatic column matching and duplicate detection |
| 👤 | CV upload and parsing into a reusable profile (multiple CV versions supported) |
| ✍️ | AI cover letters tailored to each job, with tone options and version history |
| 📄 | Export letters to PDF and Word |
| 📤 | Approve-then-send email applications via Gmail, with daily limits |
| 🧭 | Assisted apply for job portals |
| 📊 | Dashboard, Kanban board and searchable table |
| 🔔 | Follow-up reminders and AI-drafted follow-up emails |
| 📬 | Reply detection from Gmail |
| 🔁 | Export your tracker to Excel any time |
| 🖥️ | Installable desktop app for Windows |

---

## Tech stack

| Area | Technology |
|---|---|
| AI | Google Gemini (free tier) · Groq (free tier) · Ollama (local, offline) |
| Frontend | React · TypeScript · Vite · Tailwind CSS · shadcn/ui · TanStack Query / Table |
| Backend | Python · FastAPI · pandas / openpyxl · SQLModel |
| Database | SQLite (a single local file) |
| Email | Gmail API (OAuth) / SMTP |
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

The full step-by-step plan for building CareerPilot. Each phase ends with something that works and can be demoed. Ticked boxes are done, and the progress log at the end records every change.

### Roadmap

| Phase | What gets built | Status |
|---|---|---|
| 0 | **Setup & foundations:** project skeleton, backend + frontend, linting, tests, CI | ✅ Done |
| 1 | **Database:** applications, profile, cover letters and email log stored in SQLite | ⏭️ Next |
| 2 | **Excel import:** upload a spreadsheet, match columns, skip duplicates, export back to Excel | ☐ Planned |
| 3 | **Profile & CV:** upload your CV and turn it into a reusable profile | ☐ Planned |
| 4 | **AI cover letters:** tailored letters from free AI, tones, versions, PDF/Word export | ☐ Planned |
| 5 | **User interface:** dashboard, applications table, Kanban board, letter editor | ☐ Planned |
| 6 | **Sending:** approve-then-send email via Gmail, daily limits, assisted apply for job sites | ☐ Planned |
| 7 | **Tracking:** status history, follow-up reminders, reply detection, stats | ☐ Planned |
| 8 | **Desktop app:** installable Windows app (Tauri) | ☐ Planned |
| 9 | **Polish & v1.0 release:** full tests, docs, installer on GitHub Releases | ☐ Planned |

*Rough estimates: each phase is about 1–7 days for one person working part-time.*

### Sending rules (decided)

1. **Email applications:** fully automated, but each one is personalised, sends are capped at about 20 a day with random gaps, and every send needs your approval.
2. **Job portals (LinkedIn, Indeed, Workday…):** Assisted apply only. The app prepares everything and **you** click submit.
3. **No bots on LinkedIn or Indeed, ever.**

### Phase 0: Setup & foundations

**Goal:** a clean project skeleton that anyone can run.

- [x] 0.1 GitHub repo with README (this file holds the full plan)
- [x] 0.2 Create folder structure:
  ```
  CareerPilot/
  ├── backend/                # FastAPI app (layered)
  │   ├── app/
  │   │   ├── main.py
  │   │   ├── api/            # routers: HTTP only
  │   │   ├── services/       # business logic
  │   │   ├── repositories/   # database access
  │   │   ├── models/         # SQLModel tables
  │   │   ├── schemas/        # request/response models
  │   │   ├── integrations/   # AI providers, Gmail
  │   │   └── core/           # config, db, security
  │   ├── tests/
  │   └── requirements.txt
  ├── frontend/               # React + Vite + TS (MVVM)
  │   └── src/
  │       ├── app/            # App shell, router, providers
  │       ├── features/<x>/   # api.ts (Model), useXViewModel.ts (ViewModel), XView.tsx (View)
  │       ├── components/ui/  # shadcn/ui components
  │       └── lib/            # api client, utils
  ├── desktop/                # Tauri config (Phase 8)
  ├── samples/                # sample Excel + sample CV for testing
  └── .github/workflows/      # CI
  ```
- [x] 0.3 Backend: Python 3.12+ venv, FastAPI, Uvicorn, a `/api/health` endpoint (typed `HealthResponse` schema, 1 pytest test)
- [x] 0.4 Frontend: React + TS on Vite 6 (Node 20.14 compatible), Tailwind v4 + shadcn/ui, React Router, TanStack Query. App shell with sidebar; Dashboard live, other pages show "Coming soon". MVVM example: `features/health/`.
- [x] 0.5 Config via `.env` (`GEMINI_API_KEY`, `AI_PROVIDER`, `DB_PATH`) plus a committed `.env.example`
- [x] 0.6 `.gitignore` (venv, node_modules, `.env`, `*.db`, uploads)
- [x] 0.7 Linting/formatting: **ruff** (Python), **ESLint + Prettier** (TS), Vitest for frontend tests
- [x] 0.8 GitHub Actions: lint, format check, tests and build on every push (first run passed)

**Done when:** `uvicorn` and `npm run dev` both start, and the frontend shows "Backend: Online" from `/api/health`. ✅ Verified 2026-11-05.

**Notes / follow-ups from Phase 0:**
- Node is 20.14, so Vite is pinned to v6. Upgrading Node to 22 LTS would allow Vite 7.
- ESLint 9.27 shows a deprecation notice. Bump it with the other dev deps at some point.

---

### Phase 1: Data model & database

**Goal:** decide *what* we store and store it.

- [ ] 1.1 Design tables (SQLModel):
  - **Profile**: name, email, phone, location, links (LinkedIn/GitHub/portfolio), summary, skills, cv_text, cv_file_path
  - **Application**: id, company, role, job_url, job_description, contact_name, contact_email, location, salary, source, **status**, priority, notes, applied_at, last_contact_at, follow_up_at, created_at
  - **CoverLetter**: id, application_id, content, tone, model_used, version, created_at
  - **EmailLog**: id, application_id, to, subject, body, attachments, sent_at, gmail_message_id, thread_id, status (queued/sent/failed/replied)
  - **ImportBatch**: id, filename, rows_total, rows_imported, rows_skipped, created_at
  - **StatusHistory**: application_id, from_status, to_status, changed_at
- [ ] 1.2 Status enum: `IMPORTED → DRAFTED → READY → SENT → FOLLOWED_UP → INTERVIEW → OFFER / REJECTED / WITHDRAWN`
- [ ] 1.3 SQLite connection + Alembic migrations
- [ ] 1.4 CRUD API: `GET/POST/PATCH/DELETE /applications`, `GET/PUT /profile`
- [ ] 1.5 Unit tests for the CRUD endpoints

**Done when:** you can create, list, update and delete applications via the auto-generated docs at `/docs`.

---

### Phase 2: Excel import

**Goal:** drop in an Excel file → every job is recorded in the system.

- [ ] 2.1 Endpoint `POST /imports/preview`: upload `.xlsx`/`.xls`/`.csv`, read with **pandas/openpyxl**, return headers + first 10 rows
- [ ] 2.2 **Smart column mapping**: auto-guess which column is Company, Role, Email, Link, Description… using fuzzy matching on header names (e.g. "Company Name", "Employer" → `company`)
- [ ] 2.3 Column-mapping screen in the UI so the user can confirm/fix the guesses (save the mapping for next time)
- [ ] 2.4 Endpoint `POST /imports/commit`: validate and clean the rows:
  - trim whitespace, validate emails & URLs
  - skip empty rows
  - **de-duplicate** (same company + role + URL already exists)
  - support multiple sheets (choose one)
- [ ] 2.5 Import summary: "48 imported, 2 duplicates skipped, 1 invalid email", with downloadable error rows
- [ ] 2.6 **Export** tracker back to `.xlsx` (`GET /applications/export`)
- [ ] 2.7 Provide `samples/jobs_template.xlsx` so users know the expected format
- [ ] 2.8 Tests with messy sample files (merged cells, blank rows, odd headers)

**Done when:** importing the sample Excel creates the correct applications with no duplicates.

---

### Phase 3: Profile & CV parsing

**Goal:** the AI knows who you are.

- [ ] 3.1 Upload CV (PDF via **pypdf**, DOCX via **python-docx**) and extract the text
- [ ] 3.2 Use the AI to turn raw CV text into **structured JSON** (skills, experience, education, projects)
- [ ] 3.3 Profile page where the user reviews/edits the parsed data
- [ ] 3.4 Store the original CV file to attach to emails later
- [ ] 3.5 Support multiple CV versions (e.g. "Frontend CV", "Data CV") and pick one per application

**Done when:** uploading a CV fills the profile page correctly.

---

### Phase 4: AI cover letter engine (free AI)

**Goal:** a high-quality, tailored cover letter for each job at $0.

- [ ] 4.1 **Provider interface** `AIProvider.generate(prompt, system, max_tokens)` with implementations:
  - `GeminiProvider` (default, free tier via Google AI Studio key)
  - `GroqProvider` (optional, free tier)
  - `OllamaProvider` (offline, local)
- [ ] 4.2 Settings: choose provider + model, test connection button
- [ ] 4.3 **Prompt design** (the key to quality):
  - system prompt: professional writer rules (no clichés, no made-up experience, 250–350 words, specific to the company)
  - inputs: profile JSON + job description + company + role + tone (formal / friendly / enthusiastic)
  - step 1: extract top requirements from the job description → step 2: match them to your real experience → step 3: write the letter
- [ ] 4.4 **Guardrails**: the AI may only use facts from your profile. Flag anything it seems to have invented.
- [ ] 4.5 Also generate the **email subject + short email body** that accompanies the letter
- [ ] 4.6 **Bulk generation** with a queue that respects free-tier rate limits (retry with backoff on 429 errors, progress bar)
- [ ] 4.7 Version history: regenerate, compare and keep the best version
- [ ] 4.8 Export letter to **PDF and DOCX** with a clean template
- [ ] 4.9 Optional: "match score" (how well your profile fits the job, 0–100) to help prioritise

**Done when:** clicking "Generate" produces a tailored, factual letter in under ~10 seconds, and bulk-generating 20 letters works without hitting errors.

---

### Phase 5: Frontend UI

**Goal:** a clean, pleasant app to use every day.

- [ ] 5.1 Layout: sidebar (Dashboard, Applications, Import, Profile, Settings) + top bar
- [ ] 5.2 **Dashboard**: totals by status, applications this week, response rate, upcoming follow-ups (Recharts)
- [ ] 5.3 **Applications table** (TanStack Table): search, filter by status, sort, multi-select bulk actions (generate letters, send, change status, delete)
- [ ] 5.4 **Kanban board** (dnd-kit): drag cards between statuses
- [ ] 5.5 **Application detail page**: job info, cover letter editor (rich text), email preview, timeline/history, notes
- [ ] 5.6 **Import wizard**: upload → map columns → preview → confirm → summary
- [ ] 5.7 **Profile & Settings** pages (AI provider, Gmail connection, send limits, follow-up days, signature)
- [ ] 5.8 Data fetching with **TanStack Query**, toasts for success/errors, loading skeletons
- [ ] 5.9 Dark mode + responsive layout

**Done when:** the full flow (import → generate → review) can be done in the UI without touching `/docs`.

---

### Phase 6: Sending applications

**Goal:** send real applications safely.

- [ ] 6.1 **Gmail OAuth** connection (Google Cloud project, free; scopes `gmail.send` + `gmail.readonly`). Store tokens in the OS keyring.
- [ ] 6.2 SMTP + Gmail App Password as a simpler alternative mode
- [ ] 6.3 Build the email: subject, body, cover letter (PDF) + CV attached, signature
- [ ] 6.4 **Review & approve** screen: nothing is sent without clicking "Approve & Send" (single or bulk)
- [ ] 6.5 **Send queue** with rate limit (e.g. max 20/day, a random 1–3 min gap between sends) to protect your account's reputation
- [ ] 6.6 Log every email in `EmailLog`, set status → `SENT`, record `applied_at`
- [ ] 6.7 Handle failures (bounced/invalid address) → status `FAILED` with a retry option
- [ ] 6.8 **Portal jobs** (no email): "Assisted apply" button that opens the job link, copies the letter to your clipboard, opens the CV folder, then asks "Did you submit?" → marks `SENT`
- [ ] 6.9 Test mode: send everything to your own address first

**Done when:** an approved application arrives in a real inbox with correct attachments and is logged as sent.

---

### Phase 7: Tracking & follow-ups

**Goal:** never lose track of an application.

- [ ] 7.1 Status history recorded on every change (timeline on the detail page)
- [ ] 7.2 **Follow-up rules**: if `SENT` and no reply after N days (default 7) → reminder + AI-drafted polite follow-up email (still requires approval)
- [ ] 7.3 **Reply detection**: poll Gmail threads (APScheduler, every 30 min) and mark `REPLIED`. Optionally ask the AI to classify the reply as interview / rejection / other.
- [ ] 7.4 Desktop notifications for follow-ups and replies
- [ ] 7.5 Stats: response rate, interview rate, average days to reply, best-performing tone/CV version
- [ ] 7.6 Calendar-style view of interviews and follow-ups

**Done when:** a sent application with no reply automatically surfaces as "Follow up today" after N days.

---

### Phase 8: Desktop app packaging

**Goal:** a real installable app.

- [ ] 8.1 Add **Tauri 2** around the built React frontend
- [ ] 8.2 Bundle the Python backend with **PyInstaller** as a Tauri **sidecar** that starts and stops with the app
- [ ] 8.3 Store the DB and files in the OS app-data folder (e.g. `%APPDATA%/CareerPilot`)
- [ ] 8.4 App icon, name and window settings; system-tray icon for background reminders
- [ ] 8.5 Build a Windows installer (`.msi`/`.exe`); macOS/Linux builds optional via GitHub Actions
- [ ] 8.6 Auto-update via Tauri updater + GitHub Releases (optional)

**Done when:** installing the `.exe` on a clean PC works without Python or Node installed.

---

### Phase 9: Polish, testing & release

- [ ] 9.1 Backend test coverage ≥ 70% (pytest): Excel import, AI provider mocks, email building
- [ ] 9.2 End-to-end test (Playwright): import → generate → approve → (mock) send
- [ ] 9.3 Security pass: no secrets in the repo, tokens in the keyring, validated inputs, file-size limits on uploads
- [ ] 9.4 Backup/restore of the database + "export all my data"
- [ ] 9.5 Docs: user guide with screenshots, how to get a free Gemini key, how to connect Gmail
- [ ] 9.6 Tag **v1.0.0** and publish the installer on GitHub Releases

---

### Future ideas (after v1)

- Job scraping from public job boards' RSS/APIs into the tracker
- Chrome extension: "Save this job to CareerPilot" from any job page
- AI interview-prep questions per application
- CV tailoring per job (not just the cover letter)
- Multi-language letters
- Optional cloud sync

---

### Key risks & how we handle them

| Risk | Mitigation |
|---|---|
| Free AI tier limits or terms change | Provider interface lets you switch to Groq/Ollama in Settings |
| AI invents experience in letters | Strict prompt + "facts only from profile" check + mandatory human review |
| Gmail flags you as spam | Daily limits, delays between sends, personalised content, approval before send |
| Job portals block bots | Don't automate portals. Use "Assisted apply" instead. |
| Messy Excel files | Column-mapping UI, validation, error report |
| Losing data | Local SQLite backups + Excel export |

---

### Progress log

| Date | What changed |
|---|---|
| 2026-11-05 | Plan written: tech stack, 10 phases, sending-safety rules, MVVM + layered architecture. |
| 2026-11-05 | **Phase 0 done.** FastAPI backend with `/api/health`, React MVVM frontend with sidebar and dashboard, ruff/ESLint/Prettier, pytest + Vitest, GitHub Actions CI (passing). Repo: `adss0/CareerPilot`. |
| 2026-11-05 | Full development plan moved into this README. |

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

Get a free Gemini API key at <https://aistudio.google.com/apikey> and put it in `backend/.env`.

---

## Responsible use

CareerPilot is built to help you apply **better**, not to spam employers:

- Every email is personalised and needs your approval.
- Daily send limits and delays protect your email account.
- There's no automated submitting on LinkedIn, Indeed or other job portals, which ban bots in their terms.
- The AI only uses facts from your own CV. Always read your letter before sending it.

---

## License

[MIT](LICENSE)
