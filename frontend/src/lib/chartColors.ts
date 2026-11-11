// SVG colour attributes (fill, stroke) can't use CSS var(), so charts get the theme's real colours.
import { useMemo } from "react";

import { useTheme } from "@/app/themeContext";

export interface ChartColors {
  primary: string;
  success: string;
  muted: string;
  border: string;
}

function read(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function useChartColors(): ChartColors {
  const { resolved } = useTheme();
  return useMemo(
    () => ({
      primary: read("--primary", "#4f46e5"),
      success: read("--success", "#16a34a"),
      muted: read("--muted-foreground", "#737373"),
      border: read("--border", "#e5e5e5"),
    }),
    // Re-read when the theme changes (the class on <html> is updated before this runs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolved],
  );
}
