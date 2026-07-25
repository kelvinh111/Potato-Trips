import { tasks } from "@trigger.dev/sdk";
import type { initialItineraryGenerationTask } from "@/trigger/initial-itinerary-generation";

import { PLANNING_SESSION_MAX_GENERATION_ATTEMPTS } from "@/lib/planning-sessions/constants";
import {
  beginPlanningSessionGeneration,
  type PlanningSessionRecord,
} from "@/lib/planning-sessions/repository";

export async function startPlanningSessionGeneration(
  sessionId: string,
): Promise<PlanningSessionRecord | null> {
  const result = await beginPlanningSessionGeneration({
    sessionId,
    maxAttempts: PLANNING_SESSION_MAX_GENERATION_ATTEMPTS,
  });

  if (!result) {
    return null;
  }

  if (result.started) {
    await tasks.trigger<typeof initialItineraryGenerationTask>(
      "initial-itinerary-generation",
      { sessionId },
      {
        idempotencyKey: `initial-itinerary-generation:${sessionId}:attempt:${result.session.generationAttempts}`,
      },
    );
  }

  return result.session;
}
