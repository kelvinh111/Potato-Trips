import {
  PLANNING_SESSION_STALE_ACTIVE_GENERATION_MS,
  PLANNING_SESSION_STALE_PREPARING_TRIP_MS,
} from "@/lib/planning-sessions/constants";
import type {
  PlanningSessionGenerationPhaseValue,
  PlanningSessionStatusValue,
} from "@/lib/planning-sessions/types";

function staleThresholdMsForPhase(
  phase: PlanningSessionGenerationPhaseValue | null,
): number {
  if (phase === "PREPARING_TRIP") {
    return PLANNING_SESSION_STALE_PREPARING_TRIP_MS;
  }

  return PLANNING_SESSION_STALE_ACTIVE_GENERATION_MS;
}

export function isPlanningSessionGenerationStale(input: {
  status: PlanningSessionStatusValue;
  generationPhase: PlanningSessionGenerationPhaseValue | null;
  updatedAt: Date;
  now?: Date;
}) {
  if (input.status !== "GENERATING") {
    return false;
  }

  const now = input.now ?? new Date();
  const idleMs = now.getTime() - input.updatedAt.getTime();

  return idleMs >= staleThresholdMsForPhase(input.generationPhase);
}
