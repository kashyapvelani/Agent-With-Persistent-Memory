"use client";

import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { Separator } from "@workspace/ui/components/separator";
import { ListChecks } from "lucide-react";
import { useWorkspace } from "../../hooks/use-workspace";
import { TaskStepItem } from "./task-step-item";

export function TaskPanel() {
  const { plan, openFile } = useWorkspace();

  const activeSteps = plan?.filter(
    (s) => s.status === "pending" || s.status === "in_progress",
  ) ?? [];
  const completedSteps = plan?.filter(
    (s) => s.status === "completed" || s.status === "failed",
  ) ?? [];

  if (!plan || plan.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-muted-foreground">
        <ListChecks className="size-10 opacity-40" />
        <p className="text-sm">No tasks yet</p>
        <p className="text-xs text-center max-w-50">
          Tasks will appear here once the agent starts working.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <ListChecks className="size-4" />
        <h3 className="text-sm font-medium">Tasks</h3>
        <span className="ml-auto text-xs text-muted-foreground">
          {completedSteps.length}/{plan.length}
        </span>
      </div>

      <ScrollArea className="flex-1">
        {activeSteps.length > 0 && (
          <div className="p-2">
            <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active
            </p>
            {activeSteps.map((step, i) => (
              <TaskStepItem
                key={`active-${i}`}
                step={step}
                onFileClick={openFile}
              />
            ))}
          </div>
        )}

        {activeSteps.length > 0 && completedSteps.length > 0 && (
          <Separator />
        )}

        {completedSteps.length > 0 && (
          <div className="p-2">
            <p className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Completed
            </p>
            {completedSteps.map((step, i) => (
              <TaskStepItem
                key={`done-${i}`}
                step={step}
                onFileClick={openFile}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
