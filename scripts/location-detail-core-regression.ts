import assert from "node:assert/strict";

import {
  getPlanningSessionLocationDetailWithDependencies,
} from "@/lib/planning-sessions/location-detail-operation";
import { parsePersistedItinerary } from "@/lib/planning-sessions/types";

class PlanningSessionUsageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningSessionUsageLimitError";
  }
}

class PlanningSessionInvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningSessionInvalidStateError";
  }
}

const BASE_EXPIRES_AT = new Date("2032-01-01T00:00:00.000Z");

function createGeneratedSession() {
  const itinerary = parsePersistedItinerary({
    title: "Tokyo",
    summary: "Test",
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        dayLabel: "Day 1",
        summary: null,
        items: [
          {
            id: "item-place",
            order: 0,
            type: "PLACE",
            title: "Tokyo Station",
            description: "Historic station",
            planningText: "Station",
            placeSearchQuery: "Tokyo Station",
            placeReference: {
              provider: "GOOGLE",
              placeId: "places/tokyo-station",
              latitude: 35.6812,
              longitude: 139.7671,
              coordinatesCachedAt: "2031-12-01T00:00:00.000Z",
              coordinatesExpireAt: "2032-02-01T00:00:00.000Z",
            },
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
          {
            id: "item-note",
            order: 1,
            type: "NOTE",
            title: "Pack umbrella",
            description: "Bring umbrella",
            planningText: "Umbrella",
            placeSearchQuery: null,
            placeReference: null,
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
        ],
      },
    ],
  });

  if (!itinerary) {
    throw new Error("fixture parse failed");
  }

  return {
    id: "session-1",
    initialPrompt: "Tokyo",
    clarificationMessages: [],
    planningBrief: null,
    generatedItinerary: itinerary,
    generationPhase: null,
    generationAttempts: 1,
    confirmationRevisionAiTurns: 0,
    locationDetailAttempts: 0,
    generationError: null,
    status: "GENERATED" as const,
    expiresAt: BASE_EXPIRES_AT,
    updatedAt: BASE_EXPIRES_AT,
  };
}

async function testSuccessAndOptionalFields() {
  const logs: unknown[] = [];

  const result = await getPlanningSessionLocationDetailWithDependencies(
    {
      sessionId: "session-1",
      itemId: "item-place",
    },
    {
      findSessionById: async () => createGeneratedSession(),
      isSessionExpired: () => false,
      reserveAttempt: async () => ({ locationDetailAttempts: 1 }),
      getProviderAvailability: () => ({ ok: true }),
      getPlaceDetails: async () => ({
        kind: "SUCCESS",
        placeId: "places/tokyo-station",
        displayName: "Tokyo Station",
        primaryTypeDisplayName: null,
        formattedAddress: null,
        googleMapsUri: null,
      }),
      maxAttempts: 60,
      logOutcome: (payload) => {
        logs.push(payload);
      },
    },
  );

  assert.deepEqual(result, {
    kind: "SUCCESS",
    detail: {
      itemId: "item-place",
      displayName: "Tokyo Station",
      primaryTypeDisplayName: null,
      formattedAddress: null,
      googleMapsUri: null,
    },
  });

  assert.equal(logs.length, 1);
}

async function testValidationAndStateGuards() {
  const missingSession = await getPlanningSessionLocationDetailWithDependencies(
    {
      sessionId: "missing",
      itemId: "item-place",
    },
    {
      findSessionById: async () => null,
      isSessionExpired: () => false,
      reserveAttempt: async () => ({ locationDetailAttempts: 1 }),
      getProviderAvailability: () => ({ ok: true }),
      getPlaceDetails: async () => ({
        kind: "SUCCESS",
        placeId: "places/tokyo-station",
        displayName: "Tokyo Station",
        primaryTypeDisplayName: null,
        formattedAddress: null,
        googleMapsUri: null,
      }),
      maxAttempts: 60,
      logOutcome: () => {},
    },
  );

  assert.deepEqual(missingSession, { kind: "NOT_FOUND" });

  const expiredSession = await getPlanningSessionLocationDetailWithDependencies(
    {
      sessionId: "session-1",
      itemId: "item-place",
    },
    {
      findSessionById: async () => createGeneratedSession(),
      isSessionExpired: () => true,
      reserveAttempt: async () => ({ locationDetailAttempts: 1 }),
      getProviderAvailability: () => ({ ok: true }),
      getPlaceDetails: async () => ({
        kind: "SUCCESS",
        placeId: "places/tokyo-station",
        displayName: "Tokyo Station",
        primaryTypeDisplayName: null,
        formattedAddress: null,
        googleMapsUri: null,
      }),
      maxAttempts: 60,
      logOutcome: () => {},
    },
  );

  assert.deepEqual(expiredSession, { kind: "EXPIRED" });

  const missingItem = await getPlanningSessionLocationDetailWithDependencies(
    {
      sessionId: "session-1",
      itemId: "missing-item",
    },
    {
      findSessionById: async () => createGeneratedSession(),
      isSessionExpired: () => false,
      reserveAttempt: async () => ({ locationDetailAttempts: 1 }),
      getProviderAvailability: () => ({ ok: true }),
      getPlaceDetails: async () => ({
        kind: "SUCCESS",
        placeId: "places/tokyo-station",
        displayName: "Tokyo Station",
        primaryTypeDisplayName: null,
        formattedAddress: null,
        googleMapsUri: null,
      }),
      maxAttempts: 60,
      logOutcome: () => {},
    },
  );

  assert.deepEqual(missingItem, {
    kind: "UNAVAILABLE",
    reason: "MISSING_ITEM",
  });

  const missingReference = await getPlanningSessionLocationDetailWithDependencies(
    {
      sessionId: "session-1",
      itemId: "item-note",
    },
    {
      findSessionById: async () => createGeneratedSession(),
      isSessionExpired: () => false,
      reserveAttempt: async () => ({ locationDetailAttempts: 1 }),
      getProviderAvailability: () => ({ ok: true }),
      getPlaceDetails: async () => ({
        kind: "SUCCESS",
        placeId: "places/tokyo-station",
        displayName: "Tokyo Station",
        primaryTypeDisplayName: null,
        formattedAddress: null,
        googleMapsUri: null,
      }),
      maxAttempts: 60,
      logOutcome: () => {},
    },
  );

  assert.deepEqual(missingReference, {
    kind: "UNAVAILABLE",
    reason: "MISSING_PLACE_REFERENCE",
  });
}

