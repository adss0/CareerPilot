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
| 6 | **Sending:** approve-then-send email via Gmail, daily limits, assisted apply for job sites | ⏭️ Next |
| 7 | **Tracking:** status history, follow-up reminders, reply detection, stats | ☐ Planned |
| 8 | **Desktop app:** installable Windows app (Tauri) | ☐ Planned |
| 9 | **Polish & v1.0 release:** full tests, docs, installer on GitHub Releases | ☐ Planned |

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
- [ ] 5.7 **Profile & Settings** pages (AI provider, Gmail connection, send limits, follow-up days, signature). *(Profile done in Phase 3; AI settings done in Phase 4; email settings come in Phase 6 and follow-up settings in Phase 7.)*
- [x] 5.8 Data fetching with **TanStack Query**, **toasts** (sonner) for success and errors, **loading skeletons** on the dashboard and lists
- [x] 5.9 **Dark mode** (light / dark / system, remembered, applied before the first paint so there's no white flash) + responsive layout (every page checked at 375px phone width)

**Done when:** the full flow (import → generate → review) can be done in the UI without touching `/docs`. ✅ Verified 2026-11-11 in the browser: dashboard tiles and charts, sorting both ways, Kanban moves by keyboard and by mouse (both saved), edit details with validation and a timeline entry, add job, bulk delete, dark mode, and every page at phone width.

**Notes from Phase 5:**
- Bugs found and fixed while testing: chart bars were invisible (SVG attributes can't use CSS variables, so charts now read the theme's real colours); keyboard moves on the board only shifted 25px per press (now one column per press); mouse drops could land one column off (now uses the pointer position).
- New frontend dependencies (all MIT): recharts, @dnd-kit/core, sonner.

---

## Phase 6: Sending applications

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

## Phase 7: Tracking & follow-ups

**Goal:** never lose track of an application.

- [ ] 7.1 Status history recorded on every change (timeline on the detail page)
- [ ] 7.2 **Follow-up rules**: if `SENT` and no reply after N days (default 7) → reminder + AI-drafted polite follow-up email (still requires approval)
- [ ] 7.3 **Reply detection**: poll Gmail threads (APScheduler, every 30 min) and mark `REPLIED`. Optionally ask the AI to classify the reply as interview / rejection / other.
- [ ] 7.4 Desktop notifications for follow-ups and replies
- [ ] 7.5 Stats: response rate, interview rate, average days to reply, best-performing tone/CV version
- [ ] 7.6 Calendar-style view of interviews and follow-ups

**Done when:** a sent application with no reply automatically surfaces as "Follow up today" after N days.

---

## Phase 8: Desktop app packaging

**Goal:** a real installable app.

- [ ] 8.1 Add **Tauri 2** around the built React frontend
- [ ] 8.2 Bundle the Python backend with **PyInstaller** as a Tauri **sidecar** that starts and stops with the app
- [ ] 8.3 Store the DB and files in the OS app-data folder (e.g. `%APPDATA%/CareerPilot`)
- [ ] 8.4 App icon, name and window settings; system-tray icon for background reminders
- [ ] 8.5 Build a Windows installer (`.msi`/`.exe`); macOS/Linux builds optional via GitHub Actions
- [ ] 8.6 Auto-update via Tauri updater + GitHub Releases (optional)

**Done when:** installing the `.exe` on a clean PC works without Python or Node installed.

---

## Phase 9: Polish, testing & release

- [ ] 9.1 Backend test coverage ≥ 70% (pytest): Excel import, AI provider mocks, email building
- [ ] 9.2 End-to-end test (Playwright): import → generate → approve → (mock) send
- [ ] 9.3 Security pass: no secrets in the repo, tokens in the keyring, validated inputs, file-size limits on uploads
- [ ] 9.4 Backup/restore of the database + "export all my data"
- [ ] 9.5 Docs: user guide with screenshots, how to get a free Gemini key, how to connect Gmail
- [ ] 9.6 Tag **v1.0.0** and publish the installer on GitHub Releases

---

## Future ideas (after v1)

- Job scraping from public job boards' RSS/APIs into the tracker
- Chrome extension: "Save this job to CareerPilot" from any job page
- AI interview-prep questions per application
- CV tailoring per job (not just the cover letter)
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
