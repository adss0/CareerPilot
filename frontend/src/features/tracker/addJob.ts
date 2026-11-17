// Opening the Add a job dialog from anywhere: a button, or Ctrl+N on any page. The dialog
// itself (QuickAddJob) lives in the app layout.
import { useEffect, useState } from "react";

const ADD_JOB_EVENT = "careerpilot:add-job";

export const openAddJob = () => window.dispatchEvent(new Event(ADD_JOB_EVENT));

/** [whether the dialog is open, a function that closes it]. */
export function useAddJobDialog(): [boolean, () => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault(); // otherwise the desktop app would try to open a second window
        show();
      }
    };
    window.addEventListener(ADD_JOB_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(ADD_JOB_EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return [open, () => setOpen(false)];
}
