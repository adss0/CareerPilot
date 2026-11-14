// View: the Profile page. Renders what the ViewModel gives it.
import { CheckCircle2, Loader2, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { CvPanelView } from "./CvPanelView";
import { MainLetterView } from "./MainLetterView";
import { ProfileFormView } from "./ProfileFormView";
import type { ProfileViewModel } from "./useProfileViewModel";

export function ProfileView(vm: ProfileViewModel) {
  return (
    <div className="max-w-6xl space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm">
          Who you are. CareerPilot uses these details, and only these, to write your CVs and cover
          letters.
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

      {vm.parseNotice && (
        <div
          role="status"
          className="bg-accent text-accent-foreground relative rounded-lg px-4 py-3 pr-10 text-sm"
        >
          <p className="flex items-center gap-2 font-medium">
            <Sparkles className="size-4" />
            Filled in from "{vm.parseNotice.cvLabel}"
            {vm.parseNotice.parser === "ai" ? " with AI" : " with the built-in reader"}. Check
            everything, fix anything that's wrong, then save.
          </p>
          {vm.parseNotice.warnings.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-6">
              {vm.parseNotice.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            className="absolute top-3 right-3 rounded p-0.5 hover:bg-white/40"
            onClick={vm.dismissNotice}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {vm.isLoading && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading your profile…
        </p>
      )}
      {vm.loadError && <p className="text-destructive text-sm">{vm.loadError}</p>}

      {vm.form && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="order-2 space-y-6 lg:order-1">
            <ProfileFormView
              form={vm.form}
              onSetField={vm.setField}
              onAddSkill={vm.addSkill}
              onRemoveSkill={vm.removeSkill}
              onAddItem={vm.addItem}
              onUpdateItem={vm.updateItem}
              onRemoveItem={vm.removeItem}
            />
            <MainLetterView />
          </div>
          <div className="order-1 lg:sticky lg:top-6 lg:order-2">
            <CvPanelView
              cvs={vm.cvs}
              isUploading={vm.isUploading}
              busyCvId={vm.busyCvId}
              aiConfigured={vm.aiConfigured}
              useAi={vm.useAi}
              onUseAiChange={vm.setUseAi}
              onUpload={vm.uploadCv}
              onReadAgain={vm.readCvAgain}
              onMakeDefault={vm.makeDefault}
              onRename={vm.renameCv}
              onRemove={vm.removeCv}
            />
          </div>
        </div>
      )}

      {(vm.isDirty || vm.savedAt) && (
        <div className="bg-card fixed inset-x-0 bottom-0 z-10 border-t shadow-lg md:left-60">
          <div className="flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3 md:px-8">
            {vm.isDirty ? (
              <>
                <p className="text-sm font-medium">You have unsaved changes.</p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={vm.discard} disabled={vm.isSaving}>
                    Discard
                  </Button>
                  <Button onClick={vm.save} disabled={vm.isSaving}>
                    {vm.isSaving && <Loader2 className="animate-spin" />}
                    Save profile
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-success flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4" /> Profile saved.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
