// View: how to fill an employer's application form with your details in one click.
import { Check, Copy, Wand2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Profile } from "@/features/profile/types";

import { autofillBookmark } from "./autofill";

export function AutofillView({ profile }: { profile: Profile }) {
  const [copied, setCopied] = useState(false);
  const code = autofillBookmark(profile);

  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <details className="rounded-lg border px-3 py-2">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <Wand2 className="text-primary size-4" /> Fill the employer's form automatically
      </summary>
      <div className="text-muted-foreground mt-2 space-y-2">
        <p>
          A one-off set-up gives your browser an auto-fill button. Click it on any application form
          and it fills in your name, email, phone, location, LinkedIn, GitHub, university and
          degree. It only fills empty boxes and never submits the form.
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            <Button size="sm" variant="outline" onClick={copy} className="align-middle">
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy the auto-fill button"}
            </Button>
          </li>
          <li>
            In your browser, right-click the bookmarks bar and choose{" "}
            <span className="text-foreground">Add page</span> (Chrome, Edge) or{" "}
            <span className="text-foreground">Add bookmark</span> (Firefox). Press Ctrl+Shift+B if
            you can't see the bar.
          </li>
          <li>
            Name it <span className="text-foreground">CareerPilot auto-fill</span> and paste what
            you copied into the <span className="text-foreground">URL</span> box. Save.
          </li>
          <li>On an application form, click that bookmark.</li>
        </ol>
        <p className="text-xs">
          It works on most forms. A few sites (some Workday and iCIMS pages) block it, and
          dropdowns, file uploads and written questions are still yours to do. If you change your
          profile, copy and save the button again. Your details are stored in that bookmark, in your
          own browser.
        </p>
      </div>
    </details>
  );
}
