"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, lineNumbers } from "@codemirror/view";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { unifiedMergeView } from "@codemirror/merge";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";

/**
 * Parses a unified diff patch into { original, modified } content.
 * Handles standard `--- a/file` / `+++ b/file` / `@@ ... @@` format.
 */
function parsePatch(patch: string): { original: string; modified: string } {
  const lines = patch.split("\n");
  const originalLines: string[] = [];
  const modifiedLines: string[] = [];

  for (const line of lines) {
    // Skip diff headers
    if (
      line.startsWith("diff ") ||
      line.startsWith("index ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ") ||
      line.startsWith("@@ ")
    ) {
      continue;
    }

    if (line.startsWith("-")) {
      originalLines.push(line.slice(1));
    } else if (line.startsWith("+")) {
      modifiedLines.push(line.slice(1));
    } else if (line.startsWith(" ") || line === "") {
      // Context line (shared)
      const content = line.startsWith(" ") ? line.slice(1) : line;
      originalLines.push(content);
      modifiedLines.push(content);
    }
  }

  return {
    original: originalLines.join("\n"),
    modified: modifiedLines.join("\n"),
  };
}

interface DiffViewerProps {
  patch: string;
  language: string;
}

export function DiffViewer({ patch, language }: DiffViewerProps) {
  void language;

  const { original, modified } = useMemo(() => parsePatch(patch), [patch]);
  const extensions = useMemo(
    () => [
      EditorView.editable.of(false),
      lineNumbers(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      unifiedMergeView({
        original,
        mergeControls: false,
        highlightChanges: true,
        gutter: true,
      }),
      EditorView.theme({
        "&": { height: "100%", fontSize: "13px" },
        ".cm-scroller": { overflow: "auto" },
        ".cm-gutters": { borderRight: "none" },
        ".cm-mergeView .cm-changedLine": { backgroundColor: "var(--cm-diff-bg, rgba(255,220,0,0.1))" },
      }),
    ],
    [original]
  );

  return (
    <div className="h-full overflow-auto">
      <CodeMirror
        value={modified}
        theme={vscodeDark}
        extensions={extensions}
        readOnly
        basicSetup={false}
      />
    </div>
  );
}
