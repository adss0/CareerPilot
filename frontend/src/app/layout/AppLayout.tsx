import {
  Briefcase,
  CalendarDays,
  FileSpreadsheet,
  LayoutDashboard,
  Monitor,
  Moon,
  Search,
  Send,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { useTheme, type ThemeChoice } from "@/app/themeContext";
import { readApplying } from "@/features/apply/applying";
import { useDesktopNotifications } from "@/features/tracking/useDesktopNotifications";
import { cn } from "@/lib/utils";

import { ComingUp } from "./ComingUp";
import { UpdateNotifier } from "./UpdateNotifier";

const navGroups = [
  {
    label: "Job hunt",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/jobs", label: "Find jobs", icon: Search },
      { to: "/applications", label: "Applications", icon: Briefcase },
      { to: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    label: "You",
    items: [
      { to: "/profile", label: "Profile & CV", icon: User },
      { to: "/import", label: "Import", icon: FileSpreadsheet },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const themes: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="bg-sidebar-hover ring-sidebar-border flex rounded-lg p-0.5 ring-1"
    >
      {themes.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          aria-label={`${label} theme`}
          title={`${label} theme`}
          onClick={() => setChoice(value)}
          className={cn(
            "flex flex-1 items-center justify-center rounded-md px-2 py-1.5 transition-colors",
            choice === value
              ? "bg-sidebar-active text-sidebar-active-foreground"
              : "text-sidebar-muted hover:text-sidebar-strong",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

function Logo() {
  return (
    <span className="text-sidebar-strong flex items-center gap-2.5 text-lg font-bold tracking-tight">
      <img src="/favicon.svg" alt="" className="size-8 rounded-lg" />
      CareerPilot
    </span>
  );
}

/** A way back to the Apply page you left to look at something else. */
function ContinueApplying() {
  const { pathname } = useLocation(); // read again on every page change
  const job = readApplying();
  const path = job ? `/applications/${job.id}/apply` : "";
  if (!job || pathname === path) return null;
  return (
    <Link
      to={path}
      className="border-sidebar-border text-sidebar-foreground hover:bg-sidebar-hover mx-3 mb-2 hidden rounded-lg border px-3 py-2 text-xs md:block"
    >
      <span className="text-primary flex items-center gap-1.5 font-semibold">
        <Send className="size-3.5" /> Continue applying
      </span>
      <span className="mt-0.5 block truncate">
        {job.role} · {job.company}
      </span>
    </Link>
  );
}

export function AppLayout() {
  const notifications = useDesktopNotifications();
  const unseen = notifications?.unseen_replies ?? 0;
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <UpdateNotifier />
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border flex flex-col border-b md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <Logo />
          <div className="w-28 md:hidden">
            <ThemeToggle />
          </div>
        </div>
        <nav
          aria-label="Main"
          className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:gap-5 md:overflow-y-auto md:pb-0"
        >
          {navGroups.map((group) => (
            <div key={group.label} className="flex gap-1 md:flex-col">
              <p className="text-sidebar-muted hidden px-3 pb-1 text-[11px] font-bold tracking-[0.12em] uppercase md:block">
                {group.label}
              </p>
              {group.items.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                      isActive
                        ? "bg-sidebar-active text-sidebar-active-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-strong",
                    )
                  }
                >
                  <Icon className="size-4" />
                  {label}
                  {to === "/applications" && unseen > 0 && (
                    <span
                      className="bg-destructive ml-auto rounded-full px-1.5 text-xs text-white tabular-nums"
                      aria-label={`${unseen} new replies`}
                    >
                      {unseen}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <ContinueApplying />
        <div className="hidden space-y-3 p-4 md:block">
          <ThemeToggle />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-6 md:px-10 md:py-10">
        <div className="mx-auto max-w-[1400px]">
          <ComingUp items={notifications?.upcoming ?? []} />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
