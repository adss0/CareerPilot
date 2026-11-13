# Changelog

All notable changes to CareerPilot. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-11-13

### Added

- **Tailored CV for every job:** the AI rewrites your summary and bullet points and puts the most relevant skills, experience and projects first, using only what's in your profile (job titles, employers, dates, education and the skill list itself are copied from your profile in code, so nothing can be invented). Edit it, download it as Word or PDF, and it's attached to the application email instead of your uploaded CV.
- **Pick what to highlight** in a cover letter: tick skills, projects or jobs from your profile and the letter is built around them.
- **Saved documents folder:** every tailored CV and cover letter is saved as Word + PDF in `Documents\CareerPilot\CVs\<Company>` and `Documents\CareerPilot\Cover Letters\<Company>` (follows OneDrive). Change the folder, turn auto-save off, or open it in File Explorer from Settings or the job.
- **Keys & passwords in Settings:** paste your Gemini key, Groq key or email App Password in the app. They're saved to the `.env` file only, take effect straight away and are never shown again.
- **Import your own tracker:** the table is found even under a title and a totals block, a **Status** column (Applied, Rejected, Interview, Offer…) and an **Application deadline** column are imported, and any other columns are kept in each job's notes.

### Fixed

- An "Application Deadline" column was guessed as the job link, so every "Rolling" was reported as a bad URL.

## [1.0.0] - 2026-11-12

The first full release.

### Added

- **Import:** Excel and CSV import with automatic column matching, cleaning, duplicate detection, a template, and export back to Excel.
- **Profile:** CV upload (PDF, Word, text) with an offline reader and an optional AI reader; several CV versions.
- **Cover letters:** written by Gemini, Groq or Ollama in three tones, with guardrail flags, a match score, an email subject and message, versions, PDF and Word export, and background bulk writing.
- **App:** dashboard charts, a sortable table, bulk actions, a Kanban board, job editing, notes, a timeline and dark mode.
- **Email:** approve-then-send over SMTP with an App Password, test mode on by default, a review screen, a send queue with random gaps and a daily limit, retry and cancel, and assisted apply for job portals.
- **Tracking:** follow-ups sent in the same thread, IMAP reply detection with a suggested status, interview dates, a calendar, insights by tone and CV, and desktop notifications.
- **Desktop:** an installable Windows app (Tauri) with the backend bundled inside it.
- **Backup and restore:** one `.zip` with all your data and CVs (never your keys); restores happen on restart, and your current data is kept first.
- **Docs:** a [user guide](docs/USER_GUIDE.md).

### Security

- The local server rejects requests from other websites (a required `X-CareerPilot` header) and from non-local host names (DNS rebinding), and sends security headers.
- Dependencies updated to versions without known vulnerabilities (Starlette, FastAPI, python-multipart, React Router, Vite and dev tools).

### Testing

- 174 backend tests (95% coverage; CI fails under 85%), 52 frontend tests, and an end-to-end browser test of import → letter → approve → send against a fake AI and a local test mail server.

[1.1.0]: https://github.com/adss0/CareerPilot/releases/tag/v1.1.0
[1.0.0]: https://github.com/adss0/CareerPilot/releases/tag/v1.0.0
