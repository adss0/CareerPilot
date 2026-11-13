import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { Toaster, toast } from "sonner";

import { BackendGate } from "@/app/BackendGate";
import { router } from "@/app/router";
import { ThemeProvider } from "@/app/theme";
import { useTheme } from "@/app/themeContext";
import { installDesktopLinkHandling } from "@/lib/desktop";

const queryClient = new QueryClient();

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} richColors closeButton position="bottom-right" />;
}

export function App() {
  useEffect(() => installDesktopLinkHandling((message) => toast.error(message)), []);
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BackendGate>
          <RouterProvider router={router} />
        </BackendGate>
        <ThemedToaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
