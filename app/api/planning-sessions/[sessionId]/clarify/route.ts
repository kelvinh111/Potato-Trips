import { ZodError } from "zod";

import { AiProviderError } from "@/lib/ai/errors";
import { generateClarificationTurn } from "@/lib/planning-sessions/clarification";
import { isPlanningSessionExpired } from "@/lib/planning-sessions/expiry";
import {
  planningSessionErrorResponse,
  planningSessionSuccessResponse,
} from "@/lib/planning-sessions/http";
import {
  findPlanningSessionById,
  updatePlanningSessionClarification,
} from "@/lib/planning-sessions/repository";
import { isClarificationStageStatus } from "@/lib/planning-sessions/types";
import {
  clarifyPlanningSessionBodySchema,
  planningSessionIdSchema,
} from "@/lib/planning-sessions/validation";

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ZodError([
      {
        code: "custom",
        message: "Malformed JSON body",
        path: [],
      },
    ]);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const resolvedParams = await params;
    const sessionId = planningSessionIdSchema.parse(resolvedParams.sessionId);
    const body = clarifyPlanningSessionBodySchema.parse(await readJsonBody(request));

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

    if (!isClarificationStageStatus(session.status)) {
      return planningSessionErrorResponse({
        code: "INVALID_REQUEST",
        message: "Planning session is not in clarification stage.",
        status: 409,
      });
    }

    if (body.action === "start") {
      const alreadyStarted = session.clarificationMessages.some(
        (message) => message.role === "assistant",
      );

      if (alreadyStarted || session.status === "READY_TO_GENERATE") {
        return planningSessionSuccessResponse(session, 200);
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
      });

      return planningSessionSuccessResponse(updatedSession, 200);
    }

    if (session.status !== "CLARIFYING") {
      return planningSessionErrorResponse({
        code: "INVALID_REQUEST",
        message: "Clarification is already complete for this planning session.",
        status: 409,
      });
    }

    const aiResult = await generateClarificationTurn({
      initialPrompt: session.initialPrompt,
      clarificationMessages: session.clarificationMessages,
      planningBrief: session.planningBrief,
      replyMessage: body.message,
    });

    const updatedSession = await updatePlanningSessionClarification({
      sessionId: session.id,
      clarificationMessages: [
        ...session.clarificationMessages,
        {
          role: "user",
          content: body.message,
        },
        {
          role: "assistant",
          content: aiResult.assistantMessage,
        },
      ],
      planningBrief: aiResult.planningBrief,
      status: aiResult.readiness === "READY" ? "READY_TO_GENERATE" : "CLARIFYING",
    });

    return planningSessionSuccessResponse(updatedSession, 200);
  } catch (error) {
    if (error instanceof AiProviderError) {
      return planningSessionErrorResponse({
        code: "INTERNAL_ERROR",
        message: "AI service is temporarily unavailable. Please try again.",
        status: 503,
      });
    }

    if (error instanceof ZodError) {
      return planningSessionErrorResponse({
        code: "INVALID_REQUEST",
        message: "Invalid request payload.",
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
