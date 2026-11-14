// Waits for the backend before showing the app. In the desktop app the bundled server takes a
// few seconds to start; without this, pages showed "empty" and it looked like jobs had gone.
import { Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { fetchHealth } from "@/features/health/api";

const RETRY_MS = 500;
const GIVE_UP_MS = 90_000;

export function BackendGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"waiting" | "ready" | "failed">("waiting");

  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    const attempt = () => {
      fetchHealth()
        .then(() => !stopped && setState("ready"))
        .catch(() => {
          if (stopped) return;
          if (Date.now() - started > GIVE_UP_MS) setState("failed");
          else setTimeout(attempt, RETRY_MS);
        });
    };
    attempt();
    return () => {
      stopped = true;
    };
  }, []);

  if (state === "ready") return <>{children}</>;
  return (
    <div
      role="status"
      className="bg-sidebar text-sidebar-foreground flex min-h-screen flex-col items-center justify-center gap-5"
    >
      <img src="/favicon.svg" alt="" className="size-16 rounded-2xl" />
      <p className="text-sidebar-strong text-2xl font-bold tracking-tight">CareerPilot</p>
      {state === "waiting" ? (
        <p className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Starting… your jobs will be here in a moment.
        </p>
      ) : (
        <p className="max-w-sm text-center text-sm">
          CareerPilot's engine didn't start. Close the app and open it again. If it keeps happening,
          the log file in %APPDATA%\app.careerpilot.desktop says why.
        </p>
      )}
    </div>
  );
}
