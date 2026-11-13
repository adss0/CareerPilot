import {
  Briefcase,
  CalendarDays,
  FileSpreadsheet,
  LayoutDashboard,
  Monitor,
  Moon,
  Plane,
  Search,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useTheme, type ThemeChoice } from "@/app/themeContext";
import { useDesktopNotifications } from "@/features/tracking/useDesktopNotifications";
import { cn } from "@/lib/utils";

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
      className="flex rounded-lg bg-white/6 p-0.5 ring-1 ring-sidebar-border"
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
              : "text-sidebar-muted hover:text-white",
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
    <span className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white">
      <span className="bg-sidebar-active text-sidebar-active-foreground flex size-8 items-center justify-center rounded-lg shadow-[0_0_24px_-4px_var(--sidebar-active)]">
        <Plane className="size-4 -rotate-12" />
      </span>
      CareerPilot
    </span>
  );
}

export function AppLayout() {
  const notifications = useDesktopNotifications();
  const unseen = notifications?.unseen_replies ?? 0;
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-sidebar text-sidebar-foreground flex flex-col md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0">
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
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                      isActive
                        ? "bg-sidebar-active text-sidebar-active-foreground shadow-[0_6px_20px_-8px_var(--sidebar-active)]"
                        : "text-sidebar-foreground hover:bg-white/6 hover:text-white",
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
        <div className="hidden space-y-3 p-4 md:block">
          <ThemeToggle />
        </div>
      </aside>
      <main className="page-glow min-w-0 flex-1 px-5 py-6 md:px-10 md:py-9">
        <div className="mx-auto max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
