import { AiProviderError } from "@/lib/ai/errors";
import { runClarificationWorkflow } from "@/lib/planning-sessions/clarification-workflow";
import {
  planningSessionClarificationSuccessResponse,
  planningSessionErrorResponse,
} from "@/lib/planning-sessions/http";
import {
  PlanningSessionConcurrencyError,
  PlanningSessionInvalidStateError,
  PlanningSessionUsageLimitError,
} from "@/lib/planning-sessions/repository";
import {
  clarifyPlanningSessionBodySchema,
  planningSessionIdSchema,
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

  const parsedBody = clarifyPlanningSessionBodySchema.safeParse(bodyResult.body);

  if (!parsedBody.success) {
    return planningSessionErrorResponse({
      code: "INVALID_REQUEST",
      message: "Invalid request payload.",
      status: 400,
    });
  }

  try {
    const workflowResult = await runClarificationWorkflow({
      sessionId: parsedSessionId.data,
      action: parsedBody.data,
    });

    if (workflowResult.type === "SUCCESS") {
      return planningSessionClarificationSuccessResponse(workflowResult.session, 200);
    }

    if (workflowResult.type === "PLANNING_SESSION_NOT_FOUND") {
      return planningSessionErrorResponse({
        code: "PLANNING_SESSION_NOT_FOUND",
        message: "Planning session not found.",
        status: 404,
      });
    }

    if (workflowResult.type === "PLANNING_SESSION_EXPIRED") {
      return planningSessionErrorResponse({
        code: "PLANNING_SESSION_EXPIRED",
        message: "Planning session has expired.",
        status: 410,
      });
    }

    if (workflowResult.type === "INVALID_STAGE") {
      return planningSessionErrorResponse({
        code: "INVALID_REQUEST",
        message: "Planning session is not in clarification stage.",
        status: 409,
      });
    }

    if (workflowResult.type === "CLARIFICATION_UNAVAILABLE") {
      return planningSessionErrorResponse({
        code: "INVALID_REQUEST",
        message: "Clarification chat is unavailable after generation has started.",
        status: 409,
      });
    }

    if (workflowResult.type === "USAGE_LIMIT_ASSISTANT_TURNS") {
      return planningSessionErrorResponse({
        code: "USAGE_LIMIT_EXCEEDED",
        message:
          "Clarification turn limit reached for this session. Start a new session to continue.",
        status: 429,
      });
    }

    if (workflowResult.type === "USAGE_LIMIT_CONFIRMATION_REVISION") {
      return planningSessionErrorResponse({
        code: "USAGE_LIMIT_EXCEEDED",
        message:
          "Confirmation/revision AI turn limit reached for this session. Use Generate my trip or start a new session to continue.",
        status: 429,
      });
    }

    const exhaustiveCheck: never = workflowResult;
    return exhaustiveCheck;
  } catch (error) {
    if (error instanceof PlanningSessionConcurrencyError) {
      return planningSessionErrorResponse({
        code: "INVALID_REQUEST",
        message: "Planning session changed. Please try again.",
        status: 409,
      });
    }

    if (error instanceof AiProviderError) {
      return planningSessionErrorResponse({
        code: "INTERNAL_ERROR",
        message: "AI service is temporarily unavailable. Please try again.",
        status: 503,
      });
    }

    if (error instanceof PlanningSessionUsageLimitError) {
      if (
        error.message ===
        "Confirmation/revision AI turn limit reached for this session."
      ) {
        return planningSessionErrorResponse({
          code: "USAGE_LIMIT_EXCEEDED",
          message:
            "Confirmation/revision AI turn limit reached for this session. Use Generate my trip or start a new session to continue.",
          status: 429,
        });
      }

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
        message: "Planning session is not ready for that action.",
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
