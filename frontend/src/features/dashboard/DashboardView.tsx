import { FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackendStatus } from "@/features/health/BackendStatus";

import type { DashboardViewModel } from "./useDashboardViewModel";

export function DashboardView({ stats }: DashboardViewModel) {
  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="gap-2">
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{stat.value ?? "-"}</CardTitle>
              <CardDescription className="text-xs">{stat.hint}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="max-w-xl">
        <BackendStatus />
      </div>
    </div>
  );
}
