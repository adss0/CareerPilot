// Waits for the backend before showing the app. In the desktop app the bundled server takes a
// few seconds to start; without this, pages showed "empty" and it looked like jobs had gone.
// The start-up screen eases in, then fades away over the app once the engine answers.
import { useEffect, useState, type ReactNode } from "react";

import { fetchHealth } from "@/features/health/api";

const RETRY_MS = 500;
const GIVE_UP_MS = 90_000;
export const SPLASH_EXIT_MS = 250; // matches .splash-exit in index.css

type State = "waiting" | "leaving" | "ready" | "failed";

function Splash({ state }: { state: Exclude<State, "ready"> }) {
  return (
    <div
      role="status"
      aria-busy={state === "waiting"}
      className={
        "bg-sidebar text-sidebar-foreground fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5" +
        (state === "leaving" ? " splash-exit" : "")
      }
    >
      <img src="/favicon.svg" alt="" className="splash-logo size-16 rounded-2xl" />
      <p className="splash-name text-sidebar-strong text-2xl font-bold tracking-tight">
        CareerPilot
      </p>
      {state === "failed" ? (
        <p className="max-w-sm text-center text-sm">
          CareerPilot's engine didn't start. Close the app and open it again. If it keeps happening,
          the log file in %APPDATA%\app.careerpilot.desktop says why.
        </p>
      ) : (
        <div className="splash-status flex flex-col items-center gap-3">
          <div className="bg-sidebar-border h-1 w-36 overflow-hidden rounded-full" aria-hidden>
            <div className="splash-progress bg-primary h-full w-2/5 rounded-full" />
          </div>
          <p className="text-sm">Starting… your jobs will be here in a moment.</p>
        </div>
      )}
    </div>
  );
}

export function BackendGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>("waiting");

  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    const attempt = () => {
      fetchHealth()
        .then(() => !stopped && setState("leaving"))
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

  useEffect(() => {
    if (state !== "leaving") return;
    const timer = setTimeout(() => setState("ready"), SPLASH_EXIT_MS);
    return () => clearTimeout(timer);
  }, [state]);

  const appShown = state === "leaving" || state === "ready";
  return (
    <>
      {appShown && <div className="shell-enter">{children}</div>}
      {state !== "ready" && <Splash state={state} />}
    </>
  );
}
