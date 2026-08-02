import assert from "node:assert/strict";

import {
  applyGenerationPollFailure,
  applyGenerationPollSuccess,
  createInitialGenerationPollingPolicyState,
  GENERATION_POLL_BASE_INTERVAL_MS,
  GENERATION_POLL_FAILURE_PAUSE_THRESHOLD,
  GENERATION_POLL_PAUSED_NOTICE,
  getGenerationPollDelayMs,
  reconcileGenerationSessionState,
  resetGenerationPollingPolicyState,
  shouldContinueGenerationPolling,
  type PlanningSessionGenerationControllerSessionState,
} from "@/lib/planning-sessions/generation-controller";
import type { PlanningSessionGenerationApiSession } from "@/lib/planning-sessions/client-api";

function createSessionState(
  status: PlanningSessionGenerationControllerSessionState["status"],
): PlanningSessionGenerationControllerSessionState {
  return {
    status,
    clarificationMessages: [],
    planningBrief: null,
    generationPhase: null,
    generatedItinerary: null,
    generationAttempts: 0,
    generationError: null,
  };
}

function createGenerationApiState(
  status: PlanningSessionGenerationApiSession["status"],
): PlanningSessionGenerationApiSession {
  return {
    status,
    planningBrief: null,
    generationPhase: status === "GENERATING" ? "GENERATING_ITINERARY" : null,
    generatedItinerary:
      status === "GENERATED"
        ? {
            title: "Kyoto getaway",
            summary: "Five-day sample plan",
            days: [
              {
                id: "day-1",
                dayNumber: 1,
                dayLabel: "Day 1",
                summary: null,
                items: [
                  {
                    id: "item-1",
                    order: 0,
                    type: "PLACE",
                    title: "Fushimi Inari",
                    description: "Morning visit",
                    planningText: "Start early to avoid crowds",
                    suggestedTime: "08:00",
                    suggestedDurationMinutes: 120,
                  },
                ],
              },
            ],
          }
        : null,
    generationAttempts: status === "READY_TO_GENERATE" ? 0 : 1,
    generationError:
      status === "FAILED"
        ? "Generation failed. Please retry generation."
        : null,
  };
}

function testTransientFailureBackoffAndSuccessReset() {
  let policy = createInitialGenerationPollingPolicyState();

  assert.equal(getGenerationPollDelayMs(policy.consecutivePollFailures), GENERATION_POLL_BASE_INTERVAL_MS);

  policy = applyGenerationPollFailure(policy);
  assert.equal(policy.consecutivePollFailures, 1);
  assert.equal(getGenerationPollDelayMs(policy.consecutivePollFailures), GENERATION_POLL_BASE_INTERVAL_MS);

  policy = applyGenerationPollFailure(policy);
  assert.equal(policy.consecutivePollFailures, 2);
  assert.equal(getGenerationPollDelayMs(policy.consecutivePollFailures), GENERATION_POLL_BASE_INTERVAL_MS * 2);

  policy = applyGenerationPollSuccess(policy, "GENERATING");
  assert.equal(policy.consecutivePollFailures, 0);
  assert.equal(policy.generatingPollCycle, 1);
  assert.equal(policy.isPollingPaused, false);
  assert.equal(policy.generationPollingNotice, null);
}

function testPauseAtThresholdAndManualRecoveryReset() {
  let policy = createInitialGenerationPollingPolicyState();

  for (let index = 0; index < GENERATION_POLL_FAILURE_PAUSE_THRESHOLD; index += 1) {
    policy = applyGenerationPollFailure(policy);
  }

  assert.equal(policy.isPollingPaused, true);
  assert.equal(policy.generationPollingNotice, GENERATION_POLL_PAUSED_NOTICE);
  assert.equal(shouldContinueGenerationPolling("GENERATING", policy), false);

  policy = resetGenerationPollingPolicyState();
  assert.equal(policy.consecutivePollFailures, 0);
  assert.equal(policy.isPollingPaused, false);
  assert.equal(policy.generationPollingNotice, null);
  assert.equal(shouldContinueGenerationPolling("GENERATING", policy), true);
}

function testCompletionAndFailureStopPollingWithServerAuthority() {
  const previous = createSessionState("GENERATING");

  const generated = reconcileGenerationSessionState(
    previous,
    createGenerationApiState("GENERATED"),
  );

  assert.equal(generated.status, "GENERATED");
  assert.ok(generated.generatedItinerary);
  assert.equal(generated.generationError, null);

  const failed = reconcileGenerationSessionState(
    createSessionState("GENERATING"),
    createGenerationApiState("FAILED"),
  );

  assert.equal(failed.status, "FAILED");
  assert.equal(failed.generationError, "Generation failed. Please retry generation.");
  assert.equal(failed.generatedItinerary, null);

  const pollingAfterGenerated = applyGenerationPollSuccess(
    createInitialGenerationPollingPolicyState(),
    "GENERATED",
  );
  const pollingAfterFailed = applyGenerationPollSuccess(
    createInitialGenerationPollingPolicyState(),
    "FAILED",
  );

  assert.equal(shouldContinueGenerationPolling("GENERATED", pollingAfterGenerated), false);
  assert.equal(shouldContinueGenerationPolling("FAILED", pollingAfterFailed), false);
}

function testGeneratingReconciliationClearsCompetingItineraryState() {
  const previous = {
    ...createSessionState("GENERATED"),
    generatedItinerary: createGenerationApiState("GENERATED").generatedItinerary,
  };

  const serverGenerating = createGenerationApiState("GENERATING");
  const reconciled = reconcileGenerationSessionState(previous, serverGenerating);

  assert.equal(reconciled.status, "GENERATING");
  assert.equal(reconciled.generatedItinerary, null);
  assert.equal(reconciled.generationPhase, "GENERATING_ITINERARY");
}

function run() {
  testTransientFailureBackoffAndSuccessReset();
  testPauseAtThresholdAndManualRecoveryReset();
  testCompletionAndFailureStopPollingWithServerAuthority();
  testGeneratingReconciliationClearsCompetingItineraryState();

  console.log("generation-controller-regression: pass");
}

run();
