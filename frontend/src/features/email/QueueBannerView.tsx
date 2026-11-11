// View: what the email send queue is doing.
import { Send } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { parseServerDate } from "@/lib/dates";

import type { QueueStatus } from "./api";

export function QueueBannerView({ status }: { status: QueueStatus | null }) {
  if (!status || status.queued === 0) return null;
  const limitReached = status.sent_today >= status.daily_limit;
  return (
    <div
      role="status"
      className="bg-card flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-3 text-sm"
    >
      <Send className="text-primary size-4" />
      <span className="font-medium">
        {status.queued} {status.queued === 1 ? "email" : "emails"} waiting to send
      </span>
      <span className="text-muted-foreground">
        {status.sent_today} of {status.daily_limit} sent today
        {limitReached
          ? " · daily limit reached, the rest go tomorrow"
          : status.next_send_at
            ? ` · next around ${parseServerDate(status.next_send_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : ""}
      </span>
      {status.test_mode && <Badge variant="secondary">Test mode: going to you</Badge>}
      {!status.ready && (
        <span className="text-destructive">
          Paused: {status.problems[0]}{" "}
          <Link to="/settings" className="underline">
            Settings
          </Link>
        </span>
      )}
    </div>
  );
}
