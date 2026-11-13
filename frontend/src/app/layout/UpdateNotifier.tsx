// Desktop only: a few seconds after start, checks for a new version and offers to install it.
import { useEffect } from "react";
import { toast } from "sonner";

import { checkForUpdate } from "@/lib/updates";

export function UpdateNotifier() {
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdate()
        .then((update) => {
          if (!update) return;
          toast(`CareerPilot ${update.version} is available`, {
            description: "Install it now? The app restarts when it's done (about a minute).",
            duration: Infinity,
            action: {
              label: "Update",
              onClick: () => {
                const id = toast.loading("Downloading the update…");
                update
                  .install((percent) =>
                    toast.loading(`Downloading the update… ${percent}%`, { id }),
                  )
                  .catch(() =>
                    toast.error("The update couldn't be installed. Try again later.", { id }),
                  );
              },
            },
          });
        })
        .catch(() => undefined); // offline, or no release yet: try again next start
    }, 5000);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
