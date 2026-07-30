import assert from "node:assert/strict";
import "dotenv/config";

import { AiProviderError } from "@/lib/ai/errors";
import {
  runClarificationWorkflow,
  type ClarificationWorkflowDeps,
} from "@/lib/planning-sessions/clarification-workflow";
import {
  PlanningSessionConcurrencyError,
  type PlanningSessionRecord,
} from "@/lib/planning-sessions/repository";
import type {
  PlanningBrief,
  PlanningSessionClarificationMessages,
} from "@/lib/planning-sessions/types";

const canonicalBrief: PlanningBrief = {
  destinations: ["Kyoto"],
  startingLocation: {
    city: "Seoul",
    preferredDepartureAirport: "ICN",
  },
  travelTiming: {
    month: 10,
    year: 2030,
    monthWindow: "MID",
    exactDateRange: {
      startDate: "2030-10-10",
      endDate: "2030-10-15",
    },
  },
  tripLengthDays: 6,
  travellers: {
    adults: 2,
    children: 0,
  },
  budget: "mid-range",
  interestsAndStyle: ["food", "history"],
  practicality: {
    isPractical: true,
    notes: ["Direct flights available"],
  },
  finalSummary: "Six-day Kyoto trip plan.",
};

function createSession(input?: Partial<PlanningSessionRecord>): PlanningSessionRecord {
  return {
    id: input?.id ?? "session-1",
    initialPrompt: input?.initialPrompt ?? "Plan a Kyoto trip",
    clarificationMessages: input?.clarificationMessages ?? [],
    planningBrief: input?.planningBrief ?? canonicalBrief,
    generatedItinerary: input?.generatedItinerary ?? null,
    generationPhase: input?.generationPhase ?? null,
    generationAttempts: input?.generationAttempts ?? 0,
    confirmationRevisionAiTurns: input?.confirmationRevisionAiTurns ?? 0,
    generationError: input?.generationError ?? null,
    status: input?.status ?? "CLARIFYING",
    expiresAt:
      input?.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
    updatedAt: input?.updatedAt ?? new Date("2030-01-01T00:00:00.000Z"),
  };
}

function createDeps(
  overrides: Partial<ClarificationWorkflowDeps>,
): ClarificationWorkflowDeps {
  return {
    recoverStalePlanningSessionGeneration: async () => {
      throw new Error("recoverStalePlanningSessionGeneration not mocked");
    },
    isPlanningSessionExpired: () => false,
    isClarificationStageStatus: () => true,
    generateClarificationTurn: async () => {
      throw new Error("generateClarificationTurn not mocked");
    },
    updatePlanningSessionClarification: async () => {
      throw new Error("updatePlanningSessionClarification not mocked");
    },
    reservePlanningSessionConfirmationRevisionAiTurn: async () => {
      throw new Error(
        "reservePlanningSessionConfirmationRevisionAiTurn not mocked",
      );
    },
    startPlanningSessionGeneration: async () => null,
    maxAssistantTurns: 12,
    maxConfirmationRevisionAiTurns: 3,
    ...overrides,
  };
}

async function repeatedStartIsIdempotent() {
  const existingMessages: PlanningSessionClarificationMessages = [
    {
      role: "assistant",
      content: "What destination are you thinking about?",
    },
  ];

  const session = createSession({
    clarificationMessages: existingMessages,
    status: "CLARIFYING",
  });

  let generated = false;
  let updated = false;

  const deps = createDeps({
    recoverStalePlanningSessionGeneration: async () => session,
    generateClarificationTurn: async () => {
      generated = true;
      throw new Error("should not be called");
    },
    updatePlanningSessionClarification: async () => {
      updated = true;
      throw new Error("should not be called");
    },
  });

  const outcome = await runClarificationWorkflow(
    {
      sessionId: session.id,
      action: { action: "start" },
    },
    deps,
  );

  assert.equal(outcome.type, "SUCCESS");
  assert.equal(generated, false);
  assert.equal(updated, false);
}

