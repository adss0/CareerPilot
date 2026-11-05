import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/app/layout/AppLayout";
import { DashboardView } from "@/features/dashboard/DashboardView";
import { ComingSoonView } from "@/features/placeholder/ComingSoonView";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <DashboardView /> },
      {
        path: "/applications",
        element: <ComingSoonView title="Applications" phase="Phase 5" />,
      },
      { path: "/import", element: <ComingSoonView title="Import" phase="Phase 2" /> },
      { path: "/profile", element: <ComingSoonView title="Profile" phase="Phase 3" /> },
      { path: "/settings", element: <ComingSoonView title="Settings" phase="Phase 5" /> },
    ],
  },
]);
