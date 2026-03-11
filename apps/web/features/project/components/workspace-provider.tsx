"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useStream } from "@langchain/langgraph-sdk/react";
import type {
  PlanStep,
  FileDiff,
  AgentStateV2,
  AgentMode,
} from "@workspace/types";

// ---------------------------------------------------------------------------
// Editor Tab types
// ---------------------------------------------------------------------------
export interface EditorTab {
  id: string;
  filename: string;
  content: string;
  patch?: string;
  mode: "code" | "diff";
  language: string;
}

// ---------------------------------------------------------------------------
// Context value type
// ---------------------------------------------------------------------------
type StreamReturn = ReturnType<typeof useStream<AgentStateV2>>;

export interface CommitResult {
  prUrl: string;
  prNumber: number;
  branch: string;
}

export interface WorkspaceContextValue {
  // Stream
  stream: StreamReturn;
  messages: StreamReturn["messages"];
  plan: PlanStep[] | null;
  generatedDiffs: FileDiff[];
  isStreaming: boolean;
  interrupt: StreamReturn["interrupt"];
  sandboxId: string | null;

  // Mode
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;

  // Actions
  submit: (message: string) => void | Promise<void>;
  resumeInterrupt: (payload: unknown) => Promise<void>;
  stop: () => void;

  // Commit & PR
  commitAndPR: (commitMessage?: string) => Promise<CommitResult>;
  isCommitting: boolean;
  lastCommitResult: CommitResult | null;
  sandboxAlive: boolean;
  sandboxChecking: boolean;