async function replyPersistsCompleteTurn() {
  const session = createSession({
    status: "CLARIFYING",
    clarificationMessages: [
      {
        role: "assistant",
        content: "Tell me your travel month.",
      },
    ],
  });

  const replyMessage = "October works for us.";
  const persistedMessagesLog: PlanningSessionClarificationMessages[] = [];
  const persistedStatusLog: Array<"CLARIFYING" | "READY_TO_GENERATE"> = [];
  const persistedBriefLog: Array<PlanningBrief | null> = [];
  let generationStarted = false;

  const deps = createDeps({
    recoverStalePlanningSessionGeneration: async () => session,
    generateClarificationTurn: async () => ({
      assistantMessage: "Great, any budget preference?",
      planningBrief: canonicalBrief,
      readiness: "NEEDS_CLARIFICATION",
      missingInformation: ["budget"],
    }),
    updatePlanningSessionClarification: async (input) => {
      persistedMessagesLog.push(input.clarificationMessages);
      persistedStatusLog.push(input.status);
      persistedBriefLog.push(input.planningBrief);

      return createSession({
        ...session,
        clarificationMessages: input.clarificationMessages,
        planningBrief: input.planningBrief,
        status: input.status,
      });
    },
    startPlanningSessionGeneration: async () => {
      generationStarted = true;
      return null;
    },
  });

  const outcome = await runClarificationWorkflow(
    {
      sessionId: session.id,
      action: {
        action: "reply",
        message: replyMessage,
      },
    },
    deps,
  );

  assert.equal(outcome.type, "SUCCESS");
  const persistedMessages = persistedMessagesLog[0];
  if (persistedMessages === undefined) {
    throw new Error("Clarification messages must be persisted");
  }

  assert.equal(persistedMessages.length, session.clarificationMessages.length + 2);
  const secondLastMessage = persistedMessages[persistedMessages.length - 2];
  const lastMessage = persistedMessages[persistedMessages.length - 1];
  assert.equal(secondLastMessage?.role, "user");
  assert.equal(secondLastMessage?.content, replyMessage);
  assert.equal(lastMessage?.role, "assistant");
  assert.equal(
    lastMessage?.content,
    "Great, any budget preference?",
  );
  assert.deepEqual(persistedBriefLog[0], canonicalBrief);
  assert.equal(persistedStatusLog[0], "CLARIFYING");
  assert.equal(generationStarted, false);
}

async function revisedConfirmationStaysInConfirmation() {
  const session = createSession({
    status: "READY_TO_GENERATE",
    clarificationMessages: [
      {
        role: "assistant",
        content: "Ready to generate?",
      },
    ],
  });

  let reserved = false;
  let generationStarted = false;
  let persistedStatus: "CLARIFYING" | "READY_TO_GENERATE" | null = null;

  const deps = createDeps({
    recoverStalePlanningSessionGeneration: async () => session,
    reservePlanningSessionConfirmationRevisionAiTurn: async () => {
      reserved = true;
      return createSession({
        ...session,
        confirmationRevisionAiTurns: 1,
      });
    },
    generateClarificationTurn: async () => ({
      assistantMessage: "Updated summary with your changes.",
      planningBrief: {
        ...canonicalBrief,
        budget: "luxury",
      },
      readiness: "READY_FOR_CONFIRMATION",
      missingInformation: [],
    }),
    updatePlanningSessionClarification: async (input) => {
      persistedStatus = input.status;
      return createSession({
        ...session,
        clarificationMessages: input.clarificationMessages,
        planningBrief: input.planningBrief,
        status: input.status,
        confirmationRevisionAiTurns: 1,
      });
    },
    startPlanningSessionGeneration: async () => {
      generationStarted = true;
      return null;
    },
  });

  const outcome = await runClarificationWorkflow(
    {
      sessionId: session.id,
      action: {
        action: "reply",
        message: "Actually increase budget and add ryokan stay.",
      },
    },
    deps,
  );

  assert.equal(outcome.type, "SUCCESS");
  assert.equal(reserved, true);
  assert.equal(persistedStatus, "READY_TO_GENERATE");
  assert.equal(generationStarted, false);
}

async function plainConfirmationStartsGeneration() {
  const session = createSession({
    status: "READY_TO_GENERATE",
    clarificationMessages: [
      {
        role: "assistant",
        content: "Ready to generate?",
      },
    ],
  });

  let generationCalls = 0;
  const generatedSession = createSession({
    ...session,
    status: "GENERATING",
    generationAttempts: 1,
  });

  const deps = createDeps({
    recoverStalePlanningSessionGeneration: async () => session,
    reservePlanningSessionConfirmationRevisionAiTurn: async () =>
      createSession({
        ...session,
        confirmationRevisionAiTurns: 1,
      }),
    generateClarificationTurn: async () => ({
      assistantMessage: "Great, starting your itinerary generation now.",
      planningBrief: canonicalBrief,
      readiness: "CONFIRMED",
      missingInformation: [],
    }),
    updatePlanningSessionClarification: async (input) =>
      createSession({
        ...session,
        clarificationMessages: input.clarificationMessages,
        planningBrief: input.planningBrief,
        status: input.status,
      }),
    startPlanningSessionGeneration: async () => {
      generationCalls += 1;
      return generatedSession;
    },
  });

  const outcome = await runClarificationWorkflow(
    {
      sessionId: session.id,
      action: {
        action: "reply",
        message: "Yes, generate my trip.",
      },
    },
    deps,
  );

  assert.equal(outcome.type, "SUCCESS");
  assert.equal(generationCalls, 1);
  if (outcome.type === "SUCCESS") {
    assert.equal(outcome.session.status, "GENERATING");
  }
}

