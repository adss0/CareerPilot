import { parseServerDate } from "@/lib/dates";

import type { CalendarEvent } from "./api";

export interface CalendarDay {
  date: Date;
  key: string; // local YYYY-MM-DD
  inMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
}

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The 6-week grid (Monday first) that shows a month. */
export function monthGrid(month: Date): { start: Date; end: Date } {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // days since Monday
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 42);
  return { start, end };
}

export function buildDays(month: Date, events: CalendarEvent[], today = new Date()): CalendarDay[] {
  const { start } = monthGrid(month);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = dayKey(parseServerDate(event.date));
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dayKey(date);
    return {
      date,
      key,
      inMonth: date.getMonth() === month.getMonth(),
      isToday: key === dayKey(today),
      events: byDay.get(key) ?? [],
    };
  });
}
