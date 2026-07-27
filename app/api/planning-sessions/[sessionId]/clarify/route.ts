import { AiProviderError } from "@/lib/ai/errors";
import { PLANNING_SESSION_MAX_ASSISTANT_TURNS } from "@/lib/planning-sessions/constants";
import { generateClarificationTurn } from "@/lib/planning-sessions/clarification";
import { isPlanningSessionExpired } from "@/lib/planning-sessions/expiry";
import { startPlanningSessionGeneration } from "@/lib/planning-sessions/generation-operation";
import {
  planningSessionClarificationSuccessResponse,
  planningSessionErrorResponse,
} from "@/lib/planning-sessions/http";
import {
  PlanningSessionConcurrencyError,
  PlanningSessionInvalidStateError,
  PlanningSessionUsageLimitError,
  recoverStalePlanningSessionGeneration,
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
    const session = await recoverStalePlanningSessionGeneration(
      parsedSessionId.data,
    );

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
        status: "CLARIFYING",
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
        status:
          aiResult.readiness === "NEEDS_CLARIFICATION"
            ? "CLARIFYING"
            : "READY_TO_GENERATE",
        expectedUpdatedAt: session.updatedAt,
      });

      return planningSessionClarificationSuccessResponse(updatedSession, 200);
    }

    if (session.status === "GENERATING" || session.status === "GENERATED") {
      return planningSessionErrorResponse({
        code: "INVALID_REQUEST",
        message: "Clarification chat is unavailable after generation has started.",
        status: 409,
      });
    }

    const replyMessage = parsedBody.data.message;

    const assistantTurnCount = session.clarificationMessages.filter(
      (message) => message.role === "assistant",
    ).length;

    if (
      session.status === "CLARIFYING" &&
      assistantTurnCount >= PLANNING_SESSION_MAX_ASSISTANT_TURNS
    ) {
      return planningSessionErrorResponse({
        code: "USAGE_LIMIT_EXCEEDED",
        message:
          "Clarification turn limit reached for this session. Start a new session to continue.",
        status: 429,
      });
    }

    const aiResult = await generateClarificationTurn({
      initialPrompt: session.initialPrompt,
      clarificationMessages: session.clarificationMessages,
      planningBrief: session.planningBrief,
      replyMessage,
      status:
        session.status === "READY_TO_GENERATE"
          ? "READY_TO_GENERATE"
          : "CLARIFYING",
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
      status:
        aiResult.readiness === "NEEDS_CLARIFICATION"
          ? "CLARIFYING"
          : "READY_TO_GENERATE",
      expectedUpdatedAt: session.updatedAt,
    });

    if (
      session.status === "READY_TO_GENERATE" &&
      aiResult.readiness === "CONFIRMED"
    ) {
      const generationSession = await startPlanningSessionGeneration(
        updatedSession.id,
      );

      if (generationSession) {
        return planningSessionClarificationSuccessResponse(generationSession, 200);
      }
    }

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
