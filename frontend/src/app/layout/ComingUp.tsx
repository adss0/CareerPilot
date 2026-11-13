// "Coming up" banner: tests, interviews and assessment centres today or in the next 3 days.
// Shown on every page until dismissed for the day; also a Windows notification if allowed.
import { CalendarClock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { DueItem } from "@/features/applications/types";
import { notificationsSupported } from "@/features/tracking/useDesktopNotifications";

const DISMISS_KEY = "careerpilot.comingUpDismissed";
const ANNOUNCED_KEY = "careerpilot.comingUpAnnounced";

const today = () => new Date().toISOString().slice(0, 10);
const keyOf = (item: DueItem) => `${item.application_id}-${item.date}`;

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // not remembered: the banner just shows again
  }
}

export function ComingUp({ items }: { items: DueItem[] }) {
  const [dismissed, setDismissed] = useState(() => read(DISMISS_KEY) === today());

  // One Windows notification per stage per day.
  useEffect(() => {
    if (!items.length || !notificationsSupported() || Notification.permission !== "granted") return;
    const announced = new Set(read(ANNOUNCED_KEY).split(",").filter(Boolean));
    const fresh = items.filter((i) => !announced.has(`${today()}:${keyOf(i)}`));
    if (!fresh.length) return;
    new Notification("CareerPilot: coming up", {
      body: fresh.map((i) => `${i.label}: ${i.company}`).join("\n"),
      tag: "careerpilot-coming-up",
    });
    fresh.forEach((i) => announced.add(`${today()}:${keyOf(i)}`));
    write(ANNOUNCED_KEY, [...announced].filter((k) => k.startsWith(today())).join(","));
  }, [items]);

  if (!items.length || dismissed) return null;
  return (
    <div
      role="status"
      className="border-warning-border bg-warning text-warning-foreground mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm"
    >
      <CalendarClock className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">Coming up</p>
        <ul className="mt-0.5 space-y-0.5">
          {items.map((item) => (
            <li key={keyOf(item)}>
              <Link to={`/applications/${item.application_id}`} className="hover:underline">
                <span className="font-semibold">{item.label}</span> · {item.company}, {item.role}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        aria-label="Hide until tomorrow"
        title="Hide until tomorrow"
        className="rounded-md p-1 hover:bg-black/5"
        onClick={() => {
          write(DISMISS_KEY, today());
          setDismissed(true);
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
