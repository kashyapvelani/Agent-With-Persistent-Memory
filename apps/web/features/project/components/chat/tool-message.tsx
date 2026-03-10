"use client";

import { useState } from "react";
import { ChevronRight, CheckCircle2, XCircle, Loader2, FileCode } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { useWorkspace } from "../../hooks/use-workspace";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  id?: string;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

// ---------------------------------------------------------------------------
// Tool icon / label mapping
// ---------------------------------------------------------------------------

const TOOL_LABELS: Record<string, string> = {
  read_file: "Read file",
  write_file: "Write file",
  edit_file: "Edit file",
  delete_file: "Delete file",
  list_directory: "List directory",
  glob: "Find files",
  search_files: "Search files",
  search_code: "Search code",
  run_command: "Run command",
  recall_memory: "Recall memory",
  store_memory: "Store memory",
  create_plan: "Create plan",
  request_plan_approval: "Request plan approval",
  request_review_approval: "Request review approval",
  finish: "Finish",
};

function getToolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ");
}

function getToolSummary(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "read_file":
      return String(args.path ?? "");
    case "write_file":
    case "edit_file":
    case "delete_file":
      return String(args.path ?? "");
    case "list_directory":
      return String(args.path ?? "/workspace");
    case "glob":
      return String(args.pattern ?? "");
    case "search_files":
      return `"${args.pattern ?? ""}" in ${args.path ?? "/workspace"}`;
    case "search_code":
      return `"${args.query ?? ""}"`;
    case "run_command":
      return String(args.command ?? "");
    case "recall_memory": {
      const queries = args.queries;
      if (Array.isArray(queries)) return queries.slice(0, 2).join(", ");
      return "";
    }
    default:
      return "";
  }
}

// Tools whose args.path points to a viewable file
const FILE_TOOLS = new Set(["read_file", "write_file", "edit_file"]);

/**
 * Extracts the displayable file content for a tool call.
 * - read_file: content is in the result (full file text)
 * - write_file: content is in args.content (what was written)
 * - edit_file: result is just "Edited: path" — return null to trigger sandbox fetch
 */
function getFileContent(
  toolCall: ToolCall,
  result?: ToolResult,
): string | null {
  if (!FILE_TOOLS.has(toolCall.name)) return null;
  if (toolCall.name === "write_file" && typeof toolCall.args.content === "string") {
    return toolCall.args.content;
  }
  // edit_file result is a confirmation string, not file content — skip it
  if (toolCall.name === "edit_file") return null;
  if (result && !result.isError && result.content) {
    return result.content;
  }
  return null;
}

// ---------------------------------------------------------------------------
// ToolCallGroup — renders a single tool call + optional result
// ---------------------------------------------------------------------------

export function ToolCallGroup({
  toolCall,
  result,
  isPending,
}: {
  toolCall: ToolCall;
  result?: ToolResult;
  isPending?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { openFile } = useWorkspace();
  const label = getToolLabel(toolCall.name);
  const summary = getToolSummary(toolCall.name, toolCall.args);
  const isError = result?.isError || result?.content.startsWith("ERROR:");

  const filePath = FILE_TOOLS.has(toolCall.name)
    ? String(toolCall.args.path ?? "")
    : null;
  const fileContent = getFileContent(toolCall, result);

  const handleOpenFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (filePath) {
      openFile(filePath, fileContent ?? undefined);
    }
  };

  return (
    <div className="group rounded-lg border border-border/50 bg-muted/30 text-sm">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90",
          )}
        />
        {isPending ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : isError ? (
          <XCircle className="size-3.5 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
        )}
        <span className="font-medium text-foreground">{label}</span>
        {summary && (
          <span className="truncate text-muted-foreground">{summary}</span>
        )}
        {filePath && !isPending && !isError && (
          <span
            role="button"
            tabIndex={0}
            className="ml-auto shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleOpenFile}
            onKeyDown={(e) => { if (e.key === "Enter") handleOpenFile(e as unknown as React.MouseEvent); }}
          >
            <FileCode className="size-3" />
            Open
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-3 py-2 space-y-2">
          {/* Args */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Arguments
            </p>
            <pre className="overflow-x-auto rounded bg-muted p-2 text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {result && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Result
              </p>
              <pre
                className={cn(
                  "overflow-x-auto rounded p-2 text-xs whitespace-pre-wrap break-all max-h-60 overflow-y-auto",
                  isError ? "bg-destructive/10 text-destructive" : "bg-muted",
                )}
              >
                {result.content.length > 2000
                  ? result.content.slice(0, 2000) + "\n... (truncated)"
                  : result.content}
              </pre>
            </div>
          )}

          {isPending && !result && (
            <p className="text-xs text-muted-foreground italic">Running...</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolCallList — renders a batch of tool calls from a single AI message
// ---------------------------------------------------------------------------

export function ToolCallList({
  toolCalls,
  results,
  isPending,
}: {
  toolCalls: ToolCall[];
  results: Map<string, ToolResult>;
  isPending?: boolean;
}) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 ml-10 my-1">
      {toolCalls.map((tc) => {
        const id = tc.id ?? tc.name;
        return (
          <ToolCallGroup
            key={id}
            toolCall={tc}
            result={results.get(id)}
            isPending={isPending && !results.has(id)}
          />
        );
      })}
    </div>
  );
}
