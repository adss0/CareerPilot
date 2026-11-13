# CareerPilot: Development Plan

The step-by-step plan for building CareerPilot, from an empty repo to an installable desktop app. Each phase ends with something that works and can be demoed. Ticked boxes are done, and the progress log at the end records every change.

← Back to the [README](README.md)

---

## Roadmap

| Phase | What gets built | Status |
|---|---|---|
| 0 | **Setup & foundations:** project skeleton, backend + frontend, linting, tests, CI | ✅ Done |
| 1 | **Database:** applications, profile, cover letters and email log stored in SQLite | ✅ Done |
| 2 | **Excel import:** upload a spreadsheet, match columns, skip duplicates, export back to Excel | ✅ Done |
| 3 | **Profile & CV:** upload your CV and turn it into a reusable profile | ✅ Done |
| 4 | **AI cover letters:** tailored letters from free AI, tones, versions, PDF/Word export | ✅ Done |
| 5 | **User interface:** dashboard, applications table, Kanban board, letter editor | ✅ Done |
| 6 | **Sending:** approve-then-send email via Gmail, daily limits, assisted apply for job sites | ✅ Done |
| 7 | **Tracking:** status history, follow-up reminders, reply detection, stats | ✅ Done |
| 8 | **Desktop app:** installable Windows app (Tauri) | ✅ Done |
| 9 | **Polish & v1.0 release:** full tests, docs, installer on GitHub Releases | ✅ Done (tag & publish left to you) |
| 13 | **v1.4 Stages, deleting, links, updates:** interview stages column, delete selected / all with a 30-day recycle bin, add a job from just its link, signed auto-updates, desktop link fix | ✅ Done |
| 12 | **v1.3 More boards, shortlist, deadlines, new look:** Jooble, other-site searches, add a job from any site, shortlist, deadlines due, hide closed, bold modern restyle | ✅ Done |
| 11 | **v1.2 Find jobs & Apply:** job-board search with AI summaries, a spreadsheet-style tracker, a one-page Apply flow, CV reader fixes | ✅ Done |
| 10 | **v1.1 Tailored documents:** CV tailored per job, letter highlights, Word + PDF saved to Documents, keys in Settings, import your own tracker | ✅ Done |

*Rough estimates: each phase is about 1–7 days for one person working part-time.*

## Sending rules (decided)

1. **Email applications:** fully automated, but each one is personalised, sends are capped at about 20 a day with random gaps, and every send needs your approval.
2. **Job portals (LinkedIn, Indeed, Workday…):** Assisted apply only. The app prepares everything and **you** click submit.
3. **No bots on LinkedIn or Indeed, ever.**

## Phase 0: Setup & foundations

**Goal:** a clean project skeleton that anyone can run.

- [x] 0.1 GitHub repo with README and this PLAN.md
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

## Phase 1: Data model & database

**Goal:** decide *what* we store and store it.

- [x] 1.1 Design tables (SQLModel, in `backend/app/models/tables.py`):
  - **Profile**: name, email, phone, location, links (LinkedIn/GitHub/portfolio), summary, skills, cv_text, cv_file_path (a single row)
  - **Application**: id, company, role, job_url, job_description, contact_name, contact_email, location, salary, source, **status**, priority (0–3), notes, import_batch_id, applied_at, last_contact_at, follow_up_at, created_at, updated_at
  - **CoverLetter**: id, application_id, content, tone, model_used, version, created_at
  - **EmailLog**: id, application_id, to_address, subject, body, attachments, sent_at, gmail_message_id, thread_id, status (queued/sent/failed/replied)
  - **ImportBatch**: id, filename, rows_total, rows_imported, rows_skipped, created_at
  - **StatusHistory**: application_id, from_status, to_status, changed_at
  - Deleting an application also deletes its letters, emails and history (foreign keys with `ON DELETE CASCADE`, enforced in SQLite)
- [x] 1.2 Status enum: `IMPORTED → DRAFTED → READY → SENT → FOLLOWED_UP → INTERVIEW → OFFER / REJECTED / WITHDRAWN`
- [x] 1.3 SQLite connection + Alembic migrations. Migrations run automatically when the backend starts. The DB file lives in `backend/` and is git-ignored.
- [x] 1.4 CRUD API: `GET/POST/PATCH/DELETE /api/applications` (with status filter, search and paging), `GET /api/applications/{id}/history`, `GET/PUT /api/profile`
  - Changing status records a history row. Moving to `SENT` sets `applied_at`.
  - The profile API never returns the raw CV text (it returns `has_cv` instead).
- [x] 1.5 Tests (16 passing): CRUD, validation, filters, paging, status history, cascade delete, 404s, profile, and a check that migrations match the models. All test data is fake (`@example.com`).

