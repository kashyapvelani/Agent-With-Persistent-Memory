"use client";

import { useState } from "react";
import {
  X,
  GitPullRequestArrow,
  Loader2,
  ExternalLink,
  CircleDot,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { useWorkspace } from "../../hooks/use-workspace";
import { EditorTabBar } from "./editor-tab-bar";
import { CodeEditor } from "./code-editor";
import { DiffViewer } from "./diff-viewer";

export function EditorPanel() {
  const {
    openTabs,
    activeTabId,
    setActiveTab,
    closeTab,
    setEditorVisible,
    sandboxId,
    sandboxAlive,
    sandboxChecking,
    commitAndPR,
    isCommitting,
    lastCommitResult,
    isStreaming,
  } = useWorkspace();
  const activeTab = openTabs.find((t) => t.id === activeTabId) ?? null;
  const [commitError, setCommitError] = useState<string | null>(null);

  const canCommit = sandboxAlive && !isCommitting && !isStreaming;

  // Determine the button tooltip
  let commitTooltip = "";
  if (!sandboxId) commitTooltip = "No sandbox — run the agent first";
  else if (sandboxChecking) commitTooltip = "Checking sandbox status...";
  else if (!sandboxAlive) commitTooltip = "Sandbox expired — start a new session";
  else if (isStreaming) commitTooltip = "Wait for the agent to finish";

  async function handleCommit() {
    setCommitError(null);
    try {
      const result = await commitAndPR();
      window.open(result.prUrl, "_blank", "noopener");
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : "Commit failed");
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header: tabs + actions */}
      <div className="flex items-center border-b">
        <div className="flex-1 min-w-0">
          <EditorTabBar
            tabs={openTabs}
            activeTabId={activeTabId}
            onSelect={setActiveTab}
            onClose={closeTab}
          />
        </div>

        <div className="flex items-center gap-1.5 px-2 shrink-0">
          {/* Sandbox status indicator */}
          {sandboxId && (
            <span
              className="flex items-center gap-1 text-xs text-muted-foreground"
              title={
                sandboxChecking
                  ? "Checking..."
                  : sandboxAlive
                    ? "Sandbox active"
                    : "Sandbox expired"
              }
            >
              <CircleDot
                className={`size-3 ${
                  sandboxChecking
                    ? "text-yellow-500 animate-pulse"
                    : sandboxAlive
                      ? "text-green-500"
                      : "text-red-400"
                }`}
              />
            </span>
          )}

          {lastCommitResult && (
            <a
              href={lastCommitResult.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              PR #{lastCommitResult.prNumber}
              <ExternalLink className="size-3" />
            </a>
          )}

          <Button
            variant="default"
            size="sm"
            className="gap-1.5"
            disabled={!canCommit}
            onClick={handleCommit}
            title={commitTooltip}
          >
            {isCommitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <GitPullRequestArrow className="size-3.5" />
            )}
            {isCommitting ? "Committing..." : "Commit & PR"}
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditorVisible(false)}
            aria-label="Close editor panel"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Error banner */}
      {commitError && (
        <div className="bg-destructive/10 text-destructive text-xs px-3 py-1.5 flex items-center justify-between">
          <span>{commitError}</span>
          <button
            className="ml-2 underline text-xs"
            onClick={() => setCommitError(null)}
          >
            dismiss
          </button>
        </div>
      )}

      {/* Editor body */}
      <div className="flex-1 overflow-hidden">
        {activeTab ? (
          activeTab.mode === "diff" && activeTab.patch ? (
            <DiffViewer
              patch={activeTab.patch}
              language={activeTab.language}
            />
          ) : (
            <CodeEditor
              content={activeTab.content}
              language={activeTab.language}
            />
          )
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <p className="text-sm">No files open</p>
          </div>
        )}
      </div>
    </div>
  );
}
