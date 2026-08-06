"use client";

import { useMemo } from "react";

import { ItineraryKanbanBoard } from "@/components/plan/itinerary-kanban-board";
import { PlanningChatPanel } from "@/components/plan/planning-chat-panel";
import { ReservedMapSlot } from "@/components/plan/reserved-map-slot";
import { TripPlanStatusPanel } from "@/components/plan/trip-plan-status-panel";
import {
  usePlanningSessionGenerationController,
} from "@/lib/planning-sessions/generation-controller";
import type { PlanningSessionRecord } from "@/lib/planning-sessions/repository";

interface ItineraryWorkspaceRuntimeProps {
  session: PlanningSessionRecord;
}

export function ItineraryWorkspaceRuntime({ session }: ItineraryWorkspaceRuntimeProps) {
  const generationController = usePlanningSessionGenerationController({
    sessionId: session.id,
    initialSessionState: {
      status: session.status,
      clarificationMessages: session.clarificationMessages,
      planningBrief: session.planningBrief,
      generationPhase: session.generationPhase,
      generatedItinerary: session.generatedItinerary,
      generationAttempts: session.generationAttempts,
      generationError: session.generationError,
    },
  });
  const state = generationController.sessionState;

  const showStatusPanel = useMemo(() => state.status !== "GENERATED", [state.status]);
  const showMapSlot = useMemo(() => state.status === "GENERATED", [state.status]);

  const gridClassName = showMapSlot
    ? "grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[minmax(18rem,1fr)_minmax(18rem,1fr)] gap-3 overflow-x-hidden overflow-y-auto p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)_minmax(16rem,22rem)] lg:grid-rows-1 lg:gap-4 lg:overflow-hidden lg:p-4"
    : "grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[minmax(18rem,1fr)_minmax(18rem,1fr)] gap-3 overflow-x-hidden overflow-y-auto p-3 sm:gap-4 sm:p-4 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:grid-rows-1 lg:gap-4 lg:overflow-hidden lg:p-4";

  return (
    <main className="flex min-h-0 flex-1 overflow-hidden">
      <div className={gridClassName}>
        <PlanningChatPanel
          sessionId={session.id}
          initialPrompt={session.initialPrompt}
          status={state.status}
          clarificationMessages={state.clarificationMessages}
          onSessionUpdate={generationController.applyClarificationSession}
        />

        {showStatusPanel ? (
          <TripPlanStatusPanel
            generationController={generationController}
          />
        ) : (
          <section
            aria-label="Itinerary panel"
            className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[2rem] border-0 bg-column-center"
          >
            <h1 className="sr-only">Itinerary Plan</h1>
            <ItineraryKanbanBoard itinerary={state.generatedItinerary} />
          </section>
        )}

        {showMapSlot ? <ReservedMapSlot /> : null}
      </div>
    </main>
  );
}
