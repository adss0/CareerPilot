// View: renders props only. No fetching or business logic.
import { RefreshCw, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { HealthViewModel } from "./useHealthViewModel";

const statusLabel = {
  checking: { text: "Checking…", variant: "secondary" },
  online: { text: "Online", variant: "success" },
  offline: { text: "Offline", variant: "destructive" },
} as const;

export function BackendStatusView({
  status,
  version,
  aiProvider,
  isRefreshing,
  refresh,
}: HealthViewModel) {
  const label = statusLabel[status];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="size-4 text-muted-foreground" />
          Backend
          <Badge variant={label.variant} aria-label="backend status">
            {label.text}
          </Badge>
        </CardTitle>
        <CardDescription>
          {status === "offline"
            ? "Can't reach the API. Start it with: uvicorn app.main:app --reload"
            : "The local API that runs imports, AI and email."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Version</dt>
          <dd>{version ?? "-"}</dd>
          <dt className="text-muted-foreground">AI provider</dt>
          <dd className="capitalize">{aiProvider ?? "-"}</dd>
        </dl>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
          <RefreshCw className={isRefreshing ? "animate-spin" : undefined} />
          Check again
        </Button>
      </CardContent>
    </Card>
  );
}
