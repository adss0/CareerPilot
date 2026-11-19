# Save to CareerPilot (browser extension)

One click on any job page adds the job to your CareerPilot tracker. It works in Chrome, Edge and
other Chromium browsers.

## Install

1. Open `chrome://extensions` (in Edge: `edge://extensions`).
2. Turn on **Developer mode** (top right in Chrome, left side in Edge).
3. Click **Load unpacked** and choose this `extension` folder.
4. Click the puzzle-piece icon in the toolbar and pin **Save to CareerPilot**.

To update it after pulling new code, click the refresh arrow on its card in `chrome://extensions`.

## Use

1. Have CareerPilot open.
2. On a job's page (LinkedIn, Indeed, Gradcracker, a company's careers site...), click the
   CareerPilot button.
3. Check the company and role, then click **Save job**. If the job is already in your tracker, the
   popup says so first.

With AI set up in CareerPilot, you can leave the company and role empty and the AI reads them,
plus the location, salary and closing date, from the ad. Without AI, type them in.

## How it works

- `src/page.js` runs in the job page only when you click the button (the `activeTab`
  permission). It reads the address, the page's
  [JobPosting](https://schema.org/JobPosting) record if it has one, and the visible text. It
  doesn't change the page and can't see other tabs.
- `src/job.js` picks the company and role from the JobPosting record and the cleanest text: the
  posting's own description, or the page's main text.
- `src/api.js` sends it to the app on this computer (`http://127.0.0.1:8765`, or `:8000` for a
  development backend) through the same `POST /api/jobs/paste` the Add job form uses. Nothing
  leaves your computer except what CareerPilot's AI provider already receives.

Because the text comes from the page you're looking at, it works on sites that only show the ad
when you're signed in, like LinkedIn.

## Develop

```bash
npm test
```

The tests use Node's built-in test runner (no install needed). CI runs them on every PR.
