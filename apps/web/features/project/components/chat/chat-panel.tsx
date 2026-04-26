"use client";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@workspace/ui/components/ai-elements/conversation";
import { MessageSquare } from "lucide-react";
import { useWorkspace } from "../../hooks/use-workspace";
import { ChatMessageList } from "./chat-message-list";
import { ChatInput } from "./chat-input";
import { Spinner } from "@workspace/ui/components/spinner";
import Image from "next/image";

export function ChatPanel() {
  const { stream, isLoading } = useWorkspace();
  const messages = stream.messages;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <Conversation className="flex-1 min-h-0">
        <ConversationContent className="px-4 py-6">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<Image src="/logo.svg" alt="Logo" width={25} height={25} className="opacity-40" />}
              title="Start a conversation"
              description="Ask me about your codebase or request changes."
            />
          ) : (
            <ChatMessageList />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-4">
        <ChatInput />
      </div>
    </div>
  );
}