async function limitsPreserveOutcomes() {
  const assistantLimitSession = createSession({
    status: "CLARIFYING",
    confirmationRevisionAiTurns: 0,
    clarificationMessages: Array.from({ length: 12 }, () => ({
      role: "assistant" as const,
      content: "question",
    })),
  });

  const assistantLimitDeps = createDeps({
    recoverStalePlanningSessionGeneration: async () => assistantLimitSession,
  });

  const assistantLimitOutcome = await runClarificationWorkflow(
    {
      sessionId: assistantLimitSession.id,
      action: {
        action: "reply",
        message: "answer",
      },
    },
    assistantLimitDeps,
  );

  assert.equal(assistantLimitOutcome.type, "USAGE_LIMIT_ASSISTANT_TURNS");

  const confirmationLimitSession = createSession({
    status: "READY_TO_GENERATE",
    confirmationRevisionAiTurns: 3,
    clarificationMessages: [
      {
        role: "assistant",
        content: "Ready to generate?",
      },
    ],
  });

  const confirmationLimitDeps = createDeps({
    recoverStalePlanningSessionGeneration: async () => confirmationLimitSession,
  });

  const confirmationLimitOutcome = await runClarificationWorkflow(
    {
      sessionId: confirmationLimitSession.id,
      action: {
        action: "reply",
        message: "One more change please",
      },
    },
    confirmationLimitDeps,
  );

  assert.equal(
    confirmationLimitOutcome.type,
    "USAGE_LIMIT_CONFIRMATION_REVISION",
  );
}

async function providerFailureDoesNotPersistPartialTurn() {
  const session = createSession({
    status: "CLARIFYING",
    confirmationRevisionAiTurns: 0,
    clarificationMessages: [],
  });

  let updateCalls = 0;

  const deps = createDeps({
    recoverStalePlanningSessionGeneration: async () => session,
    generateClarificationTurn: async () => {
      throw new AiProviderError({
        code: "PROVIDER_REQUEST_FAILURE",
        message: "Provider unavailable",
      });
    },
    updatePlanningSessionClarification: async () => {
      updateCalls += 1;
      throw new Error("update should not run on provider failure");
    },
  });

  await assert.rejects(
    runClarificationWorkflow(
      {
        sessionId: session.id,
        action: {
          action: "reply",
          message: "reply",
        },
      },
      deps,
    ),
    (error: unknown) => error instanceof AiProviderError,
  );

  assert.equal(updateCalls, 0);
}

async function optimisticConcurrencyConflictBubbles() {
  const session = createSession({
    status: "CLARIFYING",
    clarificationMessages: [
      {
        role: "assistant",
        content: "question",
      },
    ],
  });

  const deps = createDeps({
    recoverStalePlanningSessionGeneration: async () => session,
    generateClarificationTurn: async () => ({
      assistantMessage: "answer",
      planningBrief: canonicalBrief,
      readiness: "NEEDS_CLARIFICATION",
      missingInformation: [],
    }),
    updatePlanningSessionClarification: async () => {
      throw new PlanningSessionConcurrencyError("Planning session changed.");
    },
  });

  await assert.rejects(
    runClarificationWorkflow(
      {
        sessionId: session.id,
        action: {
          action: "reply",
          message: "reply",
        },
      },
      deps,
    ),
    (error: unknown) => error instanceof PlanningSessionConcurrencyError,
  );
}

async function run() {
  await repeatedStartIsIdempotent();
  await replyPersistsCompleteTurn();
  await revisedConfirmationStaysInConfirmation();
  await plainConfirmationStartsGeneration();
  await limitsPreserveOutcomes();
  await providerFailureDoesNotPersistPartialTurn();
  await optimisticConcurrencyConflictBubbles();

  console.log("clarification-workflow-regression: pass");
}

run();
