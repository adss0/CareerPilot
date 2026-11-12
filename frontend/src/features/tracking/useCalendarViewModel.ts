// ViewModel: one month of interviews and follow-ups.
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { parseServerDate } from "@/lib/dates";

import { getCalendar, type CalendarEvent } from "./api";
import { buildDays, monthGrid, type CalendarDay } from "./calendar";

export interface CalendarViewModel {
  month: Date;
  days: CalendarDay[];
  events: CalendarEvent[];
  isLoading: boolean;
  previous: () => void;
  next: () => void;
  today: () => void;
}

export function useCalendarViewModel(): CalendarViewModel {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const { start, end } = monthGrid(month);
  const query = useQuery({
    queryKey: ["calendar", start.toISOString()],
    queryFn: () => getCalendar(start, end),
    placeholderData: keepPreviousData,
  });
  const events = query.data ?? [];
  const shift = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));
  return {
    month,
    days: buildDays(month, events),
    events: events.filter((e) => parseServerDate(e.date).getMonth() === month.getMonth()),
    isLoading: query.isPending,
    previous: () => shift(-1),
    next: () => shift(1),
    today: () => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  };
}
