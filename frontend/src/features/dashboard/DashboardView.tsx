import { BackendStatus } from "@/features/health/BackendStatus";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  { label: "Applications", hint: "Import from Excel in Phase 2" },
  { label: "Sent", hint: "Email sending in Phase 6" },
  { label: "Interviews", hint: "Tracking in Phase 7" },
  { label: "Response rate", hint: "Stats in Phase 7" },
];

export function DashboardView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Your job search at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="gap-2">
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">0</CardTitle>
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
