"use client";

import { Allotment } from "allotment";
import { useWorkspace } from "../hooks/use-workspace";
import { TaskPanel } from "./tasks/task-panel";
import { EditorPanel } from "./editor/editor-panel";

const TASK_PANE_SIZE = 300;
const CHAT_PANE_SIZE = 1000;
const EDITOR_PANE_SIZE = 600;

export function WorkspacePanels({ children }: { children: React.ReactNode }) {
  const { plan, editorVisible } = useWorkspace();
  const hasPlan = Boolean(plan && plan.length > 0);

  return (
    <div className="flex-1 flex overflow-hidden">
      <Allotment className="flex-1">
        {hasPlan && (
          <Allotment.Pane snap preferredSize={TASK_PANE_SIZE}>
            <TaskPanel />
          </Allotment.Pane>
        )}

        <Allotment.Pane snap minSize={400} preferredSize={CHAT_PANE_SIZE}>
          {children}
        </Allotment.Pane>

        {editorVisible && (
          <Allotment.Pane snap minSize={400} preferredSize={EDITOR_PANE_SIZE}>
            <EditorPanel />
          </Allotment.Pane>
        )}
      </Allotment>
    </div>
  );
}
