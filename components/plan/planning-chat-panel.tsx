"use client";

import {
  useEffect,
  useRef,
  type KeyboardEventHandler,
} from "react";
import { ArrowUp, Loader2 } from "lucide-react";

import { AssistantMarkdown } from "@/components/plan/assistant-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  usePlanningChatController,
} from "@/lib/planning-sessions/planning-chat-controller";
import type { PlanningSessionClarificationApiSession } from "@/lib/planning-sessions/client-api";
import type { PlanningSessionClarificationMessages, PlanningSessionStatusValue } from "@/lib/planning-sessions/types";

interface PlanningChatPanelProps {
  sessionId: string;
  initialPrompt: string;
  status: PlanningSessionStatusValue;
  clarificationMessages: PlanningSessionClarificationMessages;
  onSessionUpdate: (payload: PlanningSessionClarificationApiSession) => void;
}

export function PlanningChatPanel({
  sessionId,
  initialPrompt,
  status,
  clarificationMessages,
  onSessionUpdate,
}: PlanningChatPanelProps) {
  const chatController = usePlanningChatController({
    sessionId,
    initialPrompt,
    status,
    clarificationMessages,
    onSessionUpdate,
  });

  const isImeComposingRef = useRef(false);
  const conversationBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    conversationBottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [
    chatController.conversationMessages.length,
    chatController.isStarting,
    chatController.isSubmittingReply,
  ]);

  const handleComposerKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (
    event,
  ) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    const nativeEvent = event.nativeEvent as KeyboardEvent;
    const isComposingIme =
      nativeEvent.isComposing || nativeEvent.keyCode === 229;

    if (isImeComposingRef.current) {
      if (!isComposingIme) {
        // Treat this Enter as candidate-confirm/stale cleanup and require another Enter to submit.
        isImeComposingRef.current = false;
      }

      return;
    }

    if (isComposingIme) {
      return;
    }

    event.preventDefault();
    void chatController.sendReply();
  };

  return (
    <section
      aria-label="Planning chat panel"
      className="flex min-h-0 flex-col overflow-hidden rounded-3xl bg-bg-surface"
    >
      <h2 className="sr-only">Planning Chat</h2>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-atomic="false"
          className="space-y-3"
        >
          {chatController.conversationMessages.map((message) => {
            const isUser = message.role === "user";

            return (
              <article
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[85%] ${
                    isUser
                      ? "bg-accent-primary text-white"
                      : "border border-border-subtle bg-bg-subtle text-text-primary"
                  }`}
                >
                  <span className="sr-only">
                    {isUser ? "You: " : "Assistant: "}
                  </span>
                  {isUser ? (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  ) : (
                    <AssistantMarkdown
                      content={message.content}
                      className="break-words"
                    />
                  )}
                </div>
              </article>
            );
          })}
          <div ref={conversationBottomRef} />
        </div>
      </div>

      <div className="border-t border-border-subtle/70 px-4 py-4 sm:px-5">
        {chatController.errorMessage ? (
          <div
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="mb-3 rounded-2xl border border-state-error/30 bg-state-error/10 px-3 py-2 text-sm text-state-error"
          >
            <p>{chatController.errorMessage}</p>
            {chatController.shouldShowStartRetry ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void chatController.startClarification();
                }}
                className="mt-2 h-8 rounded-xl px-2 text-state-error hover:bg-state-error/20"
              >
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}

        <label htmlFor="planning-chat-message" className="sr-only">
          Message composer
        </label>
        <div className="flex items-end gap-2">
          <Textarea
            id="planning-chat-message"
            name="planning-chat-message"
            rows={2}
            value={chatController.draftMessage}
            disabled={chatController.isComposerDisabled}
            onChange={(event) => {
              chatController.setDraftMessage(event.target.value);
            }}
            onCompositionStart={() => {
              isImeComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isImeComposingRef.current = false;
            }}
            onBlur={() => {
              isImeComposingRef.current = false;
            }}
            onKeyDown={handleComposerKeyDown}
            placeholder={
              status === "READY_TO_GENERATE"
                ? "Reply to confirm generation or adjust trip details"
                : status === "GENERATING"
                  ? "Generation in progress"
                  : status === "FAILED"
                    ? "Generation failed. Retry from Trip Plan Status"
                  : "Share trip details"
            }
            className="resize-none rounded-2xl border-border-default bg-bg-surface text-text-primary placeholder:text-text-faint"
          />
          <Button
            type="button"
            size="icon-sm"
            disabled={chatController.sendButtonDisabled}
            onClick={() => {
              void chatController.sendReply();
            }}
            aria-label="Send message"
            className="rounded-full"
          >
            {chatController.isStarting || chatController.isSubmittingReply ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
