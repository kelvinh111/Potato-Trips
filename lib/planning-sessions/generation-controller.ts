"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  requestPlanningSessionGenerationStart,
  requestPlanningSessionGenerationState,
  type PlanningSessionClarificationApiSession,
  type PlanningSessionGenerationApiSession,
} from "@/lib/planning-sessions/client-api";
import type {
  PersistedItinerary,
  PlanningBrief,
  PlanningSessionClarificationMessages,
  PlanningSessionGenerationPhaseValue,
  PlanningSessionStatusValue,
} from "@/lib/planning-sessions/types";

export const GENERATION_POLL_BASE_INTERVAL_MS = 2500;
export const GENERATION_POLL_MAX_BACKOFF_MS = 30000;
export const GENERATION_POLL_FAILURE_PAUSE_THRESHOLD = 6;
export const GENERATION_POLL_PAUSED_NOTICE =
  "Unable to refresh generation status right now. Auto-refresh is paused. Please check status again.";

export interface PlanningSessionGenerationControllerSessionState {
  status: PlanningSessionStatusValue;
  clarificationMessages: PlanningSessionClarificationMessages;
  planningBrief: PlanningBrief | null;
  generationPhase: PlanningSessionGenerationPhaseValue | null;
  generatedItinerary: PersistedItinerary | null;
  generationAttempts: number;
  generationError: string | null;
}

export interface GenerationPollingPolicyState {
  consecutivePollFailures: number;
  generatingPollCycle: number;
  isPollingPaused: boolean;
  generationPollingNotice: string | null;
}

export interface PlanningSessionGenerationController {
  sessionState: PlanningSessionGenerationControllerSessionState;
  generationError: string | null;
  generationPollingNotice: string | null;
  isStartingGeneration: boolean;
  isRefreshingGenerationState: boolean;
  applyClarificationSession: (
    nextSession: PlanningSessionClarificationApiSession,
  ) => void;
  refreshGenerationState: (options?: { fromPolling?: boolean }) => Promise<void>;
  startGeneration: () => Promise<void>;
}

interface UsePlanningSessionGenerationControllerInput {
  sessionId: string;
  initialSessionState: PlanningSessionGenerationControllerSessionState;
}

export function createInitialGenerationPollingPolicyState(): GenerationPollingPolicyState {
  return {
    consecutivePollFailures: 0,
    generatingPollCycle: 0,
    isPollingPaused: false,
    generationPollingNotice: null,
  };
}

export function getGenerationPollDelayMs(consecutivePollFailures: number): number {
  const backoffExponent = Math.max(0, consecutivePollFailures - 1);

  return Math.min(
    GENERATION_POLL_MAX_BACKOFF_MS,
    GENERATION_POLL_BASE_INTERVAL_MS * 2 ** backoffExponent,
  );
}

export function applyGenerationPollFailure(
  policy: GenerationPollingPolicyState,
): GenerationPollingPolicyState {
  const nextFailures = policy.consecutivePollFailures + 1;

  if (nextFailures >= GENERATION_POLL_FAILURE_PAUSE_THRESHOLD) {
    return {
      ...policy,
      consecutivePollFailures: nextFailures,
      isPollingPaused: true,
      generationPollingNotice: GENERATION_POLL_PAUSED_NOTICE,
    };
  }

  return {
    ...policy,
    consecutivePollFailures: nextFailures,
  };
}

export function applyGenerationPollSuccess(
  policy: GenerationPollingPolicyState,
  status: PlanningSessionStatusValue,
): GenerationPollingPolicyState {
  if (status !== "GENERATING") {
    return createInitialGenerationPollingPolicyState();
  }

  return {
    ...policy,
    consecutivePollFailures: 0,
    generatingPollCycle: policy.generatingPollCycle + 1,
    isPollingPaused: false,
    generationPollingNotice: null,
  };
}

export function resetGenerationPollingPolicyState(): GenerationPollingPolicyState {
  return createInitialGenerationPollingPolicyState();
}

export function shouldContinueGenerationPolling(
  status: PlanningSessionStatusValue,
  policy: GenerationPollingPolicyState,
): boolean {
  return status === "GENERATING" && !policy.isPollingPaused;
}

export function reconcileGenerationSessionState(
  previous: PlanningSessionGenerationControllerSessionState,
  nextGenerationState: PlanningSessionGenerationApiSession,
): PlanningSessionGenerationControllerSessionState {
  return {
    ...previous,
    ...nextGenerationState,
  };
}

