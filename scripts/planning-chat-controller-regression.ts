import assert from "node:assert/strict";

import type { PlanningSessionClarificationApiSession } from "@/lib/planning-sessions/client-api";
import {
  buildPlanningChatMessageViewModels,
  createPlanningChatSubmitLock,
  isPlanningChatComposerDisabled,
  performPlanningChatReply,
  shouldAutoStartPlanningChat,
  shouldShowPlanningChatStartRetry,
} from "@/lib/planning-sessions/planning-chat-controller";
import type { PlanningSessionClarificationMessages } from "@/lib/planning-sessions/types";

function createSessionPayload(
  status: PlanningSessionClarificationApiSession["status"],
): PlanningSessionClarificationApiSession {
  return {
    status,
    clarificationMessages: [
      { role: "assistant", content: "Great, tell me your dates." },
    ],
    planningBrief: null,
    generationPhase: null,
    generatedItinerary: null,
    generationAttempts: 0,
    generationError: null,
  };
}

async function autoStartAndViewModelChecks() {
  assert.equal(
    shouldAutoStartPlanningChat({
      didAutoStart: false,
      status: "CLARIFYING",
      hasAssistantMessage: false,
    }),
    true,
  );
  assert.equal(
    shouldAutoStartPlanningChat({
      didAutoStart: true,
      status: "CLARIFYING",
      hasAssistantMessage: false,
    }),
    false,
  );
  assert.equal(
    shouldAutoStartPlanningChat({
      didAutoStart: false,
      status: "CLARIFYING",
      hasAssistantMessage: true,
    }),
    false,
  );

  const persisted: PlanningSessionClarificationMessages = [
    { role: "assistant", content: "Where do you want to go?" },
    { role: "user", content: "Kyoto" },
  ];

  const viewModels = buildPlanningChatMessageViewModels("Plan a Japan trip", persisted);
  assert.equal(viewModels.length, 3);
  assert.equal(viewModels[0]?.content, "Plan a Japan trip");
  assert.equal(viewModels[1]?.role, "assistant");
  assert.equal(viewModels[2]?.role, "user");
}

async function statusDisablingChecks() {
  assert.equal(
    isPlanningChatComposerDisabled({
      status: "CLARIFYING",
      isStarting: false,
      isSubmittingReply: false,
    }),
    false,
  );
  assert.equal(
    isPlanningChatComposerDisabled({
      status: "READY_TO_GENERATE",
      isStarting: false,
      isSubmittingReply: false,
    }),
    false,
  );

  for (const status of ["GENERATING", "GENERATED", "FAILED"] as const) {
    assert.equal(
      isPlanningChatComposerDisabled({
        status,
        isStarting: false,
        isSubmittingReply: false,
      }),
      true,
    );
  }

  assert.equal(
    shouldShowPlanningChatStartRetry({
      status: "CLARIFYING",
      hasAssistantMessage: false,
      isStarting: false,
    }),
    true,
  );
  assert.equal(
    shouldShowPlanningChatStartRetry({
      status: "CLARIFYING",
      hasAssistantMessage: true,
      isStarting: false,
    }),
    false,
  );
}

async function replySuccessFailureRetryAndDuplicateChecks() {
  let draftMessage = "  Tokyo in April  ";
  let errorMessage: string | null = null;
  let submitting = false;
  let sessionUpdates = 0;
  const sentMessages: string[] = [];

  const lock = createPlanningChatSubmitLock();

  const success = await performPlanningChatReply({
    sessionId: "session-1",
    draftMessage,
    isComposerDisabled: false,
    submitLock: lock,
    requestReply: async (_sessionId, message) => {
      sentMessages.push(message);
      return createSessionPayload("CLARIFYING");
    },
    onStart: () => {
      errorMessage = null;
      submitting = true;
    },
    onSuccess: () => {
      draftMessage = "";
      sessionUpdates += 1;
    },
    onError: (message) => {
      errorMessage = message;
    },
    onFinish: () => {
      submitting = false;
    },
  });

  assert.equal(success, true);
  assert.deepEqual(sentMessages, ["Tokyo in April"]);
  assert.equal(draftMessage, "");
  assert.equal(errorMessage, null);
  assert.equal(submitting, false);
  assert.equal(sessionUpdates, 1);

  let attempts = 0;
  const failed = await performPlanningChatReply({
    sessionId: "session-2",
    draftMessage: "Need vegetarian options",
    isComposerDisabled: false,
    submitLock: lock,
    requestReply: async () => {
      attempts += 1;
      throw new Error("Temporary outage");
    },
    onStart: () => {
      submitting = true;
      errorMessage = null;
    },
    onSuccess: () => {
      sessionUpdates += 1;
    },
    onError: (message) => {
      errorMessage = message;
    },
    onFinish: () => {
      submitting = false;
    },
  });

  assert.equal(failed, false);
  assert.equal(attempts, 1);
  assert.equal(errorMessage, "Temporary outage");
  assert.equal(submitting, false);

  const retried = await performPlanningChatReply({
    sessionId: "session-2",
    draftMessage: "Need vegetarian options",
    isComposerDisabled: false,
    submitLock: lock,
    requestReply: async () => {
      attempts += 1;
      return createSessionPayload("READY_TO_GENERATE");
    },
    onStart: () => {
      submitting = true;
      errorMessage = null;
    },
    onSuccess: () => {
      sessionUpdates += 1;
      draftMessage = "";
    },
    onError: (message) => {
      errorMessage = message;
    },
    onFinish: () => {
      submitting = false;
    },
  });

  assert.equal(retried, true);
  assert.equal(attempts, 2);
  assert.equal(errorMessage, null);

  const sharedLock = createPlanningChatSubmitLock();
  let sharedRequests = 0;
  let resolveShared!: (value: PlanningSessionClarificationApiSession) => void;
  const sharedPendingReply = new Promise<PlanningSessionClarificationApiSession>(
    (resolve) => {
      resolveShared = resolve;
    },
  );

  const sharedFirst = performPlanningChatReply({
    sessionId: "session-4",
    draftMessage: "first",
    isComposerDisabled: false,
    submitLock: sharedLock,
    requestReply: async () => {
      sharedRequests += 1;
      return await sharedPendingReply;
    },
    onStart: () => {
      submitting = true;
    },
    onSuccess: () => {
      sessionUpdates += 1;
    },
    onError: () => {
      errorMessage = "unexpected";
    },
    onFinish: () => {
      submitting = false;
    },
  });

  const sharedSecond = await performPlanningChatReply({
    sessionId: "session-4",
    draftMessage: "second",
    isComposerDisabled: false,
    submitLock: sharedLock,
    requestReply: async () => {
      sharedRequests += 1;
      return createSessionPayload("CLARIFYING");
    },
    onStart: () => {
      submitting = true;
    },
    onSuccess: () => {
      sessionUpdates += 1;
    },
    onError: () => {
      errorMessage = "unexpected";
    },
    onFinish: () => {
      submitting = false;
    },
  });

  assert.equal(sharedSecond, false);
  assert.equal(sharedRequests, 1);

  resolveShared(createSessionPayload("CLARIFYING"));
  assert.equal(await sharedFirst, true);
}

async function run() {
  await autoStartAndViewModelChecks();
  await statusDisablingChecks();
  await replySuccessFailureRetryAndDuplicateChecks();

  console.log("planning-chat-controller-regression: pass");
}

run();
