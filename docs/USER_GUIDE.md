# CareerPilot user guide

This guide takes you from a fresh install to your first sent application. Everything runs on your own computer.

> 📸 Screenshots will be added in a later update.

## Contents

1. [Install](#1-install)
2. [Get a free AI key](#2-get-a-free-ai-key)
3. [Connect your email](#3-connect-your-email)
4. [Set up your profile](#4-set-up-your-profile)
5. [Import your jobs](#5-import-your-jobs)
6. [Write cover letters](#6-write-cover-letters)
7. [Review and send](#7-review-and-send)
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

Keys never go into the app's screens or database. Put them in the `.env` file in your data folder (create it if it doesn't exist):

```ini
GEMINI_API_KEY=paste-your-key-here
# or
GROQ_API_KEY=paste-your-key-here
```

Restart CareerPilot. Then open **Settings → AI provider**, choose your provider and click **Test connection**.

## 3. Connect your email

CareerPilot sends email through your own account using SMTP, and reads replies using IMAP. It never reads anything except replies to your applications.

**Gmail**

1. Turn on [2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification).
2. Create an App Password at <https://myaccount.google.com/apppasswords>. It's a 16-letter code. **Never use your normal password.**
3. Add it to your `.env` file and restart CareerPilot:

   ```ini
   EMAIL_PASSWORD=abcdabcdabcdabcd
   ```

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

## 5. Import your jobs

Open **Import** and upload an Excel (`.xlsx`, `.xls`) or CSV file with one job per row. There's a template on the same page.

1. CareerPilot guesses which column is the company, role, email, link and description. Fix any it got wrong under **Match your columns**.
2. Rows that need a look (a missing company, a bad email) are listed so you can fix the file or skip them.
3. Jobs you've already imported are detected and skipped.
4. Click **Import**.

You can also add a single job by hand from **Applications → Add job**, and export everything back to Excel at any time.

## 6. Write cover letters

Open a job and go to the **Cover letter** tab.

1. Choose a tone (formal, friendly or enthusiastic) and add any extra instructions, such as "mention I can start in January".
2. Click **Write letter**. The AI writes a letter, a match score, an email subject and a short email message.
3. **Read it.** Edit anything you like. Flags warn you if the letter mentions something that isn't in your profile.
4. Write more versions if you want; star the one to send. Export to PDF or Word with the buttons above the letter.

To write letters for many jobs at once, select them on the **Applications** page and choose **Write cover letters**. They're written in the background with a pause between each one, to stay inside free-tier limits.

## 7. Review and send

Open the job's **Apply** tab.

- **Email applications:** check the recipient, subject, message and attachments (your CV and the cover letter as a PDF). Tick **I've read the cover letter and this email**, then click **Approve & send**. It joins the send queue and goes out within the daily limit. You can cancel it until it's sent.
- **Job portals (LinkedIn, Indeed, company sites):** CareerPilot never submits these for you, because portals ban bots. **Assisted apply** opens the job page and lets you copy your letter and details, then you mark it as applied.

Nothing is ever sent without your approval.

## 8. Track your applications

- **Dashboard:** counts, a chart by status and jobs added per week.
- **Applications:** a searchable, sortable table, or a Kanban **Board** you can drag cards across.
- **Replies:** CareerPilot checks your inbox for replies to applications it sent and suggests a status (interview, rejection, and so on). You confirm it. It checks every 30 minutes, or click **Check replies now** on the Dashboard.
- **Follow-ups:** when a job has had no reply for the number of days you set, it's marked as due. Click **Draft a follow-up** (AI or template), review it and send it in the same email thread.
- **Calendar:** interview dates and follow-ups.
- **Insights** (on the Dashboard): how quickly employers reply, and which tone and which CV get the most replies.
- **Notifications:** turn on desktop notifications in **Settings** to hear about new replies and due follow-ups.

## 9. Back up and restore

In **Settings → Backup & restore**:

- **Download backup** saves one `.zip` with all your jobs, letters, emails, replies, profile and CVs. It never contains your API keys or email password. It *does* contain personal data, so keep it somewhere safe.
- **Restore from backup…** checks the file, then restores it **the next time CareerPilot starts**. Your current data is moved to a `backups` folder first, so nothing is lost. You can cancel a restore until you restart.

Backups from an older version of CareerPilot are upgraded automatically when restored.

## 10. Troubleshooting

| Problem | What to do |
|---|---|
| "AI isn't set up" | Check the key in `.env`, restart CareerPilot, then use **Test connection** in Settings. |
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
- Keys and your email password live only in the `.env` file. They never appear in the app, the database or a backup.
- The app's server only accepts connections from your own computer.
