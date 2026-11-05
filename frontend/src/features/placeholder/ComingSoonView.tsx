import { Construction } from "lucide-react";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ComingSoonViewProps {
  title: string;
  phase: string;
}

export function ComingSoonView({ title, phase }: ComingSoonViewProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="size-4 text-muted-foreground" />
            Coming soon
          </CardTitle>
          <CardDescription>This screen is built in {phase}.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
