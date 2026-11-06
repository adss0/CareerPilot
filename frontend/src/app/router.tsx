import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/app/layout/AppLayout";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ImportPage } from "@/features/imports/ImportPage";
import { ComingSoonView } from "@/features/placeholder/ComingSoonView";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      {
        path: "/applications",
        element: <ComingSoonView title="Applications" phase="Phase 5" />,
      },
      { path: "/import", element: <ImportPage /> },
      { path: "/profile", element: <ComingSoonView title="Profile" phase="Phase 3" /> },
      { path: "/settings", element: <ComingSoonView title="Settings" phase="Phase 5" /> },
    ],
  },
]);
