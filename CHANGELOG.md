# Changelog

All notable changes to CareerPilot. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [1.6.0] - 2026-11-14

### Added

- **ATS check on every CV:** each time a CV is tailored, edited or opened it gets a score out of 100 and a checklist: readable by applicant-tracking systems (the real PDF is read back as text), the job's keywords it covers (and which ones are in your profile but missing from this CV), contact details, standard sections, length, bullet points, measurable results and dates. Rule-based: instant, free, the same every time.
- **Preview mode:** a Preview button on the cover letter and the tailored CV shows exactly what the finished PDF will look like, including edits you haven't saved.
- **Download confirmations:** every download (CV, cover letter, exports, backups) says it worked. In the desktop app the file goes to your Downloads folder, with **Open** and **Show in folder** buttons.
- **Updates in Settings:** see your version, check for updates and install with one click (in addition to the automatic check when the app opens).

## [1.5.0] - 2026-11-13

### Added

- **The calendar fills itself in:** every dated interview stage (online tests, video and phone interviews, assessment centres, finals) and every closing date appears automatically, colour-coded, with ✓ / ✗ once you've recorded the result.
- **"Coming up" reminders:** tests and interviews today or in the next 3 days show in a banner on every page (hide it until tomorrow), plus a Windows notification once a day if you've allowed notifications.
- **A new app icon:** a teal paper plane on deep navy, matching the app, for the window, taskbar, Start menu, installer and browser tab.

### Fixed

- **Jobs looked "gone" right after opening the desktop app:** for the few seconds its engine takes to start, pages showed empty instead of waiting. CareerPilot now shows "Starting…" until your data is ready, and never shows "empty" when it simply couldn't load yet.
- **Gemini stalling or "busy" (503):** the default model is now `gemini-3-flash-preview`, and when Google says a model is busy, too slow or retired, CareerPilot automatically tries `gemini-flash-lite-latest`, then `gemini-3.1-flash-lite`. A wrong key still stops straight away with a clear message.

## [1.4.0] - 2026-11-13

### Added

- **Interview stages:** one **Stages** column in the sheet with small chips (Online test, Video interview, Phone screen, Technical, Assessment centre, Final, or your own), each with a date and upcoming / passed / didn't pass. **+** suggests the next likely stage. Next step, Due this week and the totals follow the stages. Existing pre-assessments became "Online test" stages automatically.
- **Deleting:** tick rows and **Delete selected**; **Delete all** (type DELETE; a full backup is saved first); and a **Recycle bin** that keeps deleted jobs, with their letters, tailored CV and history, for 30 days, so you can restore them.
- **Add a job from just its link:** CareerPilot reads that one page (using the site's standard job data when it has it) and fills in the company, role, salary, location, closing date and the ad. Sites that need a login (like LinkedIn) still need the text pasted.
- **Auto-updates:** the desktop app checks GitHub Releases for a new signed version and installs it with one click.

### Fixed

- Job links didn't open in the desktop app: Tauri's shell plugin caught the click first and wasn't allowed to open it. Links now open in your browser.

### Changed

- The sheet's Pre-assessment and Assessment deadline columns are replaced by Stages; the Excel export has a Stages column.

## [1.3.0] - 2026-11-13

### Added

- **Jooble** as a third job board (free key), next to Reed and Adzuna.
- **Search on other sites:** one click searches Gradcracker, The Trackr, Bright Network, Prospects or TARGETjobs for your keywords (they have no public API, so this opens a web search of the site).
- **Add a job from any site:** paste a job's link and its ad; AI fills in the company, role, salary, location and closing date and summarises it, then the Apply page opens.
- **Shortlist:** star jobs in Find jobs to look at later without adding them to your tracker. It's kept between restarts, with its AI summary.
- **Deadlines and assessments due:** the tracker shows "Closes in 3 days" / "Assessment due tomorrow" chips, and the dashboard has a **Due this week** card.
- **Hide closed:** one tick hides rejected and withdrawn jobs from the tracker (the totals stay complete).
- Settings has boxes for the Reed, Adzuna and Jooble keys.

### Changed

- **A new look:** a deep navy sidebar, an electric-teal accent, a bold typeface (Plus Jakarta Sans, bundled so it works offline), cards with depth, colour-coded statuses (blue applied, green moving, amber waiting on you, coral closed) and a colour-coded totals bar. Light and dark.
- The dashboard's "Sent" tile is now "Applied".

### Fixed

- Settings had no boxes for the Reed and Adzuna keys that Find jobs asked for.
- Two screens loading at the same moment on a brand-new database could crash creating the profile.
- CV reading: kerning gaps inside words ("T ypeScript", "JP A"), ".NET" losing its dot, "Name | tech Coursework" project lines, and "&" section headings such as "LEADERSHIP & ACTIVITIES".

## [1.2.0] - 2026-11-13

### Added

- **Find jobs:** search UK job boards (Reed, with its graduate filter, and Adzuna) through their official free APIs. Each job opens in a side panel with an AI summary: what the job is, salary, location, must-haves, your match score, why you fit and the gaps. **Apply** saves it to your tracker and opens the Apply page.
- **Apply page:** build the tailored CV and cover letter with Gemini in one click, preview the exact PDFs you'll upload, download Word or PDF, save both to your documents folder or make the CV your main CV, then open the employer's page with your details ready to copy (name, email, phone, links, degree, letter) and mark the job as applied.
- **A tracker like your own spreadsheet:** totals at the top (total, applied, rejected, assessments done, in progress, interviews) and the columns Company, Role, Application deadline, Status, Pre-assessment, Assessment deadline and Next step. Edit any cell in place; rejected, pending and done are colour-coded. Click a job for a side panel with its summary and an Apply button. The Excel export uses the same columns.
- **Next step** for every job, worked out from its status and assessment ("Do the assessment by 25 Nov", "Wait for a reply", "Apply by 30/11/2026"…).
- Import now reads **Pre-assessment** (Done/Pending) and **Assessment deadline** columns into real fields.
- `npm run demo` starts a safe demo with a fake AI and a fake job board.

### Changed

- Status names match a job hunter's tracker: "Imported" is now **To apply** and "Sent" is now **Applied**.
- The Applications page is the simple tracker; email sending stays available on each job's Apply tab.

### Fixed

- **CVs made with LaTeX templates** (small-capital headings) were read as `U/n.sc/i.sc/v.sc…`: the PDF reader returned glyph names. They're now turned back into letters, along with ligatures (ﬁ) and kerning gaps ("Y ear").
- The built-in CV reader now splits undated projects, takes skills from project lines when there's no Skills section ("Java, Spring Boot, JPA"), ignores an "Extra-curricular" section, keeps ".Net", and reads education where the university comes before the degree.

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

[1.6.0]: https://github.com/adss0/CareerPilot/releases/tag/v1.6.0
[1.5.0]: https://github.com/adss0/CareerPilot/releases/tag/v1.5.0
[1.4.0]: https://github.com/adss0/CareerPilot/releases/tag/v1.4.0
[1.3.0]: https://github.com/adss0/CareerPilot/releases/tag/v1.3.0
[1.2.0]: https://github.com/adss0/CareerPilot/releases/tag/v1.2.0
[1.1.0]: https://github.com/adss0/CareerPilot/releases/tag/v1.1.0
[1.0.0]: https://github.com/adss0/CareerPilot/releases/tag/v1.0.0
