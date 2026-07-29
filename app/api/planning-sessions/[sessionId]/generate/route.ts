import { isPlanningSessionExpired } from "@/lib/planning-sessions/expiry";
import { startPlanningSessionGeneration } from "@/lib/planning-sessions/generation-operation";
import {
  planningSessionErrorResponse,
  planningSessionGenerationSuccessResponse,
} from "@/lib/planning-sessions/http";
import {
  PlanningSessionInvalidStateError,
  recoverStalePlanningSessionGeneration,
  PlanningSessionUsageLimitError,
} from "@/lib/planning-sessions/repository";
import {
  planningSessionIdSchema,
  startPlanningSessionGenerationBodySchema,
} from "@/lib/planning-sessions/validation";

async function readJsonBody(
  request: Request,
): Promise<{ success: true; body: unknown } | { success: false }> {
  try {
    return {
      success: true,
      body: await request.json(),
    };
  } catch {
    return {
      success: false,
    };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const resolvedParams = await params;
  const parsedSessionId = planningSessionIdSchema.safeParse(
    resolvedParams.sessionId,
  );

  if (!parsedSessionId.success) {
    return planningSessionErrorResponse({
      code: "INVALID_REQUEST",
      message: "Invalid request payload.",
      status: 400,
    });
  }

  const bodyResult = await readJsonBody(request);

  if (!bodyResult.success) {
    return planningSessionErrorResponse({
      code: "INVALID_REQUEST",
      message: "Invalid request payload.",
      status: 400,
    });
  }

  const parsedBody = startPlanningSessionGenerationBodySchema.safeParse(
    bodyResult.body,
  );

  if (!parsedBody.success) {
    return planningSessionErrorResponse({
      code: "INVALID_REQUEST",
      message: "Invalid request payload.",
      status: 400,
    });
  }

  try {
    const existingSession = await recoverStalePlanningSessionGeneration(
      parsedSessionId.data,
    );

    if (!existingSession) {
      return planningSessionErrorResponse({
        code: "PLANNING_SESSION_NOT_FOUND",
        message: "Planning session not found.",
        status: 404,
      });
    }

    if (isPlanningSessionExpired(existingSession.expiresAt)) {
      return planningSessionErrorResponse({
        code: "PLANNING_SESSION_EXPIRED",
        message: "Planning session has expired.",
        status: 410,
      });
    }

    const updatedSession = await startPlanningSessionGeneration(
      parsedSessionId.data,
    );

    if (!updatedSession) {
      return planningSessionErrorResponse({
        code: "PLANNING_SESSION_NOT_FOUND",
        message: "Planning session not found.",
        status: 404,
      });
    }

    return planningSessionGenerationSuccessResponse(updatedSession, 202);
  } catch (error) {
    if (error instanceof PlanningSessionUsageLimitError) {
      return planningSessionErrorResponse({
        code: "USAGE_LIMIT_EXCEEDED",
        message:
          "Generation attempt limit reached for this session. Start a new session to continue.",
        status: 429,
      });
    }

    if (error instanceof PlanningSessionInvalidStateError) {
      return planningSessionErrorResponse({
        code: "INVALID_REQUEST",
        message: "Planning session is not ready for generation.",
        status: 409,
      });
    }

    return planningSessionErrorResponse({
      code: "INTERNAL_ERROR",
      message: "Internal server error.",
      status: 500,
    });
  }
}
