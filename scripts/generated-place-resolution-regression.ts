import assert from "node:assert/strict";

import {
  isDisplayNameCompatibleWithQuery,
  isValidGooglePlaceCoordinates,
  parseGooglePlacesServerConfig,
  searchGooglePlaceByText,
} from "@/lib/maps/google-places-server";
import {
  deriveCoordinatesExpireAt,
  derivePlaceSearchQueryForGeneratedItem,
  resolveGeneratedItineraryPlaces,
} from "@/lib/planning-sessions/generated-place-resolution";
import { parsePersistedItinerary, type PersistedItinerary } from "@/lib/planning-sessions/types";

const originalFetch = globalThis.fetch;
const originalPlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;

function createFixtureItinerary(): PersistedItinerary {
  const parsed = parsePersistedItinerary({
    title: "Tokyo test",
    summary: "Testing place resolution",
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
            title: "Senso-ji",
            description: "Temple visit",
            planningText: "Visit temple",
            placeSearchQuery: "Senso-ji Temple Tokyo",
            suggestedTime: "09:00",
            suggestedDurationMinutes: 90,
          },
          {
            id: "item-2",
            order: 1,
            type: "FOOD",
            title: "Lunch",
            description: "Generic lunch",
            planningText: "Eat nearby",
            placeSearchQuery: "lunch in asakusa",
            suggestedTime: "12:00",
            suggestedDurationMinutes: 60,
          },
          {
            id: "item-3",
            order: 2,
            type: "TRANSPORT",
            title: "Transfer",
            description: "Generic transfer",
            planningText: "Move to next district",
            placeSearchQuery: "metro transfer",
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
          {
            id: "item-4",
            order: 3,
            type: "NOTE",
            title: "Packing note",
            description: "Carry umbrella",
            planningText: "Bring umbrella",
            placeSearchQuery: "Tokyo Station",
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
        ],
      },
    ],
  });

  if (!parsed) {
    throw new Error("Fixture itinerary should parse");
  }

  return parsed;
}

async function testProviderBoundary() {
  assert.equal(parseGooglePlacesServerConfig({ GOOGLE_PLACES_API_KEY: undefined }), null);
  assert.equal(isValidGooglePlaceCoordinates(35.6, 139.7), true);
  assert.equal(isValidGooglePlaceCoordinates(99, 139.7), false);
  assert.equal(
    isDisplayNameCompatibleWithQuery("Senso-ji Temple Tokyo", "Senso-ji Temple"),
    true,
  );

  delete process.env.GOOGLE_PLACES_API_KEY;
  const missingCredentialResult = await searchGooglePlaceByText({ query: "Tokyo Station" });
  assert.deepEqual(missingCredentialResult, {
    kind: "FAILED",
    reason: "CONFIGURATION",
    providerWide: true,
  });

  process.env.GOOGLE_PLACES_API_KEY = "test-key";

  globalThis.fetch = async () => {
    return new Response("{}", { status: 500 });
  };
  const rejectedResult = await searchGooglePlaceByText({ query: "Tokyo Station" });
  assert.equal(rejectedResult.kind, "FAILED");

  globalThis.fetch = async () => {
    return new Response("not json", { status: 200 });
  };
  const malformedResult = await searchGooglePlaceByText({ query: "Tokyo Station" });
  assert.deepEqual(malformedResult, {
    kind: "FAILED",
    reason: "MALFORMED_RESPONSE",
    providerWide: false,
  });

  globalThis.fetch = async () => {
    return new Response(JSON.stringify({ places: [] }), { status: 200 });
  };
  const emptyResult = await searchGooglePlaceByText({ query: "Tokyo Station" });
  assert.deepEqual(emptyResult, { kind: "NO_RESULT" });

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        places: [
          {
            id: "places/xyz",
            displayName: { text: "Tokyo Station" },
            location: { latitude: 999, longitude: 139.7671 },
          },
        ],
      }),
      { status: 200 },
    );
  };
  const invalidCoordinateResult = await searchGooglePlaceByText({ query: "Tokyo Station" });
  assert.deepEqual(invalidCoordinateResult, { kind: "INVALID_RESULT" });

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        places: [
          {
            id: "places/abc",
            displayName: { text: "Tokyo Station" },
            location: { latitude: 35.6812, longitude: 139.7671 },
          },
        ],
      }),
      { status: 200 },
    );
  };
  const verifiedResult = await searchGooglePlaceByText({ query: "Tokyo Station" });
  assert.deepEqual(verifiedResult, {
    kind: "VERIFIED",
    placeId: "places/abc",
    latitude: 35.6812,
    longitude: 139.7671,
  });
}

