import { createBrowserRouter, createHashRouter } from "react-router-dom";

import { AppLayout } from "@/app/layout/AppLayout";
import { ApplicationDetailPage } from "@/features/applications/ApplicationDetailPage";
import { ApplicationsPage } from "@/features/applications/ApplicationsPage";
import { NewApplicationPage } from "@/features/applications/NewApplicationPage";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { ImportPage } from "@/features/imports/ImportPage";
import { ProfilePage } from "@/features/profile/ProfilePage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { CalendarPage } from "@/features/tracking/CalendarPage";

// The desktop app has no web server to send deep links back to index.html, so it uses #/ URLs.
const createRouter = import.meta.env.VITE_DESKTOP === "1" ? createHashRouter : createBrowserRouter;

export const router = createRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <DashboardPage /> },
      { path: "/applications", element: <ApplicationsPage /> },
      { path: "/applications/new", element: <NewApplicationPage /> },
      { path: "/applications/:id", element: <ApplicationDetailPage /> },
      { path: "/calendar", element: <CalendarPage /> },
      { path: "/import", element: <ImportPage /> },
      { path: "/profile", element: <ProfilePage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);
