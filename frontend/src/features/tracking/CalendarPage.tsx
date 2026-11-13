// View + page: interviews and follow-ups on a month calendar.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { parseServerDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

import type { CalendarEvent } from "./api";
import { useCalendarViewModel, type CalendarViewModel } from "./useCalendarViewModel";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function EventChip({ event }: { event: CalendarEvent }) {
  const interview = event.kind === "interview";
  return (
    <Link
      to={`/applications/${event.application_id}`}
      title={`${interview ? "Interview" : "Follow up"}: ${event.company}, ${event.role}`}
      className={cn(
        "block truncate rounded px-1.5 py-0.5 text-xs hover:underline",
        interview ? "bg-success/15 text-success" : "bg-warning text-warning-foreground",
      )}
    >
      {interview &&
        `${parseServerDate(event.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} `}
      {event.company}
    </Link>
  );
}

export function CalendarView(vm: CalendarViewModel) {
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground text-sm">
            Interviews (green) and follow-ups due (amber).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous month" onClick={vm.previous}>
            <ChevronLeft />
          </Button>
          <span className="w-36 text-center font-medium">
            {vm.month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </span>
          <Button variant="outline" size="icon" aria-label="Next month" onClick={vm.next}>
            <ChevronRight />
          </Button>
          <Button variant="ghost" size="sm" onClick={vm.today}>
            Today
          </Button>
        </div>
      </div>

      <Card className="hidden py-0 md:block">
        <CardContent className="px-0">
          <div className="grid grid-cols-7 border-b text-center text-xs font-medium">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-muted-foreground py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7" role="grid" aria-label="Month">
            {vm.days.map((day) => (
              <div
                key={day.key}
                role="gridcell"
                aria-label={day.date.toDateString()}
                className={cn(
                  "min-h-24 space-y-1 border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
                  !day.inMonth && "bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs",
                    !day.inMonth && "text-muted-foreground",
                    day.isToday && "bg-primary text-primary-foreground font-semibold",
                  )}
                >
                  {day.date.getDate()}
                </span>
                {day.events.map((e) => (
                  <EventChip key={`${e.kind}-${e.application_id}`} event={e} />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Phones: a simple list instead of a cramped grid */}
      <Card className="md:hidden">
        <CardContent className="space-y-2 text-sm">
          {vm.events.length === 0 && <p className="text-muted-foreground">Nothing this month.</p>}
          {vm.events.map((e) => (
            <div key={`${e.kind}-${e.application_id}`} className="flex items-center gap-3">
              <span className="text-muted-foreground w-16 shrink-0">
                {parseServerDate(e.date).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                })}
              </span>
              <EventChip event={e} />
            </div>
          ))}
        </CardContent>
      </Card>
      {!vm.isLoading && vm.events.length === 0 && (
        <p className="text-muted-foreground hidden text-sm md:block">
          No interviews or follow-ups this month. Add an interview date on a job's Details tab.
        </p>
      )}
    </div>
  );
}

export function CalendarPage() {
  const vm = useCalendarViewModel();
  return <CalendarView {...vm} />;
}
