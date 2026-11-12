// View: follow-up email and replies from the employer, on the job's Apply tab.
import { Inbox, Loader2, MessageSquareReply, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime, parseServerDate } from "@/lib/dates";

import type { FollowUpViewModel } from "./useFollowUpViewModel";

const KIND = {
  interview: { label: "Looks like an interview", variant: "success" },
  rejection: { label: "Looks like a rejection", variant: "destructive" },
  other: { label: "Reply", variant: "secondary" },
} as const;

export function FollowUpView(vm: FollowUpViewModel) {
  const due = vm.followUpAt ? parseServerDate(vm.followUpAt) : null;
  return (
    <div className="space-y-6">
      {vm.replies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="size-4" /> Replies
            </CardTitle>
            <CardDescription>
              Found in your inbox. The type is a guess: you decide the status.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {vm.replies.map((r) => (
              <article key={r.id} className="space-y-2 rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={KIND[r.classification].variant}>
                    {KIND[r.classification].label}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {r.from_address} · {formatDateTime(r.received_at)}
                  </span>
                </div>
                <p className="font-medium">{r.subject}</p>
                <p className="text-muted-foreground line-clamp-4">{r.snippet}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={vm.status === "interview"}
                    onClick={() => vm.setStatus("interview")}
                  >
                    Mark as interview
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={vm.status === "rejected"}
                    onClick={() => vm.setStatus("rejected")}
                  >
                    Mark as rejected
                  </Button>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      )}

      {vm.canFollowUp && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareReply className="size-4" /> Follow up
            </CardTitle>
            <CardDescription>
              {due
                ? due <= new Date()
                  ? "No reply yet, and the follow-up date has passed. A short, polite nudge often helps."
                  : `Follow-up suggested on ${formatDate(vm.followUpAt!)} if there's no reply.`
                : "Send a short, polite follow-up in the same email thread."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!vm.draft ? (
              <Button variant="outline" onClick={vm.startDraft} disabled={vm.isDrafting}>
                {vm.isDrafting ? <Loader2 className="animate-spin" /> : <MessageSquareReply />}
                Draft a follow-up
              </Button>
            ) : (
              <>
                <p className="text-muted-foreground text-xs">
                  {vm.draft.source === "ai" ? "Written by AI." : "From the built-in template."}{" "}
                  Going to{" "}
                  <span className="text-foreground font-medium">{vm.draft.deliver_to}</span>
                  {vm.draft.test_mode && ` (test mode, instead of ${vm.draft.to})`}.
                </p>
                <label className="grid gap-1.5">
                  <span className="font-medium">Subject</span>
                  <Input
                    value={vm.draft.subject}
                    onChange={(e) => vm.editDraft({ subject: e.target.value })}
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="font-medium">Message</span>
                  <Textarea
                    rows={8}
                    value={vm.draft.body}
                    onChange={(e) => vm.editDraft({ body: e.target.value })}
                  />
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="accent-primary mt-0.5 size-4"
                    checked={vm.approved}
                    onChange={(e) => vm.setApproved(e.target.checked)}
                  />
                  I've read this follow-up and want to send it.
                </label>
                <div className="flex gap-2">
                  <Button onClick={vm.sendDraft} disabled={!vm.approved || vm.isSending}>
                    {vm.isSending ? <Loader2 className="animate-spin" /> : <Send />}
                    Approve & send
                  </Button>
                  <Button variant="ghost" onClick={vm.cancelDraft}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
