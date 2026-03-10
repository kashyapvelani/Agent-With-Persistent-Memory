"use client";

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { syntaxHighlighting, defaultHighlightStyle, StreamLanguage } from "@codemirror/language";
// import { githubDark } from "@uiw/codemirror-theme-github";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";

// Language imports — loaded lazily
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";

function getLanguageExtension(language: string) {
  switch (language) {
    case "typescript":
      return javascript({ typescript: true, jsx: true });
    case "javascript":
      return javascript({ jsx: true });
    case "python":
      return python();
    case "css":
      return css();
    case "html":
      return html();
    case "json":
      return json();
    default:
      return [];
  }
}

interface CodeEditorProps {
  content: string;
  language: string;
}

export function CodeEditor({ content, language }: CodeEditorProps) {
  const extensions = useMemo(
    () => [
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      getLanguageExtension(language),
    ],
    [language]
  );

  return (
    <div className="h-full overflow-auto">
      <CodeMirror
        value={content}
        height="100%"
        theme={vscodeDark}
        basicSetup
        editable={false}
        extensions={extensions}
      />
    </div>
  );
}