async function testResolutionWorkflow() {
  const itinerary = createFixtureItinerary();

  assert.equal(
    derivePlaceSearchQueryForGeneratedItem({
      type: "PLACE",
      placeSearchQuery: "Senso-ji Temple Tokyo",
    }),
    "Senso-ji Temple Tokyo",
  );
  assert.equal(
    derivePlaceSearchQueryForGeneratedItem({
      type: "FOOD",
      placeSearchQuery: "lunch in asakusa",
    }),
    null,
  );
  assert.equal(
    derivePlaceSearchQueryForGeneratedItem({
      type: "NOTE",
      placeSearchQuery: "Tokyo Station",
    }),
    null,
  );

  let active = 0;
  let maxActive = 0;
  const queries: string[] = [];
  const now = new Date("2031-06-01T12:00:00.000Z");
  const sessionExpiresAt = new Date("2031-06-20T00:00:00.000Z");

  const result = await resolveGeneratedItineraryPlaces({
    itinerary,
    sessionExpiresAt,
    now,
    maxRequests: 1,
    concurrency: 3,
    resolveQuery: async (query) => {
      queries.push(query);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;

      if (query.includes("Senso-ji")) {
        return {
          kind: "VERIFIED" as const,
          placeId: "places/sensoji",
          latitude: 35.7148,
          longitude: 139.7967,
        };
      }

      return { kind: "NO_RESULT" as const };
    },
  });

  assert.equal(maxActive <= 3, true);
  assert.equal(result.summary.attempted, 1);
  assert.equal(result.summary.verified, 1);
  assert.equal(result.summary.failed, 0);
  assert.equal(result.summary.unverified, 0);
  assert.equal(result.summary.skipped >= 3, true);
  assert.deepEqual(queries, ["Senso-ji Temple Tokyo"]);

  const firstItem = result.itinerary.days[0]!.items[0]!;
  assert.equal(firstItem.placeReference?.provider, "GOOGLE");
  assert.equal(firstItem.placeReference?.placeId, "places/sensoji");

  const expireAt = deriveCoordinatesExpireAt({ now, sessionExpiresAt });
  assert.equal(firstItem.placeReference?.coordinatesExpireAt, expireAt.toISOString());

  const preservedOrder = result.itinerary.days[0]!.items.map((item) => item.id);
  assert.deepEqual(preservedOrder, ["item-1", "item-2", "item-3", "item-4"]);
}

async function testProviderWideFailureStop() {
  const itinerary = createFixtureItinerary();
  itinerary.days[0]!.items[1]!.placeSearchQuery = "Tokyo Station";

  let calls = 0;

  const result = await resolveGeneratedItineraryPlaces({
    itinerary,
    sessionExpiresAt: new Date("2031-06-20T00:00:00.000Z"),
    concurrency: 1,
    resolveQuery: async () => {
      calls += 1;
      return {
        kind: "FAILED" as const,
        providerWide: true,
      };
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.summary.failed, 1);
}

function testLegacyItineraryParsing() {
  const parsed = parsePersistedItinerary({
    title: "Legacy",
    summary: "No place fields",
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
            type: "ACTIVITY",
            title: "Walking tour",
            description: "Walk the district",
            planningText: "Explore",
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
        ],
      },
    ],
  });

  if (!parsed) {
    throw new Error("Legacy itinerary should parse");
  }

  const item = parsed.days[0]!.items[0]!;
  assert.equal(item.placeSearchQuery, null);
  assert.equal(item.placeReference, null);
}

async function run() {
  try {
    await testProviderBoundary();
    await testResolutionWorkflow();
    await testProviderWideFailureStop();
    testLegacyItineraryParsing();

    console.log("generated-place-resolution-regression: pass");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalPlacesApiKey === undefined) {
      delete process.env.GOOGLE_PLACES_API_KEY;
    } else {
      process.env.GOOGLE_PLACES_API_KEY = originalPlacesApiKey;
    }
  }
}

void run();
