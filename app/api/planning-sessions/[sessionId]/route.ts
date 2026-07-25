import {
  planningSessionErrorResponse,
  planningSessionPublicSuccessResponse,
} from "@/lib/planning-sessions/http";
import { isPlanningSessionExpired } from "@/lib/planning-sessions/expiry";
import { findPlanningSessionById } from "@/lib/planning-sessions/repository";
import { planningSessionIdSchema } from "@/lib/planning-sessions/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const resolvedParams = await params;
  const parsedSessionId = planningSessionIdSchema.safeParse(
    resolvedParams.sessionId,
  );

  if (!parsedSessionId.success) {
    return planningSessionErrorResponse({
      code: "INVALID_REQUEST",
      message: "Invalid request parameters.",
      status: 400,
    });
  }

  try {
    const session = await findPlanningSessionById(parsedSessionId.data);

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

    return planningSessionPublicSuccessResponse(session, 200);
  } catch {
    return planningSessionErrorResponse({
      code: "INTERNAL_ERROR",
      message: "Internal server error.",
      status: 500,
    });
  }
}