  // Editor state
  editorVisible: boolean;
  setEditorVisible: (visible: boolean) => void;
  openTabs: EditorTab[];
  activeTabId: string | null;
  openFile: (filename: string, content?: string) => void;
  openDiff: (filename: string, patch: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;

  // Session
  projectId: string;
  threadId: string | null;
  activeSessionId: string | null;
  sessionsVersion: number;
  isLoading: boolean;
  createNewSession: () => void;
  switchSession: (sessionId: string, langgraphThreadId: string) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(
  null,
);

// ---------------------------------------------------------------------------
// Utility: derive language from file extension
// ---------------------------------------------------------------------------
function languageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    css: "css",
    html: "html",
    json: "json",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    rs: "rust",
    go: "go",
    java: "java",
    rb: "ruby",
    sh: "shell",
    bash: "shell",
  };
  return map[ext] ?? "text";
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function WorkspaceProvider({
  projectId,
  threadId: urlThreadId,
  children,
}: {
  projectId: string;
  threadId: string; // "new" or a session ID
  children: ReactNode;
}) {
  const router = useRouter();
  const isNewThread = urlThreadId === "new";

  // -- Session / thread management ------------------------------------------
  const [langgraphThreadId, setLanggraphThreadId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string>("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionsVersion, setSessionsVersion] = useState(0);

  // Track the first message so we can generate a title after session creation
  const firstMessageRef = useRef<string | null>(null);

  // On mount: fetch orgId. If URL has a session ID (not "new"), load that session.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Fetch project to get orgId
        const projectsRes = await fetch("/api/projects");
        if (projectsRes.ok) {
          const projects = await projectsRes.json();
          const project = projects.find((p: { id: string }) => p.id === projectId);
          if (project && !cancelled) {
            setOrgId(project.orgId);
          }
        }

        if (!isNewThread) {
          // URL has a session ID — look up its langgraph thread
          const res = await fetch(
            `/api/sessions?projectId=${encodeURIComponent(projectId)}`,
          );
          if (!res.ok) throw new Error("Failed to fetch sessions");

          const sessions = await res.json();
          const session = sessions.find(
            (s: { id: string }) => s.id === urlThreadId,
          );
          if (!cancelled && session?.langgraphThreadId) {
            setLanggraphThreadId(session.langgraphThreadId);
            setActiveSessionId(session.id);
          } else if (!cancelled) {
            // Session not found — redirect to new
            router.replace(`/dashboard/project/${projectId}/thread/new`);
          }
        }
      } catch (err) {
        console.error("Session init error:", err);
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [projectId, urlThreadId, isNewThread, router]);

  // -- Mode state -----------------------------------------------------------
  const [mode, setMode] = useState<AgentMode>("auto");

  // -- useStream hook -------------------------------------------------------
  // When threadId is null/undefined (new thread), useStream auto-creates one
  // on first submit and calls onThreadId with the new ID.
  // IMPORTANT: onThreadId must be a stable, sync callback (per docs pattern).
  const apiUrl = process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ?? "";
  const stream = useStream<AgentStateV2>({
    apiUrl,
    assistantId: "nexgenesis-agent",
    threadId: langgraphThreadId ?? undefined,
    onThreadId: setLanggraphThreadId,
    streamMode: ["values", "messages"],
    reconnectOnMount: true,
    onError: (error) => {
      // Silence abort errors — these are expected when stopping a stream,
      // unmounting, or submitting a new message while streaming.
      if (
        error.name === "AbortError" ||
        error.message === "Abort" ||
        error.message === "The operation was aborted" ||
        error.message === "signal is aborted without reason"
      ) {
        return;
      }
      console.error("Stream error:", error);
    },
  });

  // -- Side-effect: when useStream creates a new thread, save the session --
  // Runs once when langgraphThreadId transitions from null → a real ID (new thread).
  const sessionSavedForThreadRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !langgraphThreadId ||
      activeSessionId ||
      sessionSavedForThreadRef.current === langgraphThreadId
    ) {
      return; // already saved, or no thread yet, or already have a session
    }
    sessionSavedForThreadRef.current = langgraphThreadId;

    async function saveSession() {
      try {
        const createRes = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, langgraphThreadId }),
        });
        if (!createRes.ok) throw new Error("Failed to create session");

        const { session } = await createRes.json();
        setActiveSessionId(session.id);
        setSessionsVersion((v) => v + 1);

        // Update URL without triggering Next.js remount
        window.history.replaceState(
          null,
          "",
          `/dashboard/project/${projectId}/thread/${session.id}`,
        );

        // Generate title (fire-and-forget)
        if (firstMessageRef.current) {
          const message = firstMessageRef.current;
          firstMessageRef.current = null;
          fetch("/api/sessions/title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: session.id,
              firstMessage: message,
            }),
          })
            .then(() => setSessionsVersion((v) => v + 1))
            .catch((err) =>
              console.error("Failed to generate session title:", err),
            );
        }
      } catch (err) {
        console.error("Failed to save session:", err);
      }
    }

    saveSession();
  }, [langgraphThreadId, activeSessionId, projectId]);

  const values = stream.values as unknown as AgentStateV2 | undefined;
  const plan = values?.plan ?? null;
  const generatedDiffs = values?.generatedDiffs ?? [];
  const sandboxId = values?.sandboxId ?? null;
  const isStreaming = stream.isLoading;

  // Sync mode from agent state
  useEffect(() => {
    if (values?.mode && values.mode !== mode) {
      setMode(values.mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values?.mode]);

  // -- Submit ---------------------------------------------------------------
  const submit = useCallback(
    async (message: string) => {
      // Stop any active stream before submitting a new message
      if (stream.isLoading) {
        stream.stop();
      }

      // Store first message for title generation (used in onThreadId callback)
      if (!langgraphThreadId) {
        firstMessageRef.current = message;
      }

      // useStream handles thread creation internally — just submit.
      // If no threadId exists yet, it creates one and calls onThreadId.
      stream.submit(
        {
          messages: [{ type: "human", content: message }],
          projectId,
          orgId,
          mode,
        } as Partial<AgentStateV2>,
      );
    },
    [stream, projectId, orgId, mode, langgraphThreadId],
  );

  const resumeInterrupt = useCallback(
    async (payload: unknown) => {
      await stream.submit(null, {
        command: { resume: payload },
      });
    },
    [stream],
  );

  const stop = useCallback(() => {
    stream.stop();
  }, [stream]);

  // -- Sandbox health check + keep-alive ------------------------------------
  const [sandboxAlive, setSandboxAlive] = useState(false);
  const [sandboxChecking, setSandboxChecking] = useState(false);

  // Pings /api/sandbox/status which both checks health AND extends the
  // sandbox timeout by 15 minutes (keep-alive).
  const pingSandbox = useCallback(
    (id: string) =>
      fetch(`/api/sandbox/status?sandboxId=${encodeURIComponent(id)}`)
        .then((res) => res.json())
        .then((data: { alive: boolean }) => {
          setSandboxAlive(data.alive);
          return data.alive;
        })
        .catch(() => {
          setSandboxAlive(false);
          return false;
        }),
    [],
  );

  // Initial check when sandboxId appears or streaming stops
  useEffect(() => {
    if (!sandboxId) {
      setSandboxAlive(false);
      return;
    }

    // While streaming, assume sandbox is alive (agent is actively using it)
    if (isStreaming) {
      setSandboxAlive(true);
      return;
    }

    // Streaming just stopped — check + extend timeout immediately
    let cancelled = false;
    setSandboxChecking(true);
    pingSandbox(sandboxId).finally(() => {
      if (!cancelled) setSandboxChecking(false);
    });
    return () => { cancelled = true; };
  }, [sandboxId, isStreaming, pingSandbox]);

  // Periodic keep-alive: ping every 5 min while sandbox is alive and user
  // is on this page. Each ping extends the E2B timeout by 15 min, so the
  // sandbox stays alive as long as the tab is open.
  useEffect(() => {
    if (!sandboxId || !sandboxAlive || isStreaming) return;

    const KEEP_ALIVE_INTERVAL = 5 * 60 * 1000; // 5 minutes
    const interval = setInterval(() => {
      pingSandbox(sandboxId);
    }, KEEP_ALIVE_INTERVAL);

    return () => clearInterval(interval);
  }, [sandboxId, sandboxAlive, isStreaming, pingSandbox]);

  // -- Commit & PR ----------------------------------------------------------
  const [isCommitting, setIsCommitting] = useState(false);
  const [lastCommitResult, setLastCommitResult] = useState<CommitResult | null>(null);

  const commitAndPR = useCallback(
    async (commitMessage?: string): Promise<CommitResult> => {
      if (!sandboxId) throw new Error("No active sandbox");
      setIsCommitting(true);
      try {
        const res = await fetch("/api/sandbox/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sandboxId, projectId, commitMessage }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Commit failed" }));
          // If sandbox expired, update the alive state
          if (res.status === 410) setSandboxAlive(false);
          throw new Error(err.error || "Commit failed");
        }
        const result: CommitResult = await res.json();
        setLastCommitResult(result);
        return result;
      } finally {
        setIsCommitting(false);
      }
    },
    [sandboxId, projectId],
  );

  // -- Editor tab state -----------------------------------------------------
  const [editorVisible, setEditorVisible] = useState(false);
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTab] = useState<string | null>(null);
  const tabIdCounter = useRef(0);

  const openFile = useCallback(
    (filename: string, content = "") => {
      setEditorVisible(true);
      setOpenTabs((prev) => {
        const existing = prev.find(
          (t) => t.filename === filename && t.mode === "code",
        );
        if (existing) {
          setActiveTab(existing.id);
          return prev;
        }
        const id = `file-${++tabIdCounter.current}`;
        setActiveTab(id);

        // If no content provided, fetch from sandbox asynchronously
        if (!content && sandboxId) {
          const sandboxPath = filename.startsWith("/")
            ? filename
            : `/workspace/${filename}`;
          fetch(
            `/api/sandbox/read-file?sandboxId=${encodeURIComponent(sandboxId)}&path=${encodeURIComponent(sandboxPath)}`,
          )
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.content) {
                setOpenTabs((tabs) =>
                  tabs.map((t) =>
                    t.id === id ? { ...t, content: data.content } : t,
                  ),
                );
              }
            })
            .catch(() => {
              // Silently fail — tab stays with empty content
            });
        }

        return [
          ...prev,
          {
            id,
            filename,
            content,
            mode: "code" as const,
            language: languageFromFilename(filename),
          },
        ];
      });
    },
    [sandboxId],
  );

  const openDiff = useCallback(
    (filename: string, patch: string) => {
      setEditorVisible(true);
      setOpenTabs((prev) => {
        const existing = prev.find(
          (t) => t.filename === filename && t.mode === "diff",
        );
        if (existing) {
          setActiveTab(existing.id);
          return prev;
        }
        const id = `diff-${++tabIdCounter.current}`;
        setActiveTab(id);
        return [
          ...prev,
          {
            id,
            filename,
            content: "",
            patch,
            mode: "diff" as const,
            language: languageFromFilename(filename),
          },
        ];
      });
    },
    [],
  );

  const closeTab = useCallback(
    (id: string) => {
      setOpenTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        setActiveTab((currentActive) => {
          if (currentActive === id) {
            return next[Math.min(idx, next.length - 1)]?.id ?? null;
          }
          return currentActive;
        });
        if (next.length === 0) {
          setEditorVisible(false);
        }
        return next;
      });
    },
    [],
  );

  // -- Auto-open diffs when generatedDiffs arrives --------------------------
  const hasAutoOpenedDiffs = useRef(false);
  useEffect(() => {
    if (generatedDiffs.length > 0 && !hasAutoOpenedDiffs.current) {
      hasAutoOpenedDiffs.current = true;
      setEditorVisible(true);
      generatedDiffs.forEach((diff) => openDiff(diff.file, diff.patch));
    }
    if (generatedDiffs.length === 0) {
      hasAutoOpenedDiffs.current = false;
    }
  }, [generatedDiffs, openDiff]);

  // -- Session switching (URL-based) ----------------------------------------
  const createNewSession = useCallback(() => {
    router.push(`/dashboard/project/${projectId}/thread/new`);
  }, [projectId, router]);

  const switchSession = useCallback(
    (sessionId: string, _langgraphThreadId: string) => {
      if (sessionId === activeSessionId) return;
      router.push(`/dashboard/project/${projectId}/thread/${sessionId}`);
    },
    [activeSessionId, projectId, router],
  );

  // -- Context value --------------------------------------------------------
  const value = useMemo<WorkspaceContextValue>(
    () => ({
      stream,
      messages: stream.messages,
      plan,
      generatedDiffs,
      isStreaming,
      interrupt: stream.interrupt,
      sandboxId,
      mode,
      setMode,
      submit,
      resumeInterrupt,
      stop,
      commitAndPR,
      isCommitting,
      lastCommitResult,
      sandboxAlive,
      sandboxChecking,
      editorVisible,
      setEditorVisible,
      openTabs,
      activeTabId,
      openFile,
      openDiff,
      closeTab,
      setActiveTab,
      projectId,
      threadId: langgraphThreadId,
      activeSessionId,
      sessionsVersion,
      isLoading: sessionLoading,
      createNewSession,
      switchSession,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      stream,
      mode,
      submit,
      resumeInterrupt,
      stop,
      commitAndPR,
      isCommitting,
      lastCommitResult,
      sandboxAlive,
      sandboxChecking,
      editorVisible,
      openTabs,
      activeTabId,
      openFile,
      openDiff,
      closeTab,
      projectId,
      langgraphThreadId,
      activeSessionId,
      sessionsVersion,
      sessionLoading,
      createNewSession,
      switchSession,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
