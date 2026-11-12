import {
  Briefcase,
  FileSpreadsheet,
  LayoutDashboard,
  Monitor,
  Moon,
  Plane,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useTheme, type ThemeChoice } from "@/app/themeContext";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/applications", label: "Applications", icon: Briefcase },
  { to: "/import", label: "Import", icon: FileSpreadsheet },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
];

const themes: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="bg-muted flex rounded-md p-0.5">
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
            "flex flex-1 items-center justify-center rounded px-2 py-1",
            choice === value
              ? "bg-background shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="bg-card flex flex-col border-b md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-5 py-4">
          <span className="flex items-center gap-2 text-lg font-semibold">
            <Plane className="text-primary size-5" />
            CareerPilot
          </span>
          <div className="w-24 md:hidden">
            <ThemeToggle />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:pb-0">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden p-3 md:block">
          <ThemeToggle />
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
