import {
  PLANNING_SESSION_MAX_ASSISTANT_TURNS,
  PLANNING_SESSION_MAX_CONFIRMATION_REVISION_AI_TURNS,
} from "@/lib/planning-sessions/constants";
import {
  generateClarificationTurn,
  type GenerateClarificationTurnResult,
} from "@/lib/planning-sessions/clarification";
import { isPlanningSessionExpired } from "@/lib/planning-sessions/expiry";
import { startPlanningSessionGeneration } from "@/lib/planning-sessions/generation-operation";
import {
  recoverStalePlanningSessionGeneration,
  reservePlanningSessionConfirmationRevisionAiTurn,
  updatePlanningSessionClarification,
  type PlanningSessionRecord,
} from "@/lib/planning-sessions/repository";
import { isClarificationStageStatus } from "@/lib/planning-sessions/types";

export type ClarificationWorkflowAction =
  | { action: "start" }
  | { action: "reply"; message: string };

export interface ClarificationWorkflowInput {
  sessionId: string;
  action: ClarificationWorkflowAction;
}

export type ClarificationWorkflowOutcome =
  | {
      type: "SUCCESS";
      session: PlanningSessionRecord;
    }
  | {
      type: "PLANNING_SESSION_NOT_FOUND";
    }
  | {
      type: "PLANNING_SESSION_EXPIRED";
    }
  | {
      type: "INVALID_STAGE";
    }
  | {
      type: "CLARIFICATION_UNAVAILABLE";
    }
  | {
      type: "USAGE_LIMIT_ASSISTANT_TURNS";
    }
  | {
      type: "USAGE_LIMIT_CONFIRMATION_REVISION";
    };

export interface ClarificationWorkflowDeps {
  recoverStalePlanningSessionGeneration: typeof recoverStalePlanningSessionGeneration;
  isPlanningSessionExpired: typeof isPlanningSessionExpired;
  isClarificationStageStatus: typeof isClarificationStageStatus;
  generateClarificationTurn: typeof generateClarificationTurn;
  updatePlanningSessionClarification: typeof updatePlanningSessionClarification;
  reservePlanningSessionConfirmationRevisionAiTurn: typeof reservePlanningSessionConfirmationRevisionAiTurn;
  startPlanningSessionGeneration: typeof startPlanningSessionGeneration;
  maxAssistantTurns: number;
  maxConfirmationRevisionAiTurns: number;
}

const defaultDeps: ClarificationWorkflowDeps = {
  recoverStalePlanningSessionGeneration,
  isPlanningSessionExpired,
  isClarificationStageStatus,
  generateClarificationTurn,
  updatePlanningSessionClarification,
  reservePlanningSessionConfirmationRevisionAiTurn,
  startPlanningSessionGeneration,
  maxAssistantTurns: PLANNING_SESSION_MAX_ASSISTANT_TURNS,
  maxConfirmationRevisionAiTurns: PLANNING_SESSION_MAX_CONFIRMATION_REVISION_AI_TURNS,
};

export async function runClarificationWorkflow(
  input: ClarificationWorkflowInput,
  deps: ClarificationWorkflowDeps = defaultDeps,
): Promise<ClarificationWorkflowOutcome> {
  const session = await deps.recoverStalePlanningSessionGeneration(input.sessionId);

  if (!session) {
    return { type: "PLANNING_SESSION_NOT_FOUND" };
  }

  if (deps.isPlanningSessionExpired(session.expiresAt)) {
    return { type: "PLANNING_SESSION_EXPIRED" };
  }

  if (!deps.isClarificationStageStatus(session.status)) {
    return { type: "INVALID_STAGE" };
  }

  if (input.action.action === "start") {
    return handleStartAction(session, deps);
  }

  return handleReplyAction(session, input.action.message, deps);
}

async function handleStartAction(
  session: PlanningSessionRecord,
  deps: ClarificationWorkflowDeps,
): Promise<ClarificationWorkflowOutcome> {
  const alreadyStarted = session.clarificationMessages.some(
    (message) => message.role === "assistant",
  );

  if (alreadyStarted || session.status === "READY_TO_GENERATE") {
    return {
      type: "SUCCESS",
      session,
    };
  }

  const aiResult = await deps.generateClarificationTurn({
    initialPrompt: session.initialPrompt,
    clarificationMessages: session.clarificationMessages,
    planningBrief: session.planningBrief,
    replyMessage: null,
    status: "CLARIFYING",
  });

  const updatedSession = await deps.updatePlanningSessionClarification({
    sessionId: session.id,
    clarificationMessages: [
      ...session.clarificationMessages,
      {
        role: "assistant",
        content: aiResult.assistantMessage,
      },
    ],
    planningBrief: aiResult.planningBrief,
    status: toSessionStatus(aiResult),
    expectedUpdatedAt: session.updatedAt,
  });

  return {
    type: "SUCCESS",
    session: updatedSession,
  };
}

async function handleReplyAction(
  session: PlanningSessionRecord,
  replyMessage: string,
  deps: ClarificationWorkflowDeps,
): Promise<ClarificationWorkflowOutcome> {
  if (session.status === "GENERATING" || session.status === "GENERATED") {
    return { type: "CLARIFICATION_UNAVAILABLE" };
  }

  const assistantTurnCount = session.clarificationMessages.filter(
    (message) => message.role === "assistant",
  ).length;

  const usesConfirmationRevisionAllowance =
    session.status === "READY_TO_GENERATE" ||
    session.confirmationRevisionAiTurns > 0;

  if (
    !usesConfirmationRevisionAllowance &&
    session.status === "CLARIFYING" &&
    assistantTurnCount >= deps.maxAssistantTurns
  ) {
    return {
      type: "USAGE_LIMIT_ASSISTANT_TURNS",
    };
  }

  let providerSession = session;

  if (usesConfirmationRevisionAllowance) {
    if (
      providerSession.confirmationRevisionAiTurns >=
      deps.maxConfirmationRevisionAiTurns
    ) {
      return {
        type: "USAGE_LIMIT_CONFIRMATION_REVISION",
      };
    }

    providerSession = await deps.reservePlanningSessionConfirmationRevisionAiTurn({
      sessionId: providerSession.id,
      expectedUpdatedAt: providerSession.updatedAt,
    });
  }

  const aiResult = await deps.generateClarificationTurn({
    initialPrompt: providerSession.initialPrompt,
    clarificationMessages: providerSession.clarificationMessages,
    planningBrief: providerSession.planningBrief,
    replyMessage,
    status:
      providerSession.status === "READY_TO_GENERATE"
        ? "READY_TO_GENERATE"
        : "CLARIFYING",
  });

  const updatedSession = await deps.updatePlanningSessionClarification({
    sessionId: providerSession.id,
    clarificationMessages: [
      ...providerSession.clarificationMessages,
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
    status: toSessionStatus(aiResult),
    expectedUpdatedAt: providerSession.updatedAt,
  });

  if (session.status === "READY_TO_GENERATE" && aiResult.readiness === "CONFIRMED") {
    const generationSession = await deps.startPlanningSessionGeneration(
      updatedSession.id,
    );

    if (generationSession) {
      return {
        type: "SUCCESS",
        session: generationSession,
      };
    }
  }

  return {
    type: "SUCCESS",
    session: updatedSession,
  };
}

function toSessionStatus(
  aiResult: Pick<GenerateClarificationTurnResult, "readiness">,
): "CLARIFYING" | "READY_TO_GENERATE" {
  return aiResult.readiness === "NEEDS_CLARIFICATION"
    ? "CLARIFYING"
    : "READY_TO_GENERATE";
}