**Done when:** you can create, list, update and delete applications via the auto-generated docs at `/docs`. ✅ Verified 2026-11-05 against a real database file.

**Notes from Phase 1:**
- New dependencies, all with permissive licences compatible with MIT: SQLModel (MIT), SQLAlchemy (MIT), Alembic (MIT), email-validator (Unlicense).
- Changing a model now needs a migration: `alembic revision --autogenerate -m "..."` in `backend/`. A test fails if you forget.

---

## Phase 2: Excel import

**Goal:** drop in an Excel file → every job is recorded in the system.

- [x] 2.1 Endpoint `POST /api/imports/preview`: upload `.xlsx`/`.xls`/`.csv` (max 5 MB, 5,000 rows) and get back the headers, the first 10 rows, the sheet list and a suggested mapping
  - Read with **openpyxl** (`.xlsx`), **xlrd** (`.xls`) and Python's `csv` module (any delimiter, UTF-8 or Windows encoding). This replaced pandas: it's ~30 MB lighter for the desktop installer, and pandas wasn't needed.
  - Formulas are never run (cached values only), and **defusedxml** protects against malicious Excel files.
  - Handles blank rows above or inside the table, empty or duplicate header names, numbers and dates.
- [x] 2.2 **Smart column mapping**: synonyms ("Employer" → company, "E-mail" → contact email), typo-tolerant fuzzy matching ("Compnay"), and a check of cell contents when headers don't help (a column full of emails or links)
- [x] 2.3 Column-mapping screen in the UI (MVVM: `features/imports/`): upload by drag-and-drop or button → match columns with a live preview → result. The choices are remembered in the browser for the next file with the same layout (column names only, never data).
- [x] 2.4 Endpoint `POST /api/imports/commit`: validates and cleans the rows:
  - trims whitespace, validates emails (invalid → left out with a warning), fixes links (`example.com/job` → `https://…`) and drops anything that isn't http(s), such as `javascript:` links
  - skips empty rows; skips rows missing company or role (reported)
  - **de-duplicates** case-insensitively on company + role + link, against the tracker *and* within the file
  - supports multiple sheets (choose one); records an `ImportBatch`, and each new application gets `source = excel` and a status-history row
- [x] 2.5 Import summary: imported / duplicates / invalid / values fixed, plus a table of rows that need a look, downloadable as CSV
- [x] 2.6 **Export** the tracker to `.xlsx` (`GET /api/applications/export`, optional `?status=` filter). Styled header, filters and frozen first row. Cell text that could run as a formula is neutralised (formula-injection protection). An exported file can be re-imported without creating duplicates.
- [x] 2.7 `samples/jobs_template.xlsx` (also downloadable in the app via `GET /api/imports/template`), with fake example rows and a "How to use" sheet
- [x] 2.8 Tests with messy, fake spreadsheets built in memory: blank rows, odd and duplicate headers, typos, semicolon CSVs, Windows encoding, broken files, size and row limits, bad mappings, duplicates, round-trip export → import. 52 backend + 10 frontend tests.

**Done when:** importing the sample Excel creates the correct applications with no duplicates. ✅ Verified 2026-11-06 in the browser: a messy CSV imported 3 of 5 rows (1 invalid, 1 duplicate, 2 values fixed), and re-importing it added nothing.

**Notes from Phase 2:**
- New dependencies (all permissive licences): openpyxl (MIT), xlrd (BSD), defusedxml (PSF), python-multipart (Apache-2.0).
- The dashboard now shows real application counts.
- Fixed a layout bug where wide tables pushed the page wider than the window.

---

## Phase 3: Profile & CV parsing

**Goal:** the AI knows who you are.

- [x] 3.1 Upload a CV (`POST /api/cvs`, max 5 MB) and extract the text: PDF via **pypdf** (password-protected PDFs and PDFs over 30 pages rejected), DOCX via **python-docx** (including text inside tables), and `.txt`
- [x] 3.2 Turn the CV text into **structured JSON** (contact details, summary, skills, experience, education, projects). It works two ways:
  - **Built-in reader (default, offline, free):** finds contact details and common section headings ("Experience", "Key skills"…) and splits entries by dates. No AI needed.
  - **AI reader (optional, Gemini):** opt-in per upload, because it sends the CV text to Google. On the free tier, Google may use prompts to improve its products, and the UI says so.
    - **Guardrails:** the CV is passed as data (prompt-injection safe), and contact details and skills that don't appear in the CV are removed, with a warning.
    - **Fallback:** if AI fails (no key, rate limit, network), the built-in reader is used and the user is told why.
    - `GEMINI_MODEL` defaults to `gemini-flash-latest`. ⚠️ Not yet tested against the live Gemini API (no key configured); the request/response handling is covered by mocked tests.
