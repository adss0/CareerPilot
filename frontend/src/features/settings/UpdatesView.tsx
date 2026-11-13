// View + logic: the app's version and its updates. The desktop app checks by itself a few
// seconds after it starts; this lets you check now and install with one click.
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Download, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchHealth } from "@/features/health/api";
import { isDesktop } from "@/lib/desktop";
import { checkForUpdate, type AvailableUpdate } from "@/lib/updates";

type State =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "latest" }
  | { kind: "available"; update: AvailableUpdate }
  | { kind: "installing"; percent: number }
  | { kind: "error"; message: string };

export function UpdatesView({ desktop = isDesktop() }: { desktop?: boolean }) {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth, retry: false });
  const [state, setState] = useState<State>({ kind: "idle" });

  const check = () => {
    setState({ kind: "checking" });
    checkForUpdate()
      .then((update) => setState(update ? { kind: "available", update } : { kind: "latest" }))
      .catch(() =>
        setState({
          kind: "error",
          message: "Couldn't check for updates. Are you online? Try again later.",
        }),
      );
  };

  const install = (update: AvailableUpdate) => {
    setState({ kind: "installing", percent: 0 });
    update
      .install((percent) => setState({ kind: "installing", percent }))
      .catch(() =>
        setState({ kind: "error", message: "The update couldn't be installed. Try again later." }),
      );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="size-4" /> Updates
        </CardTitle>
        <CardDescription>
          You're on CareerPilot {health.data?.version ?? "…"}.{" "}
          {desktop
            ? "It checks for a new version a few seconds after it opens, and only installs updates signed by the CareerPilot project."
            : "Updates are for the desktop app; in development, pull the latest code instead."}
        </CardDescription>
      </CardHeader>
      {desktop && (
        <CardContent className="space-y-3 text-sm">
          {state.kind === "available" ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 font-semibold">
                <Sparkles className="text-primary size-4" /> Version {state.update.version} is
                available.
              </p>
              <Button onClick={() => install(state.update)}>
                <Download /> Install and restart
              </Button>
            </div>
          ) : state.kind === "installing" ? (
            <p className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Downloading the update… {state.percent}%
              (CareerPilot restarts when it's done)
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={check} disabled={state.kind === "checking"}>
                {state.kind === "checking" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Check for updates
              </Button>
              {state.kind === "latest" && (
                <span className="text-success flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-4" /> You have the latest version.
                </span>
              )}
              {state.kind === "error" && (
                <span role="alert" className="text-destructive">
                  {state.message}
                </span>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
