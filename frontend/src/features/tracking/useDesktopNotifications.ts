// Shows a desktop notification when new replies arrive or follow-ups become due
// (only if the user allowed notifications in Settings). Returns the latest summary.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { getNotifications, type NotificationSummary } from "./api";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function newsSince(
  previous: NotificationSummary | null,
  current: NotificationSummary,
): string[] {
  if (!previous) return []; // first load: don't announce what was already there
  const news: string[] = [];
  const replies = current.unseen_replies - previous.unseen_replies;
  if (replies > 0)
    news.push(`${replies} new ${replies === 1 ? "reply" : "replies"} to your applications`);
  const due = current.follow_ups_due - previous.follow_ups_due;
  if (due > 0) news.push(`${due} ${due === 1 ? "follow-up is" : "follow-ups are"} due`);
  return news;
}

export function useDesktopNotifications(): NotificationSummary | null {
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: 120_000,
    retry: false,
  });
  const previous = useRef<NotificationSummary | null>(null);

  useEffect(() => {
    if (!query.data) return;
    const news = newsSince(previous.current, query.data);
    previous.current = query.data;
    if (news.length && notificationsSupported() && Notification.permission === "granted") {
      new Notification("CareerPilot", { body: news.join(" · "), tag: "careerpilot" });
    }
  }, [query.data]);

  return query.data ?? null;
}
