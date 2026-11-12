// View: apply by approved email, or assisted apply on the job's website; plus email history.
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  Paperclip,
  RotateCcw,
  Send,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";

import type { EmailLog } from "./api";
import type { ApplyViewModel } from "./useApplyViewModel";

const STATUS: Record<
  EmailLog["status"],
  { label: string; variant: "secondary" | "success" | "destructive" | "outline" }
> = {
  queued: { label: "Waiting to send", variant: "secondary" },
  sent: { label: "Sent", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  replied: { label: "Replied", variant: "success" },
  cancelled: { label: "Cancelled", variant: "outline" },
};

export function ApplyView(vm: ApplyViewModel) {
  const p = vm.preview;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        {vm.hasContactEmail && p && (
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Mail className="size-4" /> Send by email
                {p.test_mode && <Badge variant="secondary">Test mode</Badge>}
              </CardTitle>
              <CardDescription>
                Check exactly what will be sent. Nothing goes out until you approve it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {p.problems.length > 0 && (
                <ul
                  role="alert"
                  className="border-destructive/30 bg-destructive/10 text-destructive list-disc space-y-0.5 rounded-lg border py-3 pr-4 pl-8"
                >
                  {p.problems.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
              {p.warnings.length > 0 && (
                <ul className="border-warning-border bg-warning text-warning-foreground list-disc space-y-0.5 rounded-lg border py-3 pr-4 pl-8">
                  {p.warnings.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">To</dt>
                <dd>
                  {p.test_mode ? (
                    <>
                      <span className="font-medium">{p.deliver_to || "you"}</span>{" "}
                      <span className="text-muted-foreground">(test, instead of {p.to})</span>
                    </>
                  ) : (
                    <span className="font-medium">{p.to}</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Subject</dt>
                <dd>{p.subject}</dd>
                <dt className="text-muted-foreground">Attached</dt>
                <dd className="space-y-0.5">
                  {p.attachments.length === 0 && "Nothing"}
                  {p.attachments.map((a) => (
                    <span key={a.name} className="flex items-center gap-1">
                      <Paperclip className="size-3.5" /> {a.name}
                    </span>
                  ))}
                </dd>
              </dl>
              <pre className="bg-muted max-h-72 overflow-y-auto rounded-lg p-3 font-sans whitespace-pre-wrap">
                {p.body || "(empty message)"}
              </pre>

              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="accent-primary mt-0.5 size-4"
                  checked={vm.approved}
                  disabled={!p.can_send}
                  onChange={(e) => vm.setApproved(e.target.checked)}
                />
                I've read the cover letter and this email, and I want to send it.
              </label>
              <Button onClick={vm.send} disabled={!p.can_send || !vm.approved || vm.isSending}>
                {vm.isSending ? <Loader2 className="animate-spin" /> : <Send />}
                Approve & send
              </Button>
              <p className="text-muted-foreground text-xs">
                Approved emails go out one at a time, with a pause between each and a daily limit,
                so your account isn't flagged as spam.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              {vm.hasContactEmail ? "Applying on a website instead?" : "Assisted apply"}
            </CardTitle>
            <CardDescription>
              Job sites like LinkedIn and Indeed ban automated applying, so CareerPilot gets
              everything ready and you click submit. It's quick and keeps your accounts safe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex flex-wrap items-center gap-2">
                <span className="w-5 font-medium">1.</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={vm.copyLetter}
                  disabled={!vm.hasLetter}
                >
                  <Copy /> Copy cover letter
                </Button>
                {!vm.hasLetter && (
                  <span className="text-muted-foreground">
                    Write one in the Cover letter tab first.
                  </span>
                )}
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <span className="w-5 font-medium">2.</span>
                {vm.cvUrl ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={vm.cvUrl} download>
                      <Download /> Download CV ({vm.cvName})
                    </a>
                  </Button>
                ) : (
                  <span className="text-muted-foreground">Upload a CV on the Profile page.</span>
                )}
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <span className="w-5 font-medium">3.</span>
                {vm.jobUrl ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={vm.jobUrl} target="_blank" rel="noreferrer noopener">
                      <ExternalLink /> Open the job posting
                    </a>
                  </Button>
                ) : (
                  <span className="text-muted-foreground">
                    Add the job link in Details & timeline.
                  </span>
                )}
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <span className="w-5 font-medium">4.</span>
                <Button
                  size="sm"
                  onClick={vm.markApplied}
                  disabled={vm.isMarking || vm.alreadyApplied}
                >
                  <Check /> {vm.alreadyApplied ? "Already marked as applied" : "I've submitted it"}
                </Button>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Emails</CardTitle>
        </CardHeader>
        <CardContent>
          {vm.logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing sent yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {vm.logs.map((log) => (
                <li key={log.id} className="space-y-1 py-3 first:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS[log.status].variant}>{STATUS[log.status].label}</Badge>
                    {log.is_test && <Badge variant="outline">Test</Badge>}
                    {log.kind === "follow_up" && <Badge variant="outline">Follow-up</Badge>}
                  </div>
                  <p className="truncate font-medium">{log.subject}</p>
                  <p className="text-muted-foreground text-xs">
                    To {log.to_address}
                    {log.sent_at ? ` · ${formatDateTime(log.sent_at)}` : ""}
                  </p>
                  {log.error && (
                    <p className="text-destructive flex items-start gap-1 text-xs">
                      <AlertTriangle className="mt-0.5 size-3" /> {log.error}
                    </p>
                  )}
                  {log.status === "queued" && (
                    <Button variant="ghost" size="sm" onClick={() => vm.cancel(log.id)}>
                      <X /> Cancel
                    </Button>
                  )}
                  {log.status === "failed" && (
                    <Button variant="ghost" size="sm" onClick={() => vm.retry(log.id)}>
                      <RotateCcw /> Retry
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
