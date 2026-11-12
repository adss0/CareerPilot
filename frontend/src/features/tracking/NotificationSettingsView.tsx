// View + tiny ViewModel: allow desktop notifications (Settings page).
import { Bell } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { notificationsSupported } from "./useDesktopNotifications";

export function NotificationSettingsView() {
  const supported = notificationsSupported();
  const [permission, setPermission] = useState(supported ? Notification.permission : "denied");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-4" /> Desktop notifications
          <Badge variant={permission === "granted" ? "success" : "outline"}>
            {permission === "granted" ? "On" : "Off"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Get a notification when an employer replies or a follow-up is due, while CareerPilot is
          open.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {!supported ? (
          <p className="text-muted-foreground">This browser doesn't support notifications.</p>
        ) : permission === "granted" ? (
          <p className="text-muted-foreground">
            On. To turn them off, use your browser's site settings.
          </p>
        ) : permission === "denied" ? (
          <p className="text-muted-foreground">
            Blocked in your browser. Allow them in the site settings to turn them on.
          </p>
        ) : (
          <Button
            variant="outline"
            onClick={() => void Notification.requestPermission().then(setPermission)}
          >
            <Bell /> Turn on notifications
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
