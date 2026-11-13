// View: the Settings page (AI provider for now; email and more come in later phases).
import { CheckCircle2, Loader2, PlugZap, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { SettingsViewModel } from "./useSettingsViewModel";

export function SettingsView(vm: SettingsViewModel) {
  const chosen = vm.settings?.providers.find((p) => p.name === vm.provider);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Choose which free AI writes your letters, and how emails are sent.
        </p>
      </div>

      {vm.error && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          {vm.error}
        </div>
      )}
      {vm.isLoading && <Loader2 className="text-muted-foreground size-5 animate-spin" />}

      {vm.settings && (
        <Card>
          <CardHeader>
            <CardTitle>AI provider</CardTitle>
            <CardDescription>
              All three are free. Paste your key under Keys & passwords below; it's never shown
              again or stored in the database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div role="radiogroup" aria-label="AI provider" className="grid gap-3">
              {vm.settings.providers.map((p) => (
                <label
                  key={p.name}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-4",
                    vm.provider === p.name && "border-primary ring-primary/30 ring-2",
                  )}
                >
                  <input
                    type="radio"
                    name="provider"
                    className="accent-primary mt-1 size-4"
                    checked={vm.provider === p.name}
                    onChange={() => vm.chooseProvider(p.name)}
                  />
                  <span className="grid flex-1 gap-1 text-sm">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {p.label}
                      <Badge variant={p.configured ? "success" : "outline"}>
                        {p.configured
                          ? p.name === "ollama"
                            ? "No key needed"
                            : "Key found"
                          : "Not set up"}
                      </Badge>
                    </span>
                    <span className="text-muted-foreground">{p.privacy}</span>
                    {!p.configured && (
                      <span className="text-muted-foreground">Setup: {p.setup}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Model</span>
                <Input
                  value={vm.model}
                  placeholder={chosen?.default_model}
                  onChange={(e) => vm.setModel(e.target.value)}
                />
                <span className="text-muted-foreground text-xs">
                  Default: {chosen?.default_model}. Leave as is unless the provider renames its
                  models.
                </span>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Pause between letters (seconds)</span>
                <Input
                  type="number"
                  min={0}
                  max={120}
                  step={1}
                  value={vm.gap}
                  onChange={(e) => vm.setGap(e.target.value)}
                />
                <span className="text-muted-foreground text-xs">
                  When writing many letters at once. Raise it if you hit free-tier limits.
                </span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={vm.save} disabled={!vm.isDirty || vm.isSaving}>
                {vm.isSaving && <Loader2 className="animate-spin" />}
                Save
              </Button>
              <Button variant="outline" onClick={vm.test} disabled={vm.isTesting || vm.isDirty}>
                {vm.isTesting ? <Loader2 className="animate-spin" /> : <PlugZap />}
                Test connection
              </Button>
              {vm.isDirty && (
                <span className="text-muted-foreground text-xs">Save first, then test.</span>
              )}
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
                {vm.testResult.message} ({vm.testResult.provider} / {vm.testResult.model})
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
