// View + data: closing dates and assessments due in the next 7 days (and overdue ones).
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, CalendarClock, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDue } from "@/features/applications/api";
import type { DueItem } from "@/features/applications/types";

export function DueThisWeekView({ items }: { items: DueItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlarmClock className="text-primary size-4" /> Due this week
        </CardTitle>
        <CardDescription>Closing dates and assessments in the next 7 days.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing due. 🎉</p>
        ) : (
          <ul className="divide-y text-sm">
            {items.map((item) => {
              const Icon = item.kind === "stage" ? ClipboardCheck : CalendarClock;
              return (
                <li
                  key={`${item.application_id}-${item.kind}`}
                  className="flex items-center gap-3 py-2"
                >
                  <Icon className="text-muted-foreground size-4 shrink-0" />
                  <Link
                    to={
                      item.kind === "deadline"
                        ? `/applications/${item.application_id}/apply`
                        : `/applications/${item.application_id}`
                    }
                    className="min-w-0 flex-1 hover:underline"
                  >
                    <span className="font-semibold">{item.company}</span>
                    <span className="text-muted-foreground"> · {item.role}</span>
                  </Link>
                  <Badge variant={item.days_left < 0 ? "destructive" : "warning"}>
                    {item.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function DueThisWeek() {
  const query = useQuery({ queryKey: ["applications", "due"], queryFn: () => getDue(7) });
  if (!query.data) return null;
  return <DueThisWeekView items={query.data} />;
}
