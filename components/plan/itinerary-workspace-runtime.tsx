"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PlanningChatPanel } from "@/components/plan/planning-chat-panel";
import { ReservedMapSlot } from "@/components/plan/reserved-map-slot";
import { TripPlanStatusPanel } from "@/components/plan/trip-plan-status-panel";
import type { PlanningSessionRecord } from "@/lib/planning-sessions/repository";
import {
  parsePersistedItinerary,
  parsePlanningBrief,
  parsePlanningSessionGenerationPhase,
  planningSessionClarificationMessagesSchema,
  planningSessionStatusSchema,
  type PersistedItinerary,
  type PlanningBrief,
  type PlanningSessionClarificationMessages,
  type PlanningSessionGenerationPhaseValue,
  type PlanningSessionStatusValue,
} from "@/lib/planning-sessions/types";

interface ItineraryWorkspaceRuntimeProps {
  session: PlanningSessionRecord;
}

interface WorkspaceSessionState {
  status: PlanningSessionStatusValue;
  clarificationMessages: PlanningSessionClarificationMessages;
  planningBrief: PlanningBrief | null;
  generationPhase: PlanningSessionGenerationPhaseValue | null;
  generatedItinerary: PersistedItinerary | null;
  generationAttempts: number;
  generationError: string | null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseClarifyApiSession(payload: unknown): WorkspaceSessionState {
  if (!isObjectRecord(payload) || !isObjectRecord(payload.session)) {
    throw new Error("Invalid clarification response.");
  }

  const session = payload.session;

  const statusResult = planningSessionStatusSchema.safeParse(session.status);
  const messagesResult = planningSessionClarificationMessagesSchema.safeParse(
    session.clarificationMessages,
  );
  const generationAttempts = Number(session.generationAttempts ?? 0);

  if (!statusResult.success || !messagesResult.success || !Number.isInteger(generationAttempts)) {
    throw new Error("Invalid clarification response.");
  }

  return {
    status: statusResult.data,
    clarificationMessages: messagesResult.data,
    planningBrief: parsePlanningBrief(session.planningBrief),
    generationPhase: parsePlanningSessionGenerationPhase(session.generationPhase),
    generatedItinerary: parsePersistedItinerary(session.generatedItinerary),
    generationAttempts,
    generationError:
      typeof session.generationError === "string" ? session.generationError : null,
  };
}

function parseGenerationApiSession(payload: unknown): Omit<
  WorkspaceSessionState,
  "clarificationMessages"
> {
  if (!isObjectRecord(payload) || !isObjectRecord(payload.session)) {
    throw new Error("Invalid generation response.");
  }

  const session = payload.session;

  const statusResult = planningSessionStatusSchema.safeParse(session.status);
  const generationAttempts = Number(session.generationAttempts ?? 0);

  if (!statusResult.success || !Number.isInteger(generationAttempts)) {
    throw new Error("Invalid generation response.");
  }

  return {
    status: statusResult.data,
    planningBrief: parsePlanningBrief(session.planningBrief),
    generationPhase: parsePlanningSessionGenerationPhase(session.generationPhase),
    generatedItinerary: parsePersistedItinerary(session.generatedItinerary),
    generationAttempts,
    generationError:
      typeof session.generationError === "string" ? session.generationError : null,
  };
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

async function requestGenerationState(sessionId: string) {
  const response = await fetch(`/api/planning-sessions/${sessionId}/generation`, {
    method: "GET",
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

  return parseGenerationApiSession(payload);
}

async function requestGenerate(sessionId: string) {
  const response = await fetch(`/api/planning-sessions/${sessionId}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "start" }),
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

  return parseGenerationApiSession(payload);
}

export function ItineraryWorkspaceRuntime({ session }: ItineraryWorkspaceRuntimeProps) {
  const [state, setState] = useState<WorkspaceSessionState>({
    status: session.status,
    clarificationMessages: session.clarificationMessages,
    planningBrief: session.planningBrief,
    generationPhase: session.generationPhase,
    generatedItinerary: session.generatedItinerary,
    generationAttempts: session.generationAttempts,
    generationError: session.generationError,
  });
  const [isStartingGeneration, setIsStartingGeneration] = useState(false);
  const [generationRequestError, setGenerationRequestError] = useState<string | null>(
    null,
  );

  const mergedGenerationError = generationRequestError ?? state.generationError;

  const applyClarificationSession = useCallback((nextSession: unknown) => {
    const parsed = parseClarifyApiSession(nextSession);
    setGenerationRequestError(null);
    setState(parsed);
  }, []);

  const refreshGenerationState = useCallback(async () => {
    try {
      const nextGenerationState = await requestGenerationState(session.id);
      setGenerationRequestError(null);
      setState((previous) => ({
        ...previous,
        ...nextGenerationState,
      }));
    } catch (error) {
      setGenerationRequestError(
        error instanceof Error
          ? error.message
          : "Unable to refresh generation status.",
      );
    }
  }, [session.id]);

  const handleGenerateTrip = useCallback(async () => {
    setGenerationRequestError(null);
    setIsStartingGeneration(true);

    try {
      const nextGenerationState = await requestGenerate(session.id);
      setState((previous) => ({
        ...previous,
        ...nextGenerationState,
      }));
    } catch (error) {
      setGenerationRequestError(
        error instanceof Error
          ? error.message
          : "Unable to start generation. Please try again.",
      );
    } finally {
      setIsStartingGeneration(false);
    }
  }, [session.id]);

  useEffect(() => {
    if (state.status !== "GENERATING") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshGenerationState();
    }, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshGenerationState, state.status]);

  const showStatusPanel = useMemo(() => state.status !== "GENERATED", [state.status]);
  const showMapSlot = useMemo(() => state.status === "GENERATED", [state.status]);

  const gridClassName = showMapSlot
    ? "grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[minmax(18rem,1fr)_minmax(18rem,1fr)] gap-4 overflow-x-hidden overflow-y-auto p-4 sm:gap-5 sm:p-5 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)_minmax(16rem,22rem)] lg:grid-rows-1 lg:gap-6 lg:overflow-hidden lg:p-6"
    : "grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[minmax(18rem,1fr)_minmax(18rem,1fr)] gap-4 overflow-x-hidden overflow-y-auto p-4 sm:gap-5 sm:p-5 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:grid-rows-1 lg:gap-6 lg:overflow-hidden lg:p-6";

  return (
    <main className="flex min-h-0 flex-1 overflow-hidden">
      <div className={gridClassName}>
        <PlanningChatPanel
          sessionId={session.id}
          initialPrompt={session.initialPrompt}
          status={state.status}
          clarificationMessages={state.clarificationMessages}
          onSessionUpdate={applyClarificationSession}
        />

        {showStatusPanel ? (
          <TripPlanStatusPanel
            status={state.status}
            planningBrief={state.planningBrief}
            generationPhase={state.generationPhase}
            generationError={mergedGenerationError}
            generationAttempts={state.generationAttempts}
            isStartingGeneration={isStartingGeneration}
            onGenerateTrip={() => {
              void handleGenerateTrip();
            }}
          />
        ) : (
          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border border-border-default bg-bg-surface shadow-sm">
            <header className="border-b border-border-subtle px-4 py-4 sm:px-6">
              <h1 className="text-lg font-semibold text-text-primary">Itinerary Plan</h1>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="flex h-full min-h-48 items-center justify-center rounded-3xl border border-dashed border-border-default bg-bg-subtle/50 p-8 text-center">
                <div className="space-y-2">
                  <h2 className="text-base font-semibold text-text-primary">
                    Itinerary generated
                  </h2>
                  <p className="max-w-md text-sm text-text-secondary">
                    Kanban and map rendering will be implemented in the next feature.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {showMapSlot ? <ReservedMapSlot /> : null}
      </div>
    </main>
  );
}