- [x] 3.3 Profile page (MVVM: `features/profile/`): edit all details, skills as chips, and add/remove experience, education and project entries. Filling from a CV **merges** into the form (it never wipes what you typed) and shows what to check. An unsaved-changes bar and a browser warning stop you losing edits.
- [x] 3.4 Original CV stored in `backend/data/cvs/` (git-ignored) under a random file name; downloadable with its original name (`GET /api/cvs/{id}/file`)
- [x] 3.5 Multiple CV versions: rename, make default, delete (the default moves to another CV), and re-fill the profile from any CV. Each application has a `cv_id` (API ready; the picker UI comes with the applications page in Phase 5). Deleting a CV clears it from applications.

**Done when:** uploading a CV fills the profile page correctly. ✅ Verified 2026-11-06 in the browser: a fake CV filled the name, contact details, location, summary, 6 skills, 2 jobs, education and a project correctly. Saved, reloaded and downloaded. Also checked at phone width.

**Notes from Phase 3:**
- **Data-loss bug caught and fixed:** SQLite migrations that rebuild a table were cascade-deleting related rows (status history etc.). Migrations now run with foreign keys off, and a test upgrades a database containing data to prove nothing is lost.
- Part of 4.1 (the provider interface plus Gemini) was built early because CV reading needed it. Groq and Ollama come in Phase 4.
- New dependencies (permissive licences): pypdf (BSD), python-docx (MIT), lxml (BSD), httpx (BSD).
- The profile no longer stores raw CV text; it lives with each CV in the new `cvdocument` table.

---

## Phase 4: AI cover letter engine (free AI)

**Goal:** a high-quality, tailored cover letter for each job at $0.

- [x] 4.1 **Provider interface** `AIProvider.generate_json(system, prompt)` in `backend/app/integrations/ai/`, with:
  - `GeminiProvider` (default, free tier; model `gemini-flash-latest`)
  - `GroqProvider` (free tier, OpenAI-compatible API; model `llama-3.3-70b-versatile`)
  - `OllamaProvider` (offline, on your computer; model `llama3.2`)
  - Shared error handling. A rate limit raises `AIRateLimitError` (HTTP 429, retryable); other problems raise `AIError` (HTTP 503) with a friendly message. API keys are sent in headers, never in URLs.
- [x] 4.2 **Settings page:** choose the provider and model, plus the pause between bulk letters, with a **Test connection** button. Stored in a new `appsetting` table. **API keys stay in `backend/.env`** and are never stored in the database or shown in the UI.
- [x] 4.3 **Prompt design:** one call per letter, to save free-tier quota. The AI lists the job's key requirements, matches each to real evidence in the profile, then writes 250–350 words in the chosen tone (formal / friendly / enthusiastic), with no clichés and matching UK/US spelling, plus optional extra instructions (max 500 chars).
  - **Privacy:** only name, location, summary, skills, experience, education and project summaries are sent. **Email, phone and links are never sent to the AI.**
  - **Prompt-injection safe:** the profile and job are passed as data in tags, and instructions inside them are ignored.
- [x] 4.4 **Guardrails:** after writing, every letter is checked for numbers (e.g. "40%", "12 clients") and names, tools or acronyms (e.g. "Kubernetes", "AWS") that appear in neither the profile nor the job, and for leftover [placeholders]. These are shown as **"Check these before sending"** and re-checked after you edit. A missing job description is flagged too.
- [x] 4.5 **Email subject + short email body** generated with each letter (both editable)
- [x] 4.6 **Bulk generation** (`POST /api/letters/bulk`, up to 200): a background queue that writes **one letter at a time**, pauses between AI calls (default 4s, set in Settings) and retries rate limits with growing waits (15s → 30s → 60s). It can skip jobs that already have a letter, and you can cancel it. The Applications page shows a live progress bar and the failures. An empty profile or missing AI stops the job with a clear message.
- [x] 4.7 **Version history:** every "Write letter" adds a new version (v1, v2…). Switch between versions, edit them, choose which one to send (starred), and delete versions.
- [x] 4.8 **Export to PDF** (reportlab) and **Word** (python-docx): a clean template with your name, contact line and date, saved as "Cover letter - Company - Role".
- [x] 4.9 **Match score** (0–100) with the matched requirements and evidence, shown on the application and in the list

**Done when:** clicking "Generate" produces a tailored, factual letter in under ~10 seconds, and bulk-generating 20 letters works without hitting errors. ✅ Verified 2026-11-10 in the browser **against a fake Ollama-compatible AI server** (which exercises the real HTTP provider code). The flow worked: Settings → Test connection → write a letter (guardrail flagged an invented "Kubernetes") → edit (flag cleared) → PDF/Word export → bulk-write 3 jobs (1 skipped, 2 written, live progress).
- ⚠️ **Not yet tested with a real AI model.** No Gemini or Groq key is set and Ollama isn't installed. Letter *quality* and real response times still need checking once a provider is set up.

