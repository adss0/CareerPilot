// Desktop only: keeps CareerPilot up to date. A few seconds after it opens it checks for a new
// signed version and, unless automatic updates are off, installs it and restarts (a backup is
// made first if the update changes the database). While it's open it checks again every few
// hours, but then only offers the update, so it never restarts in the middle of your work.
import { useEffect } from "react";
import { toast } from "sonner";

import { autoUpdateEnabled, checkForUpdate, type AvailableUpdate } from "@/lib/updates";

const FIRST_CHECK_MS = 5_000;
const RECHECK_MS = 6 * 60 * 60 * 1000;

function install(update: AvailableUpdate) {
  const id = toast.loading(`Updating CareerPilot to ${update.version}…`, {
    description: "It restarts by itself when it's done (about a minute).",
  });
  update
    .install((percent) =>
      toast.loading(`Updating CareerPilot to ${update.version}… ${percent}%`, { id }),
    )
    .catch(() => toast.error("The update couldn't be installed. Try again later.", { id }));
}

function offer(update: AvailableUpdate) {
  toast(`CareerPilot ${update.version} is available`, {
    id: `update-${update.version}`, // one message per version, however often it checks
    description: "Install it now? The app restarts when it's done (about a minute).",
    duration: Infinity,
    action: { label: "Update", onClick: () => install(update) },
  });
}

export function UpdateNotifier() {
  useEffect(() => {
    let installing = false;
    const run = (atStart: boolean) => {
      if (installing) return;
      checkForUpdate()
        .then((update) => {
          if (!update) return;
          if (atStart && autoUpdateEnabled()) {
            installing = true;
            install(update);
          } else {
            offer(update);
          }
        })
        .catch(() => undefined); // offline, or no release yet: try again later
    };
    const first = setTimeout(() => run(true), FIRST_CHECK_MS);
    const again = setInterval(() => run(false), RECHECK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(again);
    };
  }, []);
  return null;
}
