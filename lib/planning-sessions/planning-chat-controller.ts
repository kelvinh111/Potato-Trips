"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  requestPlanningSessionClarificationReply,
  requestPlanningSessionClarificationStart,
  type PlanningSessionClarificationApiSession,
} from "@/lib/planning-sessions/client-api";
import type {
  PlanningSessionClarificationMessages,
  PlanningSessionStatusValue,
} from "@/lib/planning-sessions/types";

export interface PlanningChatMessageViewModel {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface PlanningChatController {
  conversationMessages: PlanningChatMessageViewModel[];
  draftMessage: string;
  errorMessage: string | null;
  isStarting: boolean;
  isSubmittingReply: boolean;
  isComposerDisabled: boolean;
  sendButtonDisabled: boolean;
  shouldShowStartRetry: boolean;
  setDraftMessage: (value: string) => void;
  startClarification: () => Promise<void>;
  sendReply: () => Promise<void>;
}

interface PlanningChatControllerInput {
  sessionId: string;
  initialPrompt: string;
  status: PlanningSessionStatusValue;
  clarificationMessages: PlanningSessionClarificationMessages;
  onSessionUpdate: (payload: PlanningSessionClarificationApiSession) => void;
}

interface PlanningChatControllerDependencies {
  requestStart: (
    sessionId: string,
  ) => Promise<PlanningSessionClarificationApiSession>;
  requestReply: (
    sessionId: string,
    message: string,
  ) => Promise<PlanningSessionClarificationApiSession>;
  scheduleAutoStart: (callback: () => void) => void;
}

export interface PlanningChatSubmitLock {
  acquire: () => boolean;
  release: () => void;
  isLocked: () => boolean;
}

export interface PlanningChatStartLock {
  acquire: () => boolean;
  release: () => void;
  isLocked: () => boolean;
}

export interface PlanningChatAutoStartState {
  didAutoStart: boolean;
}

export interface PerformPlanningChatStartInput {
  sessionId: string;
  startLock: PlanningChatStartLock;
  requestStart: (
    sessionId: string,
  ) => Promise<PlanningSessionClarificationApiSession>;
  onStart: () => void;
  onSuccess: (payload: PlanningSessionClarificationApiSession) => void;
  onError: (message: string) => void;
  onFinish: () => void;
}

export interface RunPlanningChatAutoStartInput {
  autoStartState: PlanningChatAutoStartState;
  status: PlanningSessionStatusValue;
  hasAssistantMessage: boolean;
  scheduleAutoStart: (callback: () => void) => void;
  onAutoStart: () => void;
}

export interface PerformPlanningChatReplyInput {
  sessionId: string;
  draftMessage: string;
  isComposerDisabled: boolean;
  submitLock: PlanningChatSubmitLock;
  requestReply: (
    sessionId: string,
    message: string,
  ) => Promise<PlanningSessionClarificationApiSession>;
  onStart: () => void;
  onSuccess: (payload: PlanningSessionClarificationApiSession) => void;
  onError: (message: string) => void;
  onFinish: () => void;
}

function createDefaultPlanningChatDependencies(): PlanningChatControllerDependencies {
  return {
    requestStart: requestPlanningSessionClarificationStart,
    requestReply: requestPlanningSessionClarificationReply,
    scheduleAutoStart: (callback) => {
      window.setTimeout(callback, 0);
    },
  };
}

export function createPlanningChatSubmitLock(): PlanningChatSubmitLock {
  let locked = false;

  return {
    acquire() {
      if (locked) {
        return false;
      }

      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
    isLocked() {
      return locked;
    },
  };
}

export function createPlanningChatStartLock(): PlanningChatStartLock {
  let locked = false;

  return {
    acquire() {
      if (locked) {
        return false;
      }

      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
    isLocked() {
      return locked;
    },
  };
}

export function buildPlanningChatMessageViewModels(
  initialPrompt: string,
  clarificationMessages: PlanningSessionClarificationMessages,
): PlanningChatMessageViewModel[] {
  const persistedMessages = clarificationMessages.map((message, index) => ({
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
    ...persistedMessages,
  ];
}

export function shouldAutoStartPlanningChat(input: {
  didAutoStart: boolean;
  status: PlanningSessionStatusValue;
  hasAssistantMessage: boolean;
}): boolean {
  return (
    !input.didAutoStart &&
    input.status === "CLARIFYING" &&
    !input.hasAssistantMessage
  );
}

export function isPlanningChatComposerDisabled(input: {
  status: PlanningSessionStatusValue;
  isStarting: boolean;
  isSubmittingReply: boolean;
}): boolean {
  return (
    input.status === "GENERATING" ||
    input.status === "GENERATED" ||
    input.status === "FAILED" ||
    input.isStarting ||
    input.isSubmittingReply
  );
}

export function shouldShowPlanningChatStartRetry(input: {
  status: PlanningSessionStatusValue;
  hasAssistantMessage: boolean;
  isStarting: boolean;
}): boolean {
  return (
    input.status === "CLARIFYING" &&
    !input.hasAssistantMessage &&
    !input.isStarting
  );
}

export function runPlanningChatAutoStart(
  input: RunPlanningChatAutoStartInput,
): boolean {
  if (
    !shouldAutoStartPlanningChat({
      didAutoStart: input.autoStartState.didAutoStart,
      status: input.status,
      hasAssistantMessage: input.hasAssistantMessage,
    })
  ) {
    return false;
  }

  input.autoStartState.didAutoStart = true;
  input.scheduleAutoStart(() => {
    input.onAutoStart();
  });

  return true;
}

export async function performPlanningChatStart(
  input: PerformPlanningChatStartInput,
): Promise<boolean> {
  if (!input.startLock.acquire()) {
    return false;
  }

  input.onStart();

  try {
    const payload = await input.requestStart(input.sessionId);
    input.onSuccess(payload);
    return true;
  } catch (error) {
    input.onError(
      error instanceof Error
        ? error.message
        : "Unable to start clarification. Please try again.",
    );
    return false;
  } finally {
    input.startLock.release();
    input.onFinish();
  }
}

export async function performPlanningChatReply(
  input: PerformPlanningChatReplyInput,
): Promise<boolean> {
  const trimmed = input.draftMessage.trim();

  if (!trimmed || input.isComposerDisabled || !input.submitLock.acquire()) {
    return false;
  }

  input.onStart();

  try {
    const payload = await input.requestReply(input.sessionId, trimmed);
    input.onSuccess(payload);
    return true;
  } catch (error) {
    input.onError(
      error instanceof Error
        ? error.message
        : "Unable to send message. Please try again.",
    );
    return false;
  } finally {
    input.submitLock.release();
    input.onFinish();
  }
}

export function usePlanningChatController(
  input: PlanningChatControllerInput,
  dependenciesOverride?: Partial<PlanningChatControllerDependencies>,
): PlanningChatController {
  const dependencies = useMemo(
    () => ({
      ...createDefaultPlanningChatDependencies(),
      ...dependenciesOverride,
    }),
    [dependenciesOverride],
  );

  const [draftMessage, setDraftMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const autoStartStateRef = useRef<PlanningChatAutoStartState>({
    didAutoStart: false,
  });
  const startLockRef = useRef<PlanningChatStartLock>(createPlanningChatStartLock());
  const submitLockRef = useRef<PlanningChatSubmitLock>(createPlanningChatSubmitLock());

  const hasAssistantMessage = useMemo(
    () =>
      input.clarificationMessages.some((message) => message.role === "assistant"),
    [input.clarificationMessages],
  );

  const conversationMessages = useMemo(
    () =>
      buildPlanningChatMessageViewModels(
        input.initialPrompt,
        input.clarificationMessages,
      ),
    [input.clarificationMessages, input.initialPrompt],
  );

  const startClarification = useCallback(async () => {
    await performPlanningChatStart({
      sessionId: input.sessionId,
      startLock: startLockRef.current,
      requestStart: dependencies.requestStart,
      onStart: () => {
        setErrorMessage(null);
        setIsStarting(true);
      },
      onSuccess: (payload) => {
        input.onSessionUpdate(payload);
      },
      onError: (message) => {
        setErrorMessage(message);
      },
      onFinish: () => {
        setIsStarting(false);
      },
    });
  }, [dependencies, input]);

  useEffect(() => {
    runPlanningChatAutoStart({
      autoStartState: autoStartStateRef.current,
      status: input.status,
      hasAssistantMessage,
      scheduleAutoStart: dependencies.scheduleAutoStart,
      onAutoStart: () => {
        void startClarification();
      },
    });
  }, [dependencies, hasAssistantMessage, input.status, startClarification]);

  const isComposerDisabled = isPlanningChatComposerDisabled({
    status: input.status,
    isStarting,
    isSubmittingReply,
  });

  const sendReply = useCallback(async () => {
    await performPlanningChatReply({
      sessionId: input.sessionId,
      draftMessage,
      isComposerDisabled,
      submitLock: submitLockRef.current,
      requestReply: dependencies.requestReply,
      onStart: () => {
        setErrorMessage(null);
        setIsSubmittingReply(true);
      },
      onSuccess: (payload) => {
        setDraftMessage("");
        input.onSessionUpdate(payload);
      },
      onError: (message) => {
        setErrorMessage(message);
      },
      onFinish: () => {
        setIsSubmittingReply(false);
      },
    });
  }, [dependencies.requestReply, draftMessage, input, isComposerDisabled]);

  return {
    conversationMessages,
    draftMessage,
    errorMessage,
    isStarting,
    isSubmittingReply,
    isComposerDisabled,
    sendButtonDisabled: isComposerDisabled || draftMessage.trim().length === 0,
    shouldShowStartRetry: shouldShowPlanningChatStartRetry({
      status: input.status,
      hasAssistantMessage,
      isStarting,
    }),
    setDraftMessage,
    startClarification,
    sendReply,
  };
}