**Notes from Phase 4:**
- A basic **Applications list** (search, status filter, paging, multi-select, bulk letters) and an **application page** (job info, letter editor, versions, match card) were built now, because letters need somewhere to live. Phase 5 upgrades them (sorting, Kanban, timeline, notes).
- Fixed an old test that used the real local database; tests now never read `backend/.env` or call a real AI.
- New dependency: reportlab (BSD).

---

## Phase 5: Frontend UI

**Goal:** a clean, pleasant app to use every day.

- [x] 5.1 Layout: sidebar (Dashboard, Applications, Import, Profile, Settings). *(Done in Phase 0; every page is now real.)*
- [x] 5.2 **Dashboard** (`GET /api/stats`): tiles for total, sent, interviews and response rate; bar charts by status and jobs added per week (Recharts, theme-aware colours); follow-ups due in the next 7 days (overdue highlighted).
- [x] 5.3 **Applications table:** search, status filter, **sorting** (job, status, added; a whitelist so only known columns can be sorted), paging, multi-select, and bulk actions: write letters, **move to a status** (recorded in history), **delete** (with confirmation). Bulk endpoint: `POST /api/applications/bulk`. *Used a hand-built table instead of TanStack Table: sorting is done on the server, so the extra library wasn't needed.*
- [x] 5.4 **Kanban board** (dnd-kit): a column per status; drag a card to change its status, saved instantly with automatic rollback on error. Works with **mouse, touch and keyboard** (space to pick up, one arrow press = one column, space to drop). Mouse drops land exactly under the pointer. Shows the 200 most recently updated jobs. Table/Board choice is remembered.
- [x] 5.5 **Application page:** tabs for *Cover letter* (from Phase 4) and *Details & timeline*: edit every job field with validation (http(s) links only, email format), status, priority, **notes**, **which CV to send**, a **status timeline**, and delete the job. **Add job** page for one-off jobs (`/applications/new`). *The letter editor is plain text, not rich text: letters go out as plain text or PDF/Word, so formatting would get lost.* The email preview comes with sending in Phase 6.
- [x] 5.6 **Import wizard**: upload → map columns → preview → confirm → summary. *(Done in Phase 2.)*
- [x] 5.7 **Profile & Settings** pages (AI provider, email connection, send limits, follow-up days, signature). *(Profile: Phase 3. AI: Phase 4. Email, limits, signature and follow-up days: Phase 6.)*
- [x] 5.8 Data fetching with **TanStack Query**, **toasts** (sonner) for success and errors, **loading skeletons** on the dashboard and lists
- [x] 5.9 **Dark mode** (light / dark / system, remembered, applied before the first paint so there's no white flash) + responsive layout (every page checked at 375px phone width)

**Done when:** the full flow (import → generate → review) can be done in the UI without touching `/docs`. ✅ Verified 2026-11-11 in the browser: dashboard tiles and charts, sorting both ways, Kanban moves by keyboard and by mouse (both saved), edit details with validation and a timeline entry, add job, bulk delete, dark mode, and every page at phone width.

**Notes from Phase 5:**
- Bugs found and fixed while testing: chart bars were invisible (SVG attributes can't use CSS variables, so charts now read the theme's real colours); keyboard moves on the board only shifted 25px per press (now one column per press); mouse drops could land one column off (now uses the pointer position).
- New frontend dependencies (all MIT): recharts, @dnd-kit/core, sonner.

---

## Phase 6: Sending applications

**Goal:** send real applications safely.

- [ ] 6.1 **Gmail OAuth** connection. *Not built, on purpose: it would make every user create a Google Cloud project, consent screen and client secret before sending anything. 6.2 does the same job with a 2-minute App Password setup, and also works with Outlook and other providers. Gmail OAuth stays an optional future idea.*
- [x] 6.2 **SMTP + App Password** (main path): STARTTLS / SSL; unencrypted is only allowed to `localhost`. The password lives in `backend/.env` as `EMAIL_PASSWORD` and is never stored in the database or shown in the UI. Settings page: Gmail/Outlook presets, App Password guide, **Test connection**. IMAP server settings are stored for reply detection (Phase 7).
- [x] 6.3 Build the email: subject + short email from the starred letter, your **signature**, the **cover letter as PDF** and **your CV** (the job's chosen CV, or the default) attached. Unique Message-ID per email (for matching replies later). Header injection blocked.
- [x] 6.4 **Review & approve:** the job page's new **Apply** tab shows exactly what will be sent (to, subject, message, attachments, warnings). Nothing is queued without ticking *"I've read it"* and clicking **Approve & send**; the API also requires `confirm: true`. **Bulk:** select jobs → *Send emails* → confirm (skipped jobs are listed with the reason).
- [x] 6.5 **Send queue:** a background worker sends **one email at a time**, with a **random pause** (default 60–180s) and a **daily limit** (default 20). The Applications page shows a queue banner (waiting, sent today, next send, test mode).
- [x] 6.6 Every email is logged (`emaillog`). On a real send the job moves to **Sent** (recorded in the timeline) with `applied_at` and `last_contact_at`.
- [x] 6.7 Failures (bad password, can't connect, refused address) are logged with a friendly reason; **Retry** and **Cancel** buttons.
- [x] 6.8 **Assisted apply** for website-only jobs: copy letter → download CV → open the posting (http(s) links only, opened safely) → *"I've submitted it"* marks the job as Sent.
- [x] 6.9 **Test mode, ON by default:** every email goes to your own (or a test) address with `[TEST]` in the subject, and jobs don't change status, until you switch it off in Settings.

**Done when:** an approved application arrives in a real inbox with correct attachments and is logged as sent. ✅ Verified 2026-11-11 against a **local test mail server** (real SMTP, nothing left the computer):
- Settings → Test connection said "Connected".
- Approve & send in test mode delivered to the test address with `[TEST]`, the PDF letter and the CV attached, and the job didn't change status.
- With test mode off, a bulk send delivered 2 emails to the employers' addresses, both jobs moved to Sent, and the portal-only job was skipped with a reason.
- Assisted apply marked a job as Sent.
- ⚠️ Not yet sent through a real Gmail/Outlook account (no `EMAIL_PASSWORD` set).

**Notes from Phase 6:**
- New test-only dependency: aiosmtpd (Apache-2.0), a local mail server that lets the tests do a real SMTP round trip.
- `emaillog` gained kind, test flag, Message-ID, In-Reply-To and error fields (migration with safe defaults).

---

## Phase 7: Tracking & follow-ups

**Goal:** never lose track of an application.

- [x] 7.1 Status history recorded on every change, shown as a timeline on the job page *(Phase 5)*. New **Replied** status, plus an **interview date** on each job.
- [x] 7.2 **Follow-ups:** a real send sets the follow-up date (default 7 days, set in Settings). The job's Apply tab offers **Draft a follow-up**: written by AI if it's set up, otherwise by a free built-in template (greets the contact by name, mentions the role, company and send date). Editable, needs approval, and goes through the same queue **as a reply in the same email thread** (In-Reply-To / References). Sending it moves the job to *Followed up*.
- [x] 7.3 **Reply detection over IMAP** (same App Password), **read-only** (nothing is marked as read):
  - checks every 30 minutes, plus **Check replies now** on the dashboard
  - matches replies by **thread** (In-Reply-To/References to our Message-IDs) or by **sender** = the employer you emailed (only after you sent, only for real sends)
  - ignores your own sent copies and never counts the same reply twice
  - a matched reply moves the job to **Replied**, clears its follow-up and records `last_contact_at`
  - each reply is **classified** (interview / rejection / other) with keywords, as a **suggestion only**: buttons let *you* mark the job as Interview or Rejected
  - the start of each reply is kept locally so you can read it in the app
- [x] 7.4 **Desktop notifications** (browser Notification API, opt-in in Settings) when new replies arrive or follow-ups become due, plus an unread-replies badge in the sidebar. *Native OS notifications come with the desktop app (Phase 8).*
- [x] 7.5 **Insights** on the dashboard: average days until employers reply, and response rate **by letter tone** and **by CV**. *Replied* now counts as a response.
- [x] 7.6 **Calendar** page: month grid (Monday first) of interviews (with time) and follow-ups due, linking to each job; a simple list on phones.

**Done when:** a sent application with no reply automatically surfaces as "Follow up today" after N days. ✅ Verified 2026-11-12 in the browser:
- A real send (to a local test mail server) set the follow-up date 7 days ahead.
- Draft a follow-up gave a correct template, sent as "Re: …" with no attachments, and the job moved to *Followed up*.
- The interview date showed on the calendar.
- The dashboard insights showed rates by tone and CV, and "Check replies now" gave a friendly error when the inbox can't be reached.
- ⚠️ Reply detection was tested with a fake inbox and a fake IMAP server in the automated tests, not against a real Gmail/Outlook inbox (no `EMAIL_PASSWORD` set).

---

## Phase 8: Desktop app packaging

**Goal:** a real installable app.

- [x] 8.1 **Tauri 2** project in `desktop/`: a window around the built frontend (`npm run build:desktop`: talks to `127.0.0.1:8765`, uses `#/` routes). Web links open in your normal browser (opener plugin). Downloads are saved directly. Only one copy can run at a time (single-instance plugin). Strict content security policy.
- [x] 8.2 **Backend bundled with PyInstaller** into one `careerpilot-server.exe` (`backend/careerpilot-server.spec`, ~39 MB), started by the app as a **sidecar** on `127.0.0.1` only and stopped when the app closes.
  - **Bug found and fixed:** a one-file bundle runs as two processes, and killing the launcher left the server running and holding the port. The server now watches the app's process ID and exits within 2 seconds if the app goes away (even after a crash).
  - **Bug found and fixed:** with no console, logging crashed at start-up behind an invisible "Unhandled exception" dialog. Output now goes to `careerpilot-server.log` in the data folder.
- [x] 8.3 Database, CVs, `.env` and the log live in the app-data folder (`%APPDATA%\app.careerpilot.desktop`), set via `CAREERPILOT_HOME`. Development still uses `backend/`.
- [x] 8.4 App name, icon (generated from `desktop/app-icon.png`) and window size. *No tray icon: reminders and notifications come from the open app window (Phase 7). A tray icon to keep it running in the background is a future idea.*
- [x] 8.5 **Windows installer built by GitHub Actions** (`.github/workflows/desktop.yml`) on `windows-latest`: build backend exe → **smoke-test it** → build desktop frontend → `tauri build` (NSIS `.exe` + `.msi`, per-user install). The installer is attached to the run as an artifact; pushing a tag like `v1.0.0` also creates a **draft GitHub Release**. *Built in CI because Rust isn't installed on this PC. macOS/Linux builds are possible later.*
- [ ] 8.6 Auto-update via Tauri updater + GitHub Releases (optional). *Not done: it needs a signing key pair; the plan is to add it after v1.0.*

**Done when:** installing the `.exe` on a clean PC works without Python or Node installed.
- ✅ Verified 2026-11-12: the bundled `careerpilot-server.exe` runs **without Python**: it started with a fresh data folder, ran migrations, imported Excel, read a Word CV, and exported a letter as PDF and Word. With no console it starts cleanly and logs to a file, and it exits within 4 seconds once its parent app closes.
- ⚠️ The full installer is built and smoke-tested by GitHub Actions. Installing it on a clean PC is part of the release check in Phase 9.

---

## Phase 9: Polish, testing & release

- [x] 9.1 Backend test coverage ≥ 70% (pytest): Excel import, AI provider mocks, email building. *174 tests at 95% coverage; CI now fails if coverage drops below 85%.*
- [x] 9.2 End-to-end test (Playwright): import → generate → approve → (mock) send. *Runs in CI against the real backend, a fake AI and a local test mail server; it caught a stale-preview bug on the Apply tab, now fixed.*
- [x] 9.3 Security pass: no secrets in the repo, validated inputs, file-size limits on uploads. *Added a required `X-CareerPilot` header on changes (stops other websites from using the local server), a local-host-only check (DNS rebinding), security headers and a strict CORS list; upgraded Starlette, FastAPI, python-multipart, React Router, Vite and dev tools (pip-audit and npm audit clean). Secrets stay in the `.env` file rather than the OS keyring: they never reach the database, UI, logs or backups.*
- [x] 9.4 Backup/restore of the database + "export all my data". *One `.zip` with the database and CVs (never `.env`); restore is checked (size, file names, integrity) and applied on restart, after moving current data to `backups/`.*
- [x] 9.5 Docs: user guide, how to get a free Gemini key, how to connect Gmail. *[docs/USER_GUIDE.md](docs/USER_GUIDE.md) and [CHANGELOG.md](CHANGELOG.md). Screenshots still to add.*
- [ ] 9.6 Tag **v1.0.0** and publish the installer on GitHub Releases. *Version is 1.0.0 everywhere. Left to you: after merging, push the `v1.0.0` tag; the Desktop app workflow builds the installer and creates a draft Release to check and publish.*

---

## Phase 10: Tailored documents (v1.1)

- [x] 10.1 **Import your own tracker:** find the header row under titles and totals; import **Status** (Applied → Sent, Rejected, Interview, Offer…) and **Application deadline**; keep unmatched columns in notes. Fixed "Application Deadline" being guessed as the job link.
- [x] 10.2 **Keys & passwords in Settings:** Gemini, Groq and email App Password are written to `.env` (never the database or a backup), applied without a restart, and never sent back to the screen.
- [x] 10.3 **Tailored CV per job:** AI rewrites the summary and bullets and reorders skills, experience and projects. Titles, employers, dates, education and skill names are copied from the profile in code; made-up skills are dropped; the guardrail flags numbers and names that aren't in the profile. Editable; Word/PDF export; attached to the email instead of the uploaded CV.
- [x] 10.4 **Cover letter highlights:** tick skills, projects or jobs from the profile for the letter to focus on.
- [x] 10.5 **Saved documents folder:** Word + PDF of every tailored CV and letter in `Documents\CareerPilot\CVs\<Company>` and `…\Cover Letters\<Company>` (Windows known-folder lookup, so OneDrive works). Configurable folder, auto-save toggle, "Open folder" in File Explorer. Program Files isn't used: it needs admin rights.
- [x] 10.6 Install the v1.1 desktop app on the owner's PC (installer from the GitHub Actions build).

---

## Phase 11: Find jobs & Apply (v1.2)

- [x] 11.1 **CV reader fixes:** LaTeX small-caps glyph names (`/n.sc`) turned back into letters, ligatures and kerning gaps fixed; undated projects split; skills taken from project lines; "Extra-curricular" isn't a project; ".Net" kept; education with the university first.
- [x] 11.2 **Tracker like the owner's spreadsheet:** new fields (application deadline, pre-assessment, assessment deadline), a computed **Next step**, a totals bar, in-place editing with colour coding, a side panel with the job summary, and the same columns in the Excel export. "Imported" → **To apply**, "Sent" → **Applied**.
- [x] 11.3 **Find jobs:** Reed and Adzuna official APIs (free keys, pasted in Settings), duplicates across boards merged, an AI summary per job (salary, must-haves, match, strengths, gaps), **Apply** saves the job to the tracker. No scraping and nothing submitted to any site.
- [x] 11.4 **Apply page:** build the tailored CV and letter in one click, preview the PDFs, download Word/PDF, save to the documents folder or make it the main CV, open the job page with one-click copy for every detail, mark as applied. Filling in the employer's own form isn't possible from the app (it would need a browser extension).
- [x] 11.5 Tests: 232 backend, 65 frontend, 3 end-to-end (tracker import; find → summary → build → preview → save → apply; email). `npm run demo` for a safe demo.

---

## Phase 12: More boards, shortlist, deadlines and a new look (v1.3)

- [x] 12.1 **Jooble** board (official API, free key). Gradcracker and The Trackr have no public API and scraping breaks their terms, so: one-click site searches (Gradcracker, The Trackr, Bright Network, Prospects, TARGETjobs) and **Add a job from any site** (paste link + ad; AI reads the company, role, salary, location and closing date).
- [x] 12.2 **Shortlist** (new `savedjob` table): star jobs, kept across restarts with their summary; Apply works from it.
- [x] 12.3 **Deadlines and assessments due**: chips in the tracker, a **Due this week** dashboard card, `/api/applications/due`.
- [x] 12.4 **Hide closed** jobs in the tracker.
- [x] 12.5 **Bold modern restyle**: navy sidebar, teal accent, Plus Jakarta Sans (bundled, OFL), cards with depth, colour-coded statuses and totals.
- [x] 12.6 Full re-test: 240 backend, 65 frontend, 6 end-to-end tests (every page loads without console errors). Fixed: missing job-board key fields in Settings, a profile-creation race on a new database, more CV layouts.

---

## Phase 13: Stages, deleting, links and updates (v1.4)

- [x] 13.1 **Interview stages** (`stages` JSON on the job; migration converts each pre-assessment into an "Online test" stage, then drops the old columns). Sheet chips with an editor; Next step, Due this week and totals use the stages.
- [x] 13.2 **Deleting**: tick rows + Delete selected; Delete all (typed DELETE, backup first); **recycle bin** (`recycledapplication` table: a JSON snapshot of the job, letters, tailored CV, history, emails and replies; restored with fresh ids; 30 days).
- [x] 13.3 **Add a job from its link**: fetches that one page (public addresses only, redirects re-checked, 3 MB, no crawling), reads schema.org JobPosting data, else the page text.
- [x] 13.4 **Signed auto-updates** (Tauri updater + process plugins; GitHub Releases `latest.json`; the backend sidecar is stopped before the installer runs). Needs the `TAURI_SIGNING_PRIVATE_KEY` repository secret.
- [x] 13.5 **Fixed**: links didn't open in the desktop app (the shell plugin's click handler ran first and its "open" isn't allowed).
- [x] 13.6 Tests: 263 backend, 69 frontend, 7 end-to-end.

---

## Future ideas (after v1)

- Job scraping from public job boards' RSS/APIs into the tracker
- Chrome extension: "Save this job to CareerPilot" from any job page
- AI interview-prep questions per application
- Multi-language letters
- Optional cloud sync

---

## Key risks & how we handle them

| Risk | Mitigation |
|---|---|
| Free AI tier limits or terms change | Provider interface lets you switch to Groq/Ollama in Settings |
| AI invents experience in letters | Strict prompt + "facts only from profile" check + mandatory human review |
| Gmail flags you as spam | Daily limits, delays between sends, personalised content, approval before send |
| Job portals block bots | Don't automate portals. Use "Assisted apply" instead. |
| Messy Excel files | Column-mapping UI, validation, error report |
| Losing data | Local SQLite backups + Excel export |

---

## Progress log

| Date | What changed |
|---|---|
| 2026-11-05 | Plan written: tech stack, 10 phases, sending-safety rules, MVVM + layered architecture. |
| 2026-11-05 | **Phase 0 done.** FastAPI backend with `/api/health`, React MVVM frontend with sidebar and dashboard, ruff/ESLint/Prettier, pytest + Vitest, GitHub Actions CI (passing). Repo: `adss0/CareerPilot`. |
| 2026-11-05 | Full development plan moved into the README. |
| 2026-11-05 | Plan moved to its own `PLAN.md`; the README links to it. |
| 2026-11-05 | **Phase 1 done.** SQLite database with 6 tables and Alembic migrations, CRUD API for applications (with status history) and profile, 16 backend tests. |
| 2026-11-06 | **Phase 2 done.** Excel/CSV import with smart column matching, cleaning and duplicate detection, an import wizard UI, Excel export, a template, and real counts on the dashboard. 52 backend + 10 frontend tests. |
| 2026-11-06 | **Phase 3 done.** CV upload (PDF/Word/text) with a built-in offline reader and optional Gemini AI reader with guardrails, multiple CV versions, and a full Profile page. Fixed a migration data-loss bug. 85 backend + 16 frontend tests. |
| 2026-11-10 | Phase 3 landed on the Phase 2 branch instead of `main` (stacked PR). Fixed with a new PR into `main`. |
| 2026-11-10 | **Phase 4 done.** Cover letters with Gemini, Groq or Ollama; settings page with connection test; guardrail flags; email subject and body; versions; PDF and Word export; match score; background bulk writing with rate-limit retries; applications list and application page. 118 backend + 24 frontend tests. Not yet tried with a real AI model. |
| 2026-11-11 | **Phase 5 done.** Dashboard charts and stats, sorting, bulk status and delete, Kanban board (mouse, touch, keyboard), add/edit job, notes, CV picker, timeline, toasts, skeletons, dark mode. 123 backend + 32 frontend tests. |
| 2026-11-11 | **Phase 6 done.** Approve-then-send email over SMTP (App Password), test mode on by default, review screen, bulk send, background queue with random gaps and a daily limit, retry and cancel, assisted apply, email settings page. 139 backend + 40 frontend tests. Gmail OAuth deliberately skipped (see 6.1). |
| 2026-11-12 | **Phase 7 done.** Follow-ups (AI or template, threaded, approved), IMAP reply detection with suggested classification, Replied status, interview dates, calendar, insights by tone and CV, desktop notifications. 154 backend + 47 frontend tests. |
| 2026-11-12 | **Phase 8 done.** Tauri desktop shell, backend bundled with PyInstaller as a sidecar (fixed orphaned-process and no-console crash bugs), app-data folder, icons, Windows installer built and smoke-tested in GitHub Actions, draft Release on version tags. |
| 2026-11-12 | **Phase 9 done.** Security pass (CSRF header, local-host check, security headers, dependency upgrades with clean audits), backup and restore, Playwright end-to-end test in CI, coverage gate, user guide, changelog, version 1.0.0. 174 backend + 52 frontend tests + 1 E2E. Tagging v1.0.0 is left to the owner. |
| 2026-11-13 | **Phase 10 (v1.1) done.** Imports the owner's own tracker layout (title and totals above the table, Status and deadline columns), keys pasted in Settings, a tailored CV per job, letter highlights, Word + PDF saved to Documents\CareerPilot. 204 backend + 59 frontend tests. |
| 2026-11-13 | **Phase 11 (v1.2) done.** Fixed LaTeX CVs being read as glyph names, a tracker laid out like the owner's spreadsheet with next steps, Find jobs (Reed, Adzuna) with AI summaries, and a one-page Apply flow. 232 backend + 65 frontend + 3 E2E tests. |
| 2026-11-13 | **Phase 12 (v1.3) done.** Jooble, other-site searches, add a job from any site, shortlist, deadlines due, hide closed, a bold modern restyle, and a full re-test that found and fixed three bugs. 240 backend + 65 frontend + 6 E2E tests. |
| 2026-11-13 | **Phase 13 (v1.4) done.** Interview stages, delete selected / all with a 30-day recycle bin, add a job from just its link, signed auto-updates, and the fix for links not opening in the desktop app. 263 backend + 69 frontend + 7 E2E tests. |