export function usePlanningSessionGenerationController({
  sessionId,
  initialSessionState,
}: UsePlanningSessionGenerationControllerInput): PlanningSessionGenerationController {
  const [sessionState, setSessionState] =
    useState<PlanningSessionGenerationControllerSessionState>(initialSessionState);
  const [isStartingGeneration, setIsStartingGeneration] = useState(false);
  const [isRefreshingGenerationState, setIsRefreshingGenerationState] =
    useState(false);
  const [generationRequestError, setGenerationRequestError] = useState<string | null>(
    null,
  );
  const [pollingPolicy, setPollingPolicy] = useState<GenerationPollingPolicyState>(
    createInitialGenerationPollingPolicyState(),
  );
  const pollingTimeoutRef = useRef<number | null>(null);

  const clearPollingTimeout = useCallback(() => {
    if (pollingTimeoutRef.current !== null) {
      window.clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  }, []);

  const resetPollingPolicy = useCallback(() => {
    setPollingPolicy(resetGenerationPollingPolicyState());
  }, []);

  const applyClarificationSession = useCallback(
    (nextSession: PlanningSessionClarificationApiSession) => {
      setGenerationRequestError(null);
      setSessionState(nextSession);

      if (nextSession.status !== "GENERATING") {
        resetPollingPolicy();
      }
    },
    [resetPollingPolicy],
  );

  const refreshGenerationState = useCallback(
    async (options?: { fromPolling?: boolean }) => {
      const fromPolling = options?.fromPolling ?? false;

      if (fromPolling && pollingPolicy.isPollingPaused) {
        return;
      }

      if (!fromPolling) {
        setIsRefreshingGenerationState(true);
        setGenerationRequestError(null);
        resetPollingPolicy();
      }

      try {
        const nextGenerationState = await requestPlanningSessionGenerationState(
          sessionId,
        );

        setGenerationRequestError(null);
        setSessionState((previous) =>
          reconcileGenerationSessionState(previous, nextGenerationState),
        );
        setPollingPolicy((previousPolicy) =>
          applyGenerationPollSuccess(previousPolicy, nextGenerationState.status),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to refresh generation status.";

        setGenerationRequestError(message);

        if (fromPolling) {
          setPollingPolicy((previousPolicy) =>
            applyGenerationPollFailure(previousPolicy),
          );
        }
      } finally {
        if (!fromPolling) {
          setIsRefreshingGenerationState(false);
        }
      }
    },
    [pollingPolicy.isPollingPaused, resetPollingPolicy, sessionId],
  );

  const startGeneration = useCallback(async () => {
    setGenerationRequestError(null);
    resetPollingPolicy();
    setIsStartingGeneration(true);

    try {
      const nextGenerationState = await requestPlanningSessionGenerationStart(
        sessionId,
      );

      setSessionState((previous) =>
        reconcileGenerationSessionState(previous, nextGenerationState),
      );

      if (nextGenerationState.status !== "GENERATING") {
        resetPollingPolicy();
      }
    } catch (error) {
      setGenerationRequestError(
        error instanceof Error
          ? error.message
          : "Unable to start generation. Please try again.",
      );
    } finally {
      setIsStartingGeneration(false);
    }
  }, [resetPollingPolicy, sessionId]);

  useEffect(() => {
    clearPollingTimeout();

    if (!shouldContinueGenerationPolling(sessionState.status, pollingPolicy)) {
      return;
    }

    const nextDelay = getGenerationPollDelayMs(pollingPolicy.consecutivePollFailures);
    pollingTimeoutRef.current = window.setTimeout(() => {
      void refreshGenerationState({ fromPolling: true });
    }, nextDelay);

    return clearPollingTimeout;
  }, [
    clearPollingTimeout,
    pollingPolicy,
    refreshGenerationState,
    sessionState.status,
  ]);

  useEffect(() => {
    return () => {
      clearPollingTimeout();
    };
  }, [clearPollingTimeout]);

  return {
    sessionState,
    generationError: generationRequestError ?? sessionState.generationError,
    generationPollingNotice: pollingPolicy.generationPollingNotice,
    isStartingGeneration,
    isRefreshingGenerationState,
    applyClarificationSession,
    refreshGenerationState,
    startGeneration,
  };
}
