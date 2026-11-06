import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/app/layout/AppLayout";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ImportPage } from "@/features/imports/ImportPage";
import { ComingSoonView } from "@/features/placeholder/ComingSoonView";
import { ProfilePage } from "@/features/profile/ProfilePage";

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
      { path: "/profile", element: <ProfilePage /> },
      { path: "/settings", element: <ComingSoonView title="Settings" phase="Phase 5" /> },
    ],
  },
]);
