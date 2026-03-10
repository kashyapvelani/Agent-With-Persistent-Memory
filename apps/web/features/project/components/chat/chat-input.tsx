"use client";

import { ListChecks } from "lucide-react";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@workspace/ui/components/ai-elements/prompt-input";
import { useWorkspace } from "../../hooks/use-workspace";

export function ChatInput() {
  const { submit, stop, isStreaming, interrupt, mode, setMode } = useWorkspace();
  const hasInterrupt = Boolean(interrupt);
  const status = isStreaming ? ("streaming" as const) : undefined;

  const handleSubmit = (message: PromptInputMessage) => {
    const text = message.text.trim();
    if (!text) return;
    submit(text);
  };

  return (
    <PromptInput onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl">
      <PromptInputTextarea
        placeholder={
          hasInterrupt
            ? "Resolve the pending interrupt to continue..."
            : mode === "plan"
              ? "Describe what you want — agent will create a plan for approval..."
              : "Describe what you want to build..."
        }
        disabled={hasInterrupt}
      />
      <PromptInputFooter>
        <PromptInputTools>
          <PromptInputButton
            onClick={() => setMode(mode === "plan" ? "auto" : "plan")}
            tooltip="Toggle plan mode"
            variant={mode === "plan" ? "secondary" : "ghost"}
            disabled={hasInterrupt}
          >
            <ListChecks className="size-3.5" />
            Plan
          </PromptInputButton>
        </PromptInputTools>
        <PromptInputSubmit
          status={status}
          onStop={stop}
          disabled={hasInterrupt}
        />
      </PromptInputFooter>
    </PromptInput>
  );
}
