import { AlarmClock, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BackendStatus } from "@/features/health/BackendStatus";
import { useChartColors } from "@/lib/chartColors";

import type { DashboardViewModel } from "./useDashboardViewModel";

const tooltip = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--card-foreground)",
  },
  cursor: { fill: "var(--muted)" },
};

export function DashboardView(vm: DashboardViewModel) {
  const colors = useChartColors();
  const axis = { fontSize: 12, fill: colors.muted };
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Your job search at a glance.</p>
        </div>
        <Button asChild>
          <Link to="/import">
            <FileSpreadsheet />
            Import jobs
          </Link>
        </Button>
      </div>

      {vm.error && <p className="text-destructive text-sm">{vm.error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {vm.isLoading
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          : vm.stats.map((stat) => (
              <Card key={stat.label} className="gap-2">
                <CardHeader>
                  <CardDescription>{stat.label}</CardDescription>
                  <CardTitle className="text-3xl tabular-nums">{stat.value}</CardTitle>
                  <CardDescription className="text-xs">{stat.hint}</CardDescription>
                </CardHeader>
              </Card>
            ))}
      </div>

      {vm.isEmpty && (
        <Card>
          <CardContent className="text-muted-foreground text-sm">
            No jobs yet.{" "}
            <Link to="/import" className="text-primary underline">
              Import a spreadsheet
            </Link>{" "}
            or{" "}
            <Link to="/applications/new" className="text-primary underline">
              add a job
            </Link>{" "}
            to get started.
          </CardContent>
        </Card>
      )}

      {!vm.isLoading && !vm.isEmpty && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Applications by status</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vm.statusChart} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid vertical={false} stroke={colors.border} />
                  <XAxis
                    dataKey="label"
                    tick={axis}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis allowDecimals={false} tick={axis} />
                  <Tooltip {...tooltip} />
                  <Bar
                    dataKey="count"
                    name="Applications"
                    fill={colors.primary}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Jobs added per week</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vm.weeklyChart} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid vertical={false} stroke={colors.border} />
                  <XAxis dataKey="week" tick={axis} />
                  <YAxis allowDecimals={false} tick={axis} />
                  <Tooltip {...tooltip} />
                  <Bar dataKey="count" name="Added" fill={colors.success} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlarmClock className="size-4" /> Follow-ups due
            </CardTitle>
            <CardDescription>
              Sent applications with no reply, due in the next 7 days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vm.followUps.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing due. 🎉</p>
            ) : (
              <ul className="divide-y">
                {vm.followUps.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link to={`/applications/${f.id}`} className="min-w-0 hover:underline">
                      <span className="block truncate font-medium">{f.company}</span>
                      <span className="text-muted-foreground block truncate">{f.role}</span>
                    </Link>
                    <Badge variant={f.overdue ? "destructive" : "secondary"}>
                      {f.overdue ? "Overdue" : new Date(f.follow_up_at).toLocaleDateString()}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <BackendStatus />
      </div>
    </div>
  );
}
