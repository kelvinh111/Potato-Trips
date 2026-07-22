import { AiProviderError } from "@/lib/ai/errors";
import { generateClarificationTurn } from "@/lib/planning-sessions/clarification";
import { isPlanningSessionExpired } from "@/lib/planning-sessions/expiry";
import {
  planningSessionClarificationSuccessResponse,
  planningSessionErrorResponse,
} from "@/lib/planning-sessions/http";
import {
  findPlanningSessionById,
  PlanningSessionConcurrencyError,
  updatePlanningSessionClarification,
} from "@/lib/planning-sessions/repository";
import { isClarificationStageStatus } from "@/lib/planning-sessions/types";
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

    if (!isClarificationStageStatus(session.status)) {
      return planningSessionErrorResponse({
        code: "INVALID_REQUEST",
        message: "Planning session is not in clarification stage.",
        status: 409,
      });
    }

    if (parsedBody.data.action === "start") {
      const alreadyStarted = session.clarificationMessages.some(
        (message) => message.role === "assistant",
      );

      if (alreadyStarted || session.status === "READY_TO_GENERATE") {
        return planningSessionClarificationSuccessResponse(session, 200);
      }

      const aiResult = await generateClarificationTurn({
        initialPrompt: session.initialPrompt,
        clarificationMessages: session.clarificationMessages,
        planningBrief: session.planningBrief,
        replyMessage: null,
      });

      const updatedSession = await updatePlanningSessionClarification({
        sessionId: session.id,
        clarificationMessages: [
          ...session.clarificationMessages,
          {
            role: "assistant",
            content: aiResult.assistantMessage,
          },
        ],
        planningBrief: aiResult.planningBrief,
        status: aiResult.readiness === "READY" ? "READY_TO_GENERATE" : "CLARIFYING",
        expectedUpdatedAt: session.updatedAt,
      });

      return planningSessionClarificationSuccessResponse(updatedSession, 200);
    }

    if (session.status !== "CLARIFYING") {
      return planningSessionErrorResponse({
        code: "INVALID_REQUEST",
        message: "Clarification is already complete for this planning session.",
        status: 409,
      });
    }

    const replyMessage = parsedBody.data.message;

    const aiResult = await generateClarificationTurn({
      initialPrompt: session.initialPrompt,
      clarificationMessages: session.clarificationMessages,
      planningBrief: session.planningBrief,
      replyMessage,
    });

    const updatedSession = await updatePlanningSessionClarification({
      sessionId: session.id,
      clarificationMessages: [
        ...session.clarificationMessages,
        {
          role: "user",
          content: replyMessage,
        },
        {
          role: "assistant",
          content: aiResult.assistantMessage,
        },
      ],
      planningBrief: aiResult.planningBrief,
      status: aiResult.readiness === "READY" ? "READY_TO_GENERATE" : "CLARIFYING",
      expectedUpdatedAt: session.updatedAt,
    });

    return planningSessionClarificationSuccessResponse(updatedSession, 200);
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

    return planningSessionErrorResponse({
      code: "INTERNAL_ERROR",
      message: "Internal server error.",
      status: 500,
    });
  }
}
