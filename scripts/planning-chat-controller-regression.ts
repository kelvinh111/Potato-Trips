import assert from "node:assert/strict";

import type { PlanningSessionClarificationApiSession } from "@/lib/planning-sessions/client-api";
import {
  buildPlanningChatConversationMessages,
  buildPlanningChatMessageViewModels,
  createPlanningChatStartLock,
  createPlanningChatSubmitLock,
  isPlanningChatComposerDisabled,
  performPlanningChatStart,
  performPlanningChatReply,
  runPlanningChatAutoStart,
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

  const withPending = buildPlanningChatConversationMessages(
    "Plan a Japan trip",
    persisted,
    { message: "Please include Nara" },
  );

  assert.equal(withPending.length, 5);
  assert.equal(withPending[3]?.role, "user");
  assert.equal(withPending[3]?.content, "Please include Nara");
  assert.equal(withPending[4]?.role, "assistant");
  assert.equal(withPending[4]?.content, "Thinking...");
}

async function autoStartSchedulingAndStartRequestChecks() {
  const scheduledCallbacks: Array<() => void> = [];
  const autoStartState = { didAutoStart: false };
  const startLock = createPlanningChatStartLock();

  let requestCount = 0;
  let startCount = 0;
  let finishCount = 0;
  let updateCount = 0;
  let errorMessage: string | null = null;

  const scheduled = runPlanningChatAutoStart({
    autoStartState,
    status: "CLARIFYING",
    hasAssistantMessage: false,
    scheduleAutoStart: (callback) => {
      scheduledCallbacks.push(callback);
    },
    onAutoStart: () => {
      void performPlanningChatStart({
        sessionId: "session-auto",
        startLock,
        requestStart: async () => {
          requestCount += 1;
          return createSessionPayload("CLARIFYING");
        },
        onStart: () => {
          startCount += 1;
          errorMessage = null;
        },
        onSuccess: () => {
          updateCount += 1;
        },
        onError: (message) => {
          errorMessage = message;
        },
        onFinish: () => {
          finishCount += 1;
        },
      });
    },
  });

  assert.equal(scheduled, true);
  assert.equal(scheduledCallbacks.length, 1);
  assert.equal(autoStartState.didAutoStart, true);

  const scheduledAgain = runPlanningChatAutoStart({
    autoStartState,
    status: "CLARIFYING",
    hasAssistantMessage: false,
    scheduleAutoStart: (callback) => {
      scheduledCallbacks.push(callback);
    },
    onAutoStart: () => {},
  });

  assert.equal(scheduledAgain, false);
  assert.equal(scheduledCallbacks.length, 1);

  scheduledCallbacks[0]?.();
  await Promise.resolve();

  assert.equal(requestCount, 1);
  assert.equal(startCount, 1);
  assert.equal(finishCount, 1);
  assert.equal(updateCount, 1);
  assert.equal(errorMessage, null);

  const blockedByAssistant = runPlanningChatAutoStart({
    autoStartState: { didAutoStart: false },
    status: "CLARIFYING",
    hasAssistantMessage: true,
    scheduleAutoStart: (callback) => {
      scheduledCallbacks.push(callback);
    },
    onAutoStart: () => {},
  });

  assert.equal(blockedByAssistant, false);
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
    onStart: (submittedMessage) => {
      errorMessage = null;
      submitting = true;
      draftMessage = "";
      assert.equal(submittedMessage, "Tokyo in April");
    },
    onSuccess: (_payload, submittedMessage) => {
      assert.equal(submittedMessage, "Tokyo in April");
      sessionUpdates += 1;
    },
    onError: (message, submittedMessage) => {
      errorMessage = message;
      draftMessage = submittedMessage;
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
    onStart: (submittedMessage) => {
      submitting = true;
      errorMessage = null;
      draftMessage = "";
      assert.equal(submittedMessage, "Need vegetarian options");
    },
    onSuccess: (_payload, submittedMessage) => {
      assert.equal(submittedMessage, "Need vegetarian options");
      sessionUpdates += 1;
    },
    onError: (message, submittedMessage) => {
      errorMessage = message;
      draftMessage = submittedMessage;
    },
    onFinish: () => {
      submitting = false;
    },
  });

  assert.equal(failed, false);
  assert.equal(attempts, 1);
  assert.equal(errorMessage, "Temporary outage");
  assert.equal(submitting, false);
  assert.equal(draftMessage, "Need vegetarian options");

  const retried = await performPlanningChatReply({
    sessionId: "session-2",
    draftMessage: "Need vegetarian options",
    isComposerDisabled: false,
    submitLock: lock,
    requestReply: async () => {
      attempts += 1;
      return createSessionPayload("READY_TO_GENERATE");
    },
    onStart: (submittedMessage) => {
      submitting = true;
      errorMessage = null;
      draftMessage = "";
      assert.equal(submittedMessage, "Need vegetarian options");
    },
    onSuccess: (_payload, submittedMessage) => {
      assert.equal(submittedMessage, "Need vegetarian options");
      sessionUpdates += 1;
    },
    onError: (message, submittedMessage) => {
      errorMessage = message;
      draftMessage = submittedMessage;
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

async function startSuccessFailureRetryAndDuplicateChecks() {
  const lock = createPlanningChatStartLock();
  let startCalls = 0;
  let starts = 0;
  let finishes = 0;
  let updates = 0;
  let errorMessage: string | null = null;

  const success = await performPlanningChatStart({
    sessionId: "session-start-success",
    startLock: lock,
    requestStart: async () => {
      startCalls += 1;
      return createSessionPayload("CLARIFYING");
    },
    onStart: () => {
      starts += 1;
      errorMessage = null;
    },
    onSuccess: () => {
      updates += 1;
    },
    onError: (message) => {
      errorMessage = message;
    },
    onFinish: () => {
      finishes += 1;
    },
  });

  assert.equal(success, true);
  assert.equal(startCalls, 1);
  assert.equal(starts, 1);
  assert.equal(updates, 1);
  assert.equal(finishes, 1);
  assert.equal(errorMessage, null);

  const failure = await performPlanningChatStart({
    sessionId: "session-start-failure",
    startLock: lock,
    requestStart: async () => {
      startCalls += 1;
      throw new Error("Start failed");
    },
    onStart: () => {
      starts += 1;
      errorMessage = null;
    },
    onSuccess: () => {
      updates += 1;
    },
    onError: (message) => {
      errorMessage = message;
    },
    onFinish: () => {
      finishes += 1;
    },
  });

  assert.equal(failure, false);
  assert.equal(errorMessage, "Start failed");

  const retrySuccess = await performPlanningChatStart({
    sessionId: "session-start-retry",
    startLock: lock,
    requestStart: async () => {
      startCalls += 1;
      return createSessionPayload("READY_TO_GENERATE");
    },
    onStart: () => {
      starts += 1;
      errorMessage = null;
    },
    onSuccess: () => {
      updates += 1;
    },
    onError: (message) => {
      errorMessage = message;
    },
    onFinish: () => {
      finishes += 1;
    },
  });

  assert.equal(retrySuccess, true);
  assert.equal(errorMessage, null);

  const sharedLock = createPlanningChatStartLock();
  let concurrentRequests = 0;
  let resolvePendingStart!: (value: PlanningSessionClarificationApiSession) => void;
  const pendingStart = new Promise<PlanningSessionClarificationApiSession>((resolve) => {
    resolvePendingStart = resolve;
  });

  const first = performPlanningChatStart({
    sessionId: "session-start-dup",
    startLock: sharedLock,
    requestStart: async () => {
      concurrentRequests += 1;
      return await pendingStart;
    },
    onStart: () => {
      starts += 1;
    },
    onSuccess: () => {
      updates += 1;
    },
    onError: (message) => {
      errorMessage = message;
    },
    onFinish: () => {
      finishes += 1;
    },
  });

  const second = await performPlanningChatStart({
    sessionId: "session-start-dup",
    startLock: sharedLock,
    requestStart: async () => {
      concurrentRequests += 1;
      return createSessionPayload("CLARIFYING");
    },
    onStart: () => {
      starts += 1;
    },
    onSuccess: () => {
      updates += 1;
    },
    onError: (message) => {
      errorMessage = message;
    },
    onFinish: () => {
      finishes += 1;
    },
  });

  assert.equal(second, false);
  assert.equal(concurrentRequests, 1);

  resolvePendingStart(createSessionPayload("CLARIFYING"));
  assert.equal(await first, true);
}

async function run() {
  await autoStartAndViewModelChecks();
  await autoStartSchedulingAndStartRequestChecks();
  await statusDisablingChecks();
  await startSuccessFailureRetryAndDuplicateChecks();
  await replySuccessFailureRetryAndDuplicateChecks();

  console.log("planning-chat-controller-regression: pass");
}

run();
