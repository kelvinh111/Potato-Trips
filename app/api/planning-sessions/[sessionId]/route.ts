import { ZodError } from "zod";

import {
  planningSessionErrorResponse,
  planningSessionSuccessResponse,
} from "@/lib/planning-sessions/http";
import { isPlanningSessionExpired } from "@/lib/planning-sessions/expiry";
import { findPlanningSessionById } from "@/lib/planning-sessions/repository";
import { planningSessionIdSchema } from "@/lib/planning-sessions/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const resolvedParams = await params;
    const sessionId = planningSessionIdSchema.parse(resolvedParams.sessionId);

    const session = await findPlanningSessionById(sessionId);

    if (!session) {
      return planningSessionErrorResponse({
        code: "PLANNING_SESSION_NOT_FOUND",
        message: "Planning session not found.",
        status: 404,
      });
    }

    if (isPlanningSessionExpired(session.expiresAt)) {
      return planningSessionErrorResponse({
        code: "PLANNING_SESSION_EXPIRED",
        message: "Planning session has expired.",
        status: 410,
      });
    }

    return planningSessionSuccessResponse(session, 200);
  } catch (error) {
    if (error instanceof ZodError) {
      return planningSessionErrorResponse({
        code: "INVALID_REQUEST",
        message: "Invalid request parameters.",
        status: 400,
      });
    }

    return planningSessionErrorResponse({
      code: "INTERNAL_ERROR",
      message: "Internal server error.",
      status: 500,
    });
  }
}
