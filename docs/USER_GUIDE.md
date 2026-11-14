# CareerPilot user guide

This guide takes you from a fresh install to your first sent application. Everything runs on your own computer.

> 📸 Screenshots will be added in a later update.

## Contents

1. [Install](#1-install)
2. [Get a free AI key](#2-get-a-free-ai-key)
3. [Connect your email](#3-connect-your-email)
4. [Set up your profile](#4-set-up-your-profile)
5. [Find jobs or import your own](#5-find-jobs-or-import-your-own)
6. [Write cover letters and tailor your CV](#6-write-cover-letters-and-tailor-your-cv)
7. [Apply](#7-apply)
8. [Track your applications](#8-track-your-applications)
9. [Back up and restore](#9-back-up-and-restore)
10. [Troubleshooting](#10-troubleshooting)
11. [Privacy](#11-privacy)

---

## 1. Install

**Windows app (recommended)**

1. Download `CareerPilot_1.0.0_x64-setup.exe` from the [Releases page](https://github.com/adss0/CareerPilot/releases).
2. Run it. It installs for your user only and doesn't need admin rights. Windows SmartScreen may warn you because the installer isn't code-signed; choose **More info → Run anyway** if you trust the download.
3. Open **CareerPilot** from the Start menu.

Your data lives in `%APPDATA%\app.careerpilot.desktop`. That folder holds the database, your CVs, the log file and your `.env` file with your keys.

**From source (developers):** see [Getting started](../README.md#getting-started-development) in the README. Your data then lives in `backend/`.

## 2. Get a free AI key

CareerPilot writes letters with free AI. Pick one provider:

| Provider | Cost | Where to get it | Notes |
|---|---|---|---|
| **Google Gemini** (default) | Free tier | <https://aistudio.google.com/apikey> | Best quality. On the free tier, Google may use prompts to improve its products. |
| **Groq** | Free tier | <https://console.groq.com/keys> | Fast. Runs open Llama models. |
| **Ollama** | Free, offline | <https://ollama.com> | Runs on your own PC; nothing leaves it. Needs a reasonably fast computer. Run `ollama pull llama3.2` once. |

Open **Settings → Keys & passwords**, paste your key and click **Save**. It works straight away; no restart is needed.

Keys are saved only in the `.env` file in your data folder. They never go into the database or a backup, and the app never shows them again (it only says **Saved** or **Not set**).

Then open **Settings → AI provider**, choose your provider and click **Test connection**.

## 3. Connect your email

CareerPilot sends email through your own account using SMTP, and reads replies using IMAP. It never reads anything except replies to your applications.

**Gmail**

1. Turn on [2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification).
2. Create an App Password at <https://myaccount.google.com/apppasswords>. It's a 16-letter code. **Never use your normal password.**
3. Paste it in **Settings → Keys & passwords → Email App Password** and click **Save** (spaces are removed for you).

4. In **Settings → Email**, enter your name and email address, choose **Gmail** as the provider (this fills in the server details) and save.
5. Click **Test connection** to check that CareerPilot can log in.

Outlook and other providers work the same way: use an app password if your provider offers one, and choose the provider or type in the server details.

**Test mode is on by default.** While it's on, every email goes to *your own* test address instead of the employer, with `[TEST]` at the start of the subject. Send yourself a few, check how they look, then turn test mode off when you're ready.

Other email settings:

- **Most emails per day:** a daily limit that protects your account from spam filters. 20–30 is a sensible start.
- **Pause from/to (s):** a random gap between sends, so emails don't all go out at once.
- **Follow up after (days):** when to remind you if there's no reply.

## 4. Set up your profile

Open **Profile** and upload your CV (PDF, Word or text).

- The built-in reader works offline and fills in your skills, experience and education.
- **Read it with AI** is optional and more accurate, but it sends your CV's text to your AI provider.

Check every field and correct anything that's wrong. Letters only use facts from this profile. You can keep several CV versions (for example "Backend" and "Data") and choose one per job.

## 5. Find jobs or import your own

**Find jobs** lists jobs from UK job boards through their official free APIs:

1. Get a free key from one or more boards: [Reed](https://www.reed.co.uk/developers/jobseeker) (UK, with a graduate filter), [Adzuna](https://developer.adzuna.com/signup) (UK, with salaries: an App ID and an App Key) or [Jooble](https://jooble.org/api/about) (jobs gathered from many sites; ask for a UK key).
2. Paste them in **Settings → Keys & passwords**.
3. Open **Find jobs**, type a role and a place, keep **Graduate roles** ticked and click **Search**.
4. Click a job: a side panel shows an AI summary (what the job is, salary, must-haves, your match, why you fit and the gaps). Click **Apply** to save it to your tracker and go straight to the Apply page.
5. Click the ☆ on a job to **shortlist** it for later, without adding it to your tracker. The **Shortlist** tab keeps it, even after a restart.

**Gradcracker, The Trackr, Bright Network, Prospects and TARGETjobs** have no public API. Under **Search on other sites**, one click searches the site for your keywords. Found a job there? Use **Add a job from any site**: paste its link and CareerPilot reads that page and fills in the company, role, salary, location, closing date and the ad, then opens the Apply page. If the site needs a login (LinkedIn, for example), paste the ad's text as well.

**Import your own tracker:** you can also bring in your existing spreadsheet.

Open **Import** and upload an Excel (`.xlsx`, `.xls`) or CSV file with one job per row. There's a template on the same page.

Your own tracker works too: CareerPilot finds the table even if there's a title and a totals block above it.

1. CareerPilot guesses which column is the company, role, status, deadline, email, link and description. Fix any it got wrong under **Match your columns**.
   - **Status** words such as Applied, Rejected, Interview or Offer become the job's status ("Applied" becomes **Sent**).
   - Columns you don't match (for example *Pre-assessment*) are kept in each job's notes.
2. Rows that need a look (a missing company, a bad email) are listed so you can fix the file or skip them.
3. Jobs you've already imported are detected and skipped.
4. Click **Import**.

You can also add a single job by hand from **Applications → Add job**, and export everything back to Excel at any time.

## 6. Write cover letters and tailor your CV

Open a job and go to the **Cover letter** tab.

1. Choose a tone (formal, friendly or enthusiastic) and add any extra instructions, such as "mention I can start in January".
   Open **Pick what to highlight** to tick the skills, projects or jobs the letter should focus on.
2. Click **Write letter**. The AI writes a letter, a match score, an email subject and a short email message.
3. **Read it.** Edit anything you like. Flags warn you if the letter mentions something that isn't in your profile.
4. Write more versions if you want; star the one to send. Export to PDF or Word with the buttons above the letter.

**Tailored CV:** open the job's **Tailored CV** tab and click **Tailor my CV**. The AI rewrites your summary and bullet points and puts what matters most for this job first. It only rewords and reorders: job titles, employers, dates, education and the skill list come straight from your profile. The CV is always **one page**, in the Jake's Resume layout. **Layout** chooses the section order (your main CV's, or Jake's Resume's), and **Based on** chooses which of your uploaded CVs to tailor. **What changed** lists the edits, and you can change anything before saving. When a job has a tailored CV, it's attached to the email instead of your uploaded CV.

**ATS check:** every tailored CV gets a score out of 100 and a checklist showing how applicant-tracking systems will read it: whether the PDF reads back as text, which of the job's keywords it covers (and which ones are in your profile but missing from this CV), contact details, sections, length, bullet points, numbers and dates. It runs again every time you tailor or save.

**Preview:** the **Preview** button on the cover letter and the tailored CV shows the finished PDF, including changes you haven't saved yet.

**Downloads:** every download shows a message when it's done. In the desktop app the file is saved in your Downloads folder, with **Open** and **Show in folder** buttons.

**Main cover letter:** paste a cover letter you're happy with in **Profile → Main cover letter**. Every new letter follows its structure, length and voice.

**Sponsorship:** each job has a Visa sponsorship value (Yes, No or Unsure). It's read from the job ad when the ad says, and you can change it in the tracker.

**Where the files go:** when you click **I've applied**, the CV and cover letter are saved as PDFs in `Documents\CareerPilot` (nothing is saved for drafts):

```text
Documents\CareerPilot\
  CVs\CV - Your Name - Acme Ltd - Junior Developer.pdf
  Cover Letters\Cover letter - Acme Ltd - Junior Developer.pdf
```

Click **Open folder** on the job to see them. In **Settings → Saved documents** you can choose another folder or turn automatic saving off (then use **Save to folder** on a job). Program Files can't be used, because Windows only lets administrators save there.

To write letters for many jobs at once, select them on the **Applications** page and choose **Write cover letters**. They're written in the background with a pause between each one, to stay inside free-tier limits.

## 7. Apply

Click **Apply** on a job (in Find jobs, or in the tracker's side panel). The Apply page has four steps:

1. **Build your CV and cover letter:** one click builds both with Gemini, from your profile and the job ad. Rebuild either one, change the letter's tone, or open **Edit** to change the wording.
2. **Check what you're sending:** **Preview CV** and **Preview cover letter** show the exact PDFs.
3. **Download or save:** Word or PDF; **Save to my documents folder**; or **Use as my main CV** (adds it to Profile → Your CVs as your default).
4. **Apply on the employer's site:** opens the job's page (or a web search if the job has no link). Websites don't let other apps type into their forms, so your name, email, phone, links, degree and cover letter are listed with one-click **Copy** buttons. Click **I've applied** when you're done.

**Applying by email instead (optional):** each job's details page still has an email **Apply** tab:

- **Email applications:** check the recipient, subject, message and attachments (your CV and the cover letter as a PDF). Tick **I've read the cover letter and this email**, then click **Approve & send**. It joins the send queue and goes out within the daily limit. You can cancel it until it's sent.
- **Job portals (LinkedIn, Indeed, company sites):** CareerPilot never submits these for you, because portals ban bots. **Assisted apply** opens the job page and lets you copy your letter and details, then you mark it as applied.

Nothing is ever sent without your approval.

## 8. Track your applications

- **Dashboard:** counts, a chart by status and jobs added per week.
- **Applications:** your tracker, laid out like a job-hunt spreadsheet: totals at the top, then Company, Role, Application deadline, Status, Pre-assessment, Assessment deadline and **Next step**. Change any cell and it saves. The **Stages** column shows each hiring stage as a chip (Online test, Video interview, Assessment centre, Final…): green ✓ passed, red ✗ didn't pass, amber upcoming with its date. Click **+** to add one (it suggests the next likely stage) or a chip to change it. Jobs closing in the next 7 days, and stages coming up, get an amber chip (red when overdue); the Dashboard lists them under **Due this week**. Tick **Hide closed** to hide rejected and withdrawn jobs. Click a company for a side panel with the job's summary and an **Apply** button. Switch to **Board** to drag cards between statuses.
- **Replies:** CareerPilot checks your inbox for replies to applications it sent and suggests a status (interview, rejection, and so on). You confirm it. It checks every 30 minutes, or click **Check replies now** on the Dashboard.
- **Follow-ups:** when a job has had no reply for the number of days you set, it's marked as due. Click **Draft a follow-up** (AI or template), review it and send it in the same email thread.
- **Calendar:** fills itself in from your sheet: every stage with a date (online tests, interviews, assessment centres), closing dates for jobs you haven't applied to, interviews and follow-ups. Tests and interviews in the next 3 days also show in a **Coming up** banner at the top of every page.
- **Insights** (on the Dashboard): how quickly employers reply, and which tone and which CV get the most replies.
- **Notifications:** turn on desktop notifications in **Settings** to hear about new replies and due follow-ups.

### Deleting jobs

- Tick rows and click **Delete selected**, or **Delete all** to start fresh (type DELETE; a full backup is saved first).
- Deleted jobs go to the **Bin** for 30 days, with their letters, tailored CV and history. Click **Restore** to bring one back.

## 9. Back up and restore

In **Settings → Backup & restore**:

- **Download backup** saves one `.zip` with all your jobs, letters, emails, replies, profile and CVs. It never contains your API keys or email password. It *does* contain personal data, so keep it somewhere safe.
- **Restore from backup…** checks the file, then restores it **the next time CareerPilot starts**. Your current data is moved to a `backups` folder first, so nothing is lost. You can cancel a restore until you restart.

Backups from an older version of CareerPilot are upgraded automatically when restored.

### Updates

The desktop app checks for a new version a few seconds after it starts, and **Settings → Updates** shows your version with a **Check for updates** button. When there is one, click **Update**: it downloads, installs and restarts. Updates are signed, so the app only installs ones published from the CareerPilot repository.

## 10. Troubleshooting

| Problem | What to do |
|---|---|
| My CV reads as `U/n.sc/i.sc…` or projects are missing | Fixed in 1.2: open **Profile** and read your CV again. |
| Find jobs shows "Connect a job board" | Paste a free Reed key, an Adzuna App ID and App Key, or a Jooble key in **Settings → Keys & passwords**. |
| "Gemini rejected the API key" and your key starts with **AQ.** | Some Google accounts are only given the new "AQ." keys, and Google currently rejects them for the Gemini API (`ACCESS_TOKEN_TYPE_UNSUPPORTED`). Create a key in another Google Cloud project, or use a free **Groq** key in Settings instead. |
| "Gemini returned an error (503)" / Gemini is slow | Google's servers are busy. CareerPilot now switches to a lighter Gemini model by itself; if every model is busy, wait a minute or switch to Groq. |
| Jobs seem missing right after opening the app | The app shows "Starting…" while its engine starts (a few seconds). Your jobs are saved in `%APPDATA%\\app.careerpilot.desktop` and come back every time. |
| "AI isn't set up" | Paste your key again in **Settings → Keys & passwords**, then use **Test connection**. |
| "Rate limit reached" | The free tier allows a limited number of requests per minute and day. Wait a minute, or switch provider in Settings. |
| Test email fails with a login error | Use an App Password, not your normal password, and check that 2-Step Verification is on. |
| Emails stay "Queued" | Check the daily limit in Settings; the queue resumes the next day. Failed emails show the reason and a **Retry** button. |
| Replies aren't detected | Check the IMAP server and port in Settings. Only replies to emails sent from CareerPilot (or from the employer's address) are matched. |
| The desktop app won't open | Look at the log file in `%APPDATA%\app.careerpilot.desktop`. Only one copy can run at a time. |
| Something else | [Open an issue](https://github.com/adss0/CareerPilot/issues). Please don't include your CV, keys or any personal details. |

## 11. Privacy

- Your CVs, profile and applications are stored only on your computer.
- Writing a letter sends your name, location, summary, skills, experience, education and projects, plus the job details, to the AI provider you chose. Your email, phone number and links are never sent. Choose **Ollama** to keep everything on your PC.
- Reading a CV with AI is opt-in and sends the CV's text to the provider.
- Keys and your email password live only in the `.env` file. You paste them in Settings, but the app never shows them again, and they're never in the database or a backup.
- Tailored CVs and letters are saved in your Documents folder. If Documents is in OneDrive, they sync to your OneDrive account too.
- The app's server only accepts connections from your own computer.
