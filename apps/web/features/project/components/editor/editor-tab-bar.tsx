"use client";

import { X, FileCode, FileDiff } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import type { EditorTab } from "../workspace-provider";

interface EditorTabBarProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export function EditorTabBar({
  tabs,
  activeTabId,
  onSelect,
  onClose,
}: EditorTabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="border-b overflow-x-auto scrollbar-none">
      <div className="flex h-9 items-center">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={cn(
              "group inline-flex h-full items-center gap-1.5 border-r px-3 text-xs transition-colors",
              tab.id === activeTabId
                ? "bg-background text-foreground"
                : "bg-muted/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.mode === "diff" ? (
              <FileDiff className="size-3.5 shrink-0" />
            ) : (
              <FileCode className="size-3.5 shrink-0" />
            )}
            <span className="max-w-35 truncate">{basename(tab.filename)}</span>
            {tab.mode === "diff" && (
              <span className="text-[10px] text-muted-foreground">(diff)</span>
            )}
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  onClose(tab.id);
                }
              }}
              className="ml-1 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
            >
              <X className="size-3" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
