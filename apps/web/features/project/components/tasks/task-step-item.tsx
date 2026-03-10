"use client";

import type { PlanStep } from "@workspace/types";
import { Badge } from "@workspace/ui/components/badge";
import {
  Loader2,
  Circle,
  CheckCircle2,
  XCircle,
  FileCode,
} from "lucide-react";

import { cn } from "@workspace/ui/lib/utils";

const statusConfig = {
  pending: {
    icon: Circle,
    className: "text-muted-foreground",
    animate: false,
  },
  in_progress: {
    icon: Loader2,
    className: "text-blue-500",
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    className: "text-green-500",
    animate: false,
  },
  failed: {
    icon: XCircle,
    className: "text-destructive",
    animate: false,
  },
} as const;

const actionVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  edit: "secondary",
  delete: "destructive",
};

interface TaskStepItemProps {
  step: PlanStep;
  onFileClick?: (filename: string) => void;
}

export function TaskStepItem({ step, onFileClick }: TaskStepItemProps) {
  const config = statusConfig[step.status];
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted/50 transition-colors">
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          config.className,
          config.animate && "animate-spin",
        )}
      />
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm leading-tight">{step.step}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {step.file && (
            <button
              type="button"
              onClick={() => onFileClick?.(step.file)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileCode className="size-3" />
              <span className="truncate max-w-50">{step.file}</span>
            </button>
          )}
          <Badge variant={actionVariant[step.action] ?? "outline"} className="text-[10px] px-1.5 py-0">
            {step.action}
          </Badge>
        </div>
      </div>
    </div>
  );
}