async function testUsageLimitAndProviderFailureMapping() {
  const limitExceeded = await getPlanningSessionLocationDetailWithDependencies(
    {
      sessionId: "session-1",
      itemId: "item-place",
    },
    {
      findSessionById: async () => createGeneratedSession(),
      isSessionExpired: () => false,
      reserveAttempt: async () => {
        throw new PlanningSessionUsageLimitError("limit");
      },
      getProviderAvailability: () => ({ ok: true }),
      getPlaceDetails: async () => ({
        kind: "SUCCESS",
        placeId: "places/tokyo-station",
        displayName: "Tokyo Station",
        primaryTypeDisplayName: null,
        formattedAddress: null,
        googleMapsUri: null,
      }),
      maxAttempts: 60,
      logOutcome: () => {},
    },
  );

  assert.deepEqual(limitExceeded, { kind: "LIMIT_EXCEEDED" });

  const invalidState = await getPlanningSessionLocationDetailWithDependencies(
    {
      sessionId: "session-1",
      itemId: "item-place",
    },
    {
      findSessionById: async () => createGeneratedSession(),
      isSessionExpired: () => false,
      reserveAttempt: async () => {
        throw new PlanningSessionInvalidStateError("state");
      },
      getProviderAvailability: () => ({ ok: true }),
      getPlaceDetails: async () => ({
        kind: "SUCCESS",
        placeId: "places/tokyo-station",
        displayName: "Tokyo Station",
        primaryTypeDisplayName: null,
        formattedAddress: null,
        googleMapsUri: null,
      }),
      maxAttempts: 60,
      logOutcome: () => {},
    },
  );

  assert.deepEqual(invalidState, {
    kind: "UNAVAILABLE",
    reason: "INVALID_STATE",
  });

  const providerFailure = await getPlanningSessionLocationDetailWithDependencies(
    {
      sessionId: "session-1",
      itemId: "item-place",
    },
    {
      findSessionById: async () => createGeneratedSession(),
      isSessionExpired: () => false,
      reserveAttempt: async () => ({ locationDetailAttempts: 2 }),
      getProviderAvailability: () => ({ ok: true }),
      getPlaceDetails: async () => ({
        kind: "FAILED",
        reason: "REQUEST",
        retryable: true,
        providerWide: false,
      }),
      maxAttempts: 60,
      logOutcome: () => {},
    },
  );

  assert.deepEqual(providerFailure, {
    kind: "PROVIDER_FAILURE",
    reason: "REQUEST",
    retryable: true,
  });
}

async function testNoProviderCallForInvalidStates() {
  let called = false;

  await getPlanningSessionLocationDetailWithDependencies(
    {
      sessionId: "session-1",
      itemId: "item-note",
    },
    {
      findSessionById: async () => createGeneratedSession(),
      isSessionExpired: () => false,
      reserveAttempt: async () => ({ locationDetailAttempts: 1 }),
      getProviderAvailability: () => ({ ok: true }),
      getPlaceDetails: async () => {
        called = true;
        return {
          kind: "SUCCESS",
          placeId: "places/tokyo-station",
          displayName: "Tokyo Station",
          primaryTypeDisplayName: null,
          formattedAddress: null,
          googleMapsUri: null,
        };
      },
      maxAttempts: 60,
      logOutcome: () => {},
    },
  );

  assert.equal(called, false);
}

async function run() {
  await testSuccessAndOptionalFields();
  await testValidationAndStateGuards();
  await testUsageLimitAndProviderFailureMapping();
  await testNoProviderCallForInvalidStates();

  console.log("location-detail-core-regression: pass");
}

void run();
