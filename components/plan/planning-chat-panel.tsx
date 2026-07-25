"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEventHandler,
} from "react";
import { ArrowUp, Loader2 } from "lucide-react";

import { AssistantMarkdown } from "@/components/plan/assistant-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  PlanningSessionClarificationMessages,
  PlanningSessionStatusValue,
} from "@/lib/planning-sessions/types";

interface PlanningChatPanelProps {
  sessionId: string;
  initialPrompt: string;
  status: PlanningSessionStatusValue;
  clarificationMessages: PlanningSessionClarificationMessages;
  onSessionUpdate: (payload: unknown) => void;
}

type ClarifyRequestBody = { action: "start" } | { action: "reply"; message: string };

interface ChatMessageViewModel {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readApiErrorMessage(payload: unknown): string {
  if (!isObjectRecord(payload) || !isObjectRecord(payload.error)) {
    return "Unable to complete that request. Please try again.";
  }

  const maybeMessage = payload.error.message;
  if (typeof maybeMessage === "string" && maybeMessage.trim().length > 0) {
    return maybeMessage;
  }

  return "Unable to complete that request. Please try again.";
}

async function postClarificationRequest(
  sessionId: string,
  body: ClarifyRequestBody,
): Promise<unknown> {
  const response = await fetch(`/api/planning-sessions/${sessionId}/clarify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(readApiErrorMessage(payload));
  }

  return payload;
}

export function PlanningChatPanel({
  sessionId,
  initialPrompt,
  status,
  clarificationMessages,
  onSessionUpdate,
}: PlanningChatPanelProps) {
  const [draftMessage, setDraftMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const didAutoStartRef = useRef(false);
  const isImeComposingRef = useRef(false);
  const conversationBottomRef = useRef<HTMLDivElement | null>(null);

  const conversationMessages = useMemo<ChatMessageViewModel[]>(() => {
    const persisted = clarificationMessages.map((message, index) => ({
      id: `persisted-${index}`,
      role: message.role,
      content: message.content,
    }));

    return [
      {
        id: "initial-prompt",
        role: "user",
        content: initialPrompt,
      },
      ...persisted,
    ];
  }, [clarificationMessages, initialPrompt]);

  useEffect(() => {
    conversationBottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [conversationMessages.length, isStarting, isSubmittingReply]);

  const startClarification = useCallback(async () => {
    setErrorMessage(null);
    setIsStarting(true);

    try {
      const payload = await postClarificationRequest(sessionId, {
        action: "start",
      });
      onSessionUpdate(payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start clarification. Please try again.",
      );
    } finally {
      setIsStarting(false);
    }
  }, [onSessionUpdate, sessionId]);

  const hasAssistantMessage = clarificationMessages.some(
    (message) => message.role === "assistant",
  );

  useEffect(() => {
    if (didAutoStartRef.current) {
      return;
    }

    if (status !== "CLARIFYING") {
      return;
    }

    if (hasAssistantMessage) {
      return;
    }

    didAutoStartRef.current = true;
    window.setTimeout(() => {
      void startClarification();
    }, 0);
  }, [hasAssistantMessage, startClarification, status]);

  const isComposerDisabled =
    status === "GENERATING" || status === "GENERATED" || isStarting || isSubmittingReply;

  const sendReply = useCallback(async () => {
    const trimmed = draftMessage.trim();

    if (!trimmed || isComposerDisabled) {
      return;
    }

    setErrorMessage(null);
    setIsSubmittingReply(true);

    try {
      const payload = await postClarificationRequest(sessionId, {
        action: "reply",
        message: trimmed,
      });

      setDraftMessage("");
      onSessionUpdate(payload);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to send message. Please try again.",
      );
    } finally {
      setIsSubmittingReply(false);
    }
  }, [draftMessage, isComposerDisabled, onSessionUpdate, sessionId]);

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
    void sendReply();
  };

  const shouldShowStartRetry =
    status === "CLARIFYING" && !hasAssistantMessage && !isStarting;

  const sendButtonDisabled =
    isComposerDisabled || draftMessage.trim().length === 0;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-border-default bg-bg-surface shadow-sm">
      <header className="border-b border-border-subtle px-4 py-4 sm:px-5">
        <h2 className="text-base font-semibold text-text-primary">Planning Chat</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
          aria-atomic="false"
          className="space-y-3"
        >
          {conversationMessages.map((message) => {
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

      <div className="border-t border-border-subtle px-4 py-4 sm:px-5">
        {errorMessage ? (
          <div
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="mb-3 rounded-2xl border border-state-error/30 bg-state-error/10 px-3 py-2 text-sm text-state-error"
          >
            <p>{errorMessage}</p>
            {shouldShowStartRetry ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  void startClarification();
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
            value={draftMessage}
            disabled={isComposerDisabled}
            onChange={(event) => {
              setDraftMessage(event.target.value);
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
                  : "Share trip details"
            }
            className="resize-none rounded-2xl border-border-default bg-bg-surface text-text-primary placeholder:text-text-faint"
          />
          <Button
            type="button"
            size="icon-sm"
            disabled={sendButtonDisabled}
            onClick={() => {
              void sendReply();
            }}
            aria-label="Send message"
            className="rounded-full"
          >
            {isStarting || isSubmittingReply ? (
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
