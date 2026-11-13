// View: email settings card on the Settings page.
import { CheckCircle2, Loader2, PlugZap, ShieldCheck, XCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { EmailSettings } from "./api";
import { PRESETS, type EmailSettingsViewModel } from "./useEmailSettingsViewModel";

function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={cn("grid gap-1.5 text-sm", wide && "sm:col-span-2")}>
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </label>
  );
}

export function EmailSettingsView(vm: EmailSettingsViewModel) {
  if (!vm.form || !vm.saved) return null;
  const f = vm.form;
  const num = (key: keyof EmailSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    vm.change({ [key]: Number(e.target.value) } as Partial<EmailSettings>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Email
          <Badge variant={vm.saved.ready ? "success" : "outline"}>
            {vm.saved.ready ? "Ready" : "Not set up"}
          </Badge>
          {f.test_mode && <Badge variant="secondary">Test mode</Badge>}
        </CardTitle>
        <CardDescription>
          Sends approved applications from your own address. Paste your App Password under Keys &
          passwords; it's never stored in the database or shown again.{" "}
          {vm.saved.password_set ? "✓ Password found." : "No password found yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {vm.saved.problems.length > 0 && (
          <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-sm">
            {vm.saved.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        <div
          className={cn(
            "flex items-start gap-3 rounded-lg border p-4",
            f.test_mode ? "border-warning-border bg-warning text-warning-foreground" : "",
          )}
        >
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <div className="grid flex-1 gap-2 text-sm">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={f.test_mode}
                onChange={(e) => vm.change({ test_mode: e.target.checked })}
              />
              Test mode: send everything to me instead of employers
            </label>
            <p>
              Keep this on until you've checked a few emails in your own inbox. Turning it off means
              approved emails really go to employers.
            </p>
            {f.test_mode && (
              <Input
                className="bg-background max-w-xs"
                type="email"
                placeholder="Test address (defaults to your From address)"
                value={f.test_address ?? ""}
                onChange={(e) => vm.change({ test_address: e.target.value })}
              />
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name">
            <Input value={f.from_name} onChange={(e) => vm.change({ from_name: e.target.value })} />
          </Field>
          <Field label="Your email (From)">
            <Input
              type="email"
              value={f.from_address ?? ""}
              onChange={(e) => vm.change({ from_address: e.target.value })}
            />
          </Field>
          <Field label="Provider" hint="Fills in the server details below.">
            <NativeSelect
              value=""
              onChange={(e) => e.target.value && vm.change(PRESETS[e.target.value])}
            >
              <option value="">Choose to fill in…</option>
              {Object.keys(PRESETS).map((name) => (
                <option key={name}>{name}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Login username" hint="Usually your email address. Leave blank to use it.">
            <Input value={f.username} onChange={(e) => vm.change({ username: e.target.value })} />
          </Field>
          <Field label="SMTP server (sending)">
            <Input value={f.smtp_host} onChange={(e) => vm.change({ smtp_host: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Port">
              <Input type="number" value={f.smtp_port} onChange={num("smtp_port")} />
            </Field>
            <Field label="Security">
              <NativeSelect
                value={f.smtp_security}
                onChange={(e) =>
                  vm.change({ smtp_security: e.target.value as EmailSettings["smtp_security"] })
                }
              >
                <option value="starttls">STARTTLS</option>
                <option value="ssl">SSL/TLS</option>
                <option value="none">None (this computer only)</option>
              </NativeSelect>
            </Field>
          </div>
          <Field label="IMAP server (reading replies)">
            <Input value={f.imap_host} onChange={(e) => vm.change({ imap_host: e.target.value })} />
          </Field>
          <Field label="IMAP port">
            <Input type="number" value={f.imap_port} onChange={num("imap_port")} />
          </Field>
          <Field label="Most emails per day" hint="Protects your account from spam filters.">
            <Input
              type="number"
              min={1}
              max={100}
              value={f.daily_limit}
              onChange={num("daily_limit")}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pause from (s)">
              <Input
                type="number"
                min={0}
                value={f.min_gap_seconds}
                onChange={num("min_gap_seconds")}
              />
            </Field>
            <Field label="to (s)">
              <Input
                type="number"
                min={0}
                value={f.max_gap_seconds}
                onChange={num("max_gap_seconds")}
              />
            </Field>
          </div>
          <Field label="Follow up after (days)" hint="When to remind you if there's no reply.">
            <Input
              type="number"
              min={1}
              max={60}
              value={f.follow_up_days}
              onChange={num("follow_up_days")}
            />
          </Field>
          <Field label="Signature" wide>
            <Textarea
              rows={3}
              value={f.signature}
              onChange={(e) => vm.change({ signature: e.target.value })}
            />
          </Field>
        </div>

        <details className="text-muted-foreground text-sm">
          <summary className="text-foreground cursor-pointer font-medium">
            Using Gmail? How to get an App Password
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Turn on 2-Step Verification for your Google account.</li>
            <li>
              Open <span className="text-foreground">myaccount.google.com/apppasswords</span> and
              create one called "CareerPilot".
            </li>
            <li>Paste the 16-letter password under Keys & passwords and click Save.</li>
          </ol>
        </details>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={vm.save} disabled={!vm.isDirty || vm.isSaving}>
            {vm.isSaving && <Loader2 className="animate-spin" />}
            Save
          </Button>
          {vm.isDirty && (
            <Button variant="outline" onClick={vm.discard}>
              Discard
            </Button>
          )}
          <Button variant="outline" onClick={vm.test} disabled={vm.isTesting || vm.isDirty}>
            {vm.isTesting ? <Loader2 className="animate-spin" /> : <PlugZap />}
            Test connection
          </Button>
        </div>
        {vm.testResult && (
          <p
            role="status"
            className={cn(
              "flex items-start gap-2 text-sm",
              vm.testResult.ok ? "text-success" : "text-destructive",
            )}
          >
            {vm.testResult.ok ? (
              <CheckCircle2 className="mt-0.5 size-4" />
            ) : (
              <XCircle className="mt-0.5 size-4" />
            )}
            {vm.testResult.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
