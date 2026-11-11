// View + page: add a job by hand.
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { JobFormView } from "./JobFormView";
import {
  useNewApplicationViewModel,
  type NewApplicationViewModel,
} from "./useNewApplicationViewModel";

export function NewApplicationView(vm: NewApplicationViewModel) {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="space-y-2">
        <Link
          to="/applications"
          className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
        >
          <ArrowLeft className="size-4" /> Applications
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Add a job</h1>
        <p className="text-muted-foreground text-sm">
          For one job at a time. To add many,{" "}
          <Link to="/import" className="text-primary underline">
            import a spreadsheet
          </Link>
          .
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          vm.submit();
        }}
      >
        <Card>
          <CardContent className="space-y-4">
            <JobFormView
              values={vm.values}
              problems={vm.problems}
              cvs={vm.cvs}
              onChange={vm.change}
            />
            <Button type="submit" disabled={vm.isSaving}>
              {vm.isSaving && <Loader2 className="animate-spin" />}
              Add job
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

export function NewApplicationPage() {
  const vm = useNewApplicationViewModel();
  return <NewApplicationView {...vm} />;
}
