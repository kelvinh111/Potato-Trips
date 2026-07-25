import { tasks } from "@trigger.dev/sdk";
import type { initialItineraryGenerationTask } from "@/trigger/initial-itinerary-generation";

import { PLANNING_SESSION_MAX_GENERATION_ATTEMPTS } from "@/lib/planning-sessions/constants";
import {
  beginPlanningSessionGeneration,
  failPlanningSessionGeneration,
  findPlanningSessionById,
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
    try {
      await tasks.trigger<typeof initialItineraryGenerationTask>(
        "initial-itinerary-generation",
        { sessionId },
        {
          idempotencyKey: `initial-itinerary-generation:${sessionId}:attempt:${result.session.generationAttempts}`,
        },
      );
    } catch {
      await failPlanningSessionGeneration({
        sessionId,
        errorMessage: "Unable to start itinerary generation. Please retry.",
      });

      const failedSession = await findPlanningSessionById(sessionId);
      if (failedSession) {
        return failedSession;
      }

      throw new Error("Planning session not found after generation dispatch failure.");
    }
  }

  return result.session;
}
