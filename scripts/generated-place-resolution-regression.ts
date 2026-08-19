import assert from "node:assert/strict";

import {
  getGooglePlaceDetails,
  getGooglePlacesProviderAvailability,
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
            type: "PLACE",
            title: "Tokyo Station",
            description: "Station",
            planningText: "Take train",
            placeSearchQuery: "Tokyo Station",
            suggestedTime: "11:00",
            suggestedDurationMinutes: 40,
          },
          {
            id: "item-3",
            order: 2,
            type: "LODGING",
            title: "Park Hotel",
            description: "Hotel check-in",
            planningText: "Drop bags",
            placeSearchQuery: "Park Hotel Tokyo",
            suggestedTime: "14:00",
            suggestedDurationMinutes: 30,
          },
          {
            id: "item-4",
            order: 3,
            type: "ACTIVITY",
            title: "Neighborhood walk",
            description: "Generic activity",
            planningText: "Walk around",
            placeSearchQuery: "walk around asakusa",
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
          {
            id: "item-5",
            order: 4,
            type: "NOTE",
            title: "Packing note",
            description: "Carry umbrella",
            planningText: "Bring umbrella",
            placeSearchQuery: "Tokyo Tower",
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
          {
            id: "item-6",
            order: 5,
            type: "TRANSPORT",
            title: "Transfer",
            description: "Airport transfer",
            planningText: "Move to airport",
            placeSearchQuery: "Haneda Airport",
            suggestedTime: "19:00",
            suggestedDurationMinutes: 75,
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

function snapshotItemContent(itinerary: PersistedItinerary) {
  return itinerary.days[0]!.items.map((item) => ({
    id: item.id,
    order: item.order,
    type: item.type,
    title: item.title,
    description: item.description,
    planningText: item.planningText,
    suggestedTime: item.suggestedTime,
    suggestedDurationMinutes: item.suggestedDurationMinutes,
  }));
}

async function testProviderBoundary() {
  assert.equal(parseGooglePlacesServerConfig({ GOOGLE_PLACES_API_KEY: undefined }), null);
  assert.deepEqual(getGooglePlacesProviderAvailability({ GOOGLE_PLACES_API_KEY: undefined }), {
    ok: false,
    reason: "CONFIGURATION",
    providerWide: true,
  });
  assert.equal(isValidGooglePlaceCoordinates(35.6, 139.7), true);
  assert.equal(isValidGooglePlaceCoordinates(99, 139.7), false);
  assert.equal(
    isDisplayNameCompatibleWithQuery("Senso-ji Temple Tokyo", "Senso-ji Temple"),
    true,
  );
  assert.equal(isDisplayNameCompatibleWithQuery("Tokyo", "Tokyo Station"), false);
  assert.equal(
    isDisplayNameCompatibleWithQuery("Tokyo Station Japan", "Tokyo Station"),
    true,
  );
  assert.equal(
    isDisplayNameCompatibleWithQuery("Musée du Louvre", "Louvre Museum"),
    true,
  );
  assert.equal(
    isDisplayNameCompatibleWithQuery("Jardin des Tuileries", "Tuileries Garden"),
    true,
  );
  assert.equal(
    isDisplayNameCompatibleWithQuery("Paris Opera", "Paris Aquarium"),
    false,
  );
  assert.equal(
    isDisplayNameCompatibleWithQuery("Paris Aquarium", "Paris Opera"),
    false,
  );
  assert.equal(
    isDisplayNameCompatibleWithQuery("Manchester Museum", "Manchester Art Gallery"),
    false,
  );
  assert.equal(
    isDisplayNameCompatibleWithQuery("Manchester Art Gallery", "Manchester Museum"),
    false,
  );
  assert.equal(
    isDisplayNameCompatibleWithQuery("Modern Art Museum", "Science Museum"),
    false,
  );
  assert.equal(
    isDisplayNameCompatibleWithQuery("Tokyo Garden", "Kyoto Garden"),
    false,
  );
  assert.equal(isDisplayNameCompatibleWithQuery("東京駅", "東京駅"), true);
  assert.equal(isDisplayNameCompatibleWithQuery("東京駅 Tokyo Station", "東京駅"), true);
  assert.equal(isDisplayNameCompatibleWithQuery("東京駅", "大阪駅"), false);

  delete process.env.GOOGLE_PLACES_API_KEY;
  const missingCredentialResult = await searchGooglePlaceByText({ query: "Tokyo Station" });
  assert.deepEqual(missingCredentialResult, {
    kind: "FAILED",
    reason: "CONFIGURATION",
    providerWide: true,
  });

  process.env.GOOGLE_PLACES_API_KEY = "test-key";

  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  const rejectedResult = await searchGooglePlaceByText({ query: "Tokyo Station" });
  assert.deepEqual(rejectedResult, {
    kind: "FAILED",
    reason: "REQUEST",
    providerWide: false,
  });

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

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        places: [
          {
            id: "places/tokyo-eki",
            displayName: { text: "東京駅" },
            location: { latitude: 35.6812, longitude: 139.7671 },
          },
        ],
      }),
      { status: 200 },
    );
  };
  const nonLatinVerifiedResult = await searchGooglePlaceByText({ query: "東京駅" });
  assert.deepEqual(nonLatinVerifiedResult, {
    kind: "VERIFIED",
    placeId: "places/tokyo-eki",
    latitude: 35.6812,
    longitude: 139.7671,
  });

  globalThis.fetch = (_input, init) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;

      if (!signal) {
        reject(new Error("missing abort signal"));
        return;
      }

      if (signal.aborted) {
        reject(new DOMException("aborted", "AbortError"));
        return;
      }

      signal.addEventListener(
        "abort",
        () => {
          reject(new DOMException("aborted", "AbortError"));
        },
        { once: true },
      );
    });
  };
  const timeoutResult = await searchGooglePlaceByText({
    query: "Tokyo Station",
    timeoutMs: 1,
  });
  assert.deepEqual(timeoutResult, {
    kind: "FAILED",
    reason: "REQUEST",
    providerWide: false,
  });

  globalThis.fetch = async (_input, init) => {
    return {
      ok: true,
      status: 200,
      json: () => {
        return new Promise<unknown>((_resolve, reject) => {
          const signal = init?.signal;

          if (!signal) {
            reject(new Error("missing abort signal"));
            return;
          }

          if (signal.aborted) {
            reject(new DOMException("aborted", "AbortError"));
            return;
          }

          signal.addEventListener(
            "abort",
            () => {
              reject(new DOMException("aborted", "AbortError"));
            },
            { once: true },
          );
        });
      },
    } as Response;
  };
  const stalledBodyTimeoutResult = await searchGooglePlaceByText({
    query: "Tokyo Station",
    timeoutMs: 1,
  });
  assert.deepEqual(stalledBodyTimeoutResult, {
    kind: "FAILED",
    reason: "REQUEST",
    providerWide: false,
  });
}

async function testPlaceDetailsBoundary() {
  delete process.env.GOOGLE_PLACES_API_KEY;
  const missingConfig = await getGooglePlaceDetails({ placeId: "places/test" });
  assert.deepEqual(missingConfig, {
    kind: "FAILED",
    reason: "CONFIGURATION",
    retryable: false,
    providerWide: true,
  });

  process.env.GOOGLE_PLACES_API_KEY = "test-key";

  globalThis.fetch = async () => {
    return new Response("", { status: 403 });
  };
  const authFailure = await getGooglePlaceDetails({ placeId: "places/test" });
  assert.deepEqual(authFailure, {
    kind: "FAILED",
    reason: "AUTHENTICATION",
    retryable: true,
    providerWide: true,
  });

  globalThis.fetch = async () => {
    return new Response("", { status: 404 });
  };
  const notFound = await getGooglePlaceDetails({ placeId: "places/test" });
  assert.deepEqual(notFound, {
    kind: "FAILED",
    reason: "NOT_FOUND",
    retryable: false,
    providerWide: false,
  });

  globalThis.fetch = async () => {
    return new Response("not json", { status: 200 });
  };
  const malformed = await getGooglePlaceDetails({ placeId: "places/test" });
  assert.deepEqual(malformed, {
    kind: "FAILED",
    reason: "MALFORMED_RESPONSE",
    retryable: false,
    providerWide: false,
  });

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "places/other",
        displayName: { text: "Tokyo Station" },
      }),
      { status: 200 },
    );
  };
  const mismatched = await getGooglePlaceDetails({ placeId: "places/test" });
  assert.deepEqual(mismatched, {
    kind: "FAILED",
    reason: "MISMATCHED_ID",
    retryable: false,
    providerWide: false,
  });

  globalThis.fetch = async () => {
    return new Response(
      JSON.stringify({
        id: "places/test",
        displayName: { text: "Tokyo Station" },
      }),
      { status: 200 },
    );
  };
  const successWithoutOptional = await getGooglePlaceDetails({ placeId: "places/test" });
  assert.deepEqual(successWithoutOptional, {
    kind: "SUCCESS",
    placeId: "places/test",
    displayName: "Tokyo Station",
    primaryTypeDisplayName: null,
    formattedAddress: null,
    googleMapsUri: null,
  });
}

function testQueryNormalization() {
  assert.equal(
    derivePlaceSearchQueryForGeneratedItem({
      type: "PLACE",
      placeSearchQuery: "Senso-ji Temple Tokyo",
    }),
    "Senso-ji Temple Tokyo",
  );
  assert.equal(
    derivePlaceSearchQueryForGeneratedItem({
      type: "ACTIVITY",
      placeSearchQuery: "walk around asakusa",
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
  assert.equal(
    derivePlaceSearchQueryForGeneratedItem({
      type: "FOOD",
      placeSearchQuery: "Lunch in Barcelona",
    }),
    null,
  );
  assert.equal(
    derivePlaceSearchQueryForGeneratedItem({
      type: "ACTIVITY",
      placeSearchQuery: "Forest Sanctuary Kyoto",
    }),
    "Forest Sanctuary Kyoto",
  );
  assert.equal(
    derivePlaceSearchQueryForGeneratedItem({
      type: "TRANSPORT",
      placeSearchQuery: "Gare du Nord Paris",
    }),
    "Gare du Nord Paris",
  );
  assert.equal(
    derivePlaceSearchQueryForGeneratedItem({
      type: "TRANSPORT",
      placeSearchQuery: "東京駅",
    }),
    "東京駅",
  );
  assert.equal(
    derivePlaceSearchQueryForGeneratedItem({
      type: "TRANSPORT",
      placeSearchQuery: "arrival transfer",
    }),
    null,
  );
}

async function testConcurrencyBoundAndContentPreservation() {
  const itinerary = createFixtureItinerary();
  const snapshotBefore = snapshotItemContent(itinerary);

  let active = 0;
  let maxActive = 0;
  const calledQueries: string[] = [];
  const now = new Date("2031-06-01T12:00:00.000Z");
  const sessionExpiresAt = new Date("2031-06-20T00:00:00.000Z");

  const result = await resolveGeneratedItineraryPlaces({
    itinerary,
    sessionExpiresAt,
    now,
    concurrency: 2,
    resolveQuery: async (query) => {
      calledQueries.push(query);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;

      if (query === "Senso-ji Temple Tokyo") {
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

  assert.equal(maxActive <= 2, true);
  assert.equal(maxActive >= 2, true);
  assert.equal(result.summary.attempted, 4);
  assert.equal(result.summary.verified, 1);
  assert.equal(result.summary.unverified, 3);
  assert.equal(result.summary.failed, 0);
  assert.equal(result.summary.skipped, 2);
  assert.deepEqual(calledQueries, [
    "Senso-ji Temple Tokyo",
    "Tokyo Station",
    "Park Hotel Tokyo",
    "Haneda Airport",
  ]);

  const firstItem = result.itinerary.days[0]!.items[0]!;
  assert.equal(firstItem.placeReference?.provider, "GOOGLE");
  assert.equal(firstItem.placeReference?.placeId, "places/sensoji");

  const expireAt = deriveCoordinatesExpireAt({ now, sessionExpiresAt });
  assert.equal(firstItem.placeReference?.coordinatesExpireAt, expireAt.toISOString());

  const idsAfter = result.itinerary.days[0]!.items.map((item) => item.id);
  assert.deepEqual(idsAfter, ["item-1", "item-2", "item-3", "item-4", "item-5", "item-6"]);

  const snapshotAfter = snapshotItemContent(result.itinerary);
  assert.deepEqual(snapshotAfter, snapshotBefore);
}

async function testRequestCapBehavior() {
  const itinerary = createFixtureItinerary();
  const calledQueries: string[] = [];

  const result = await resolveGeneratedItineraryPlaces({
    itinerary,
    sessionExpiresAt: new Date("2031-06-20T00:00:00.000Z"),
    maxRequests: 2,
    concurrency: 3,
    resolveQuery: async (query) => {
      calledQueries.push(query);
      return { kind: "NO_RESULT" as const };
    },
  });

  assert.equal(result.summary.attempted, 2);
  assert.equal(result.summary.verified, 0);
  assert.equal(result.summary.unverified, 2);
  assert.equal(result.summary.failed, 0);
  assert.equal(result.summary.skipped, 4);
  assert.equal(calledQueries.length, 2);
}

async function testAbsoluteRequestCapClamp() {
  const buildDayItems = (dayOffset: number) => {
    return Array.from({ length: 20 }, (_, index) => {
      const placeNumber = dayOffset + index + 1;

      return {
        id: `item-${placeNumber}`,
        order: index,
        type: "PLACE" as const,
        title: `Place ${placeNumber}`,
        description: "Generated place",
        planningText: "Visit",
        placeSearchQuery: `Place ${placeNumber} Station`,
        suggestedTime: null,
        suggestedDurationMinutes: null,
      };
    });
  };

  const parsed = parsePersistedItinerary({
    title: "Cap clamp",
    summary: "Cap clamp test",
    days: [
      {
        id: "day-1",
        dayNumber: 1,
        dayLabel: "Day 1",
        summary: null,
        items: buildDayItems(0),
      },
      {
        id: "day-2",
        dayNumber: 2,
        dayLabel: "Day 2",
        summary: null,
        items: buildDayItems(20),
      },
      {
        id: "day-3",
        dayNumber: 3,
        dayLabel: "Day 3",
        summary: null,
        items: buildDayItems(40),
      },
      {
        id: "day-4",
        dayNumber: 4,
        dayLabel: "Day 4",
        summary: null,
        items: buildDayItems(60),
      },
    ],
  });

  if (!parsed) {
    throw new Error("Cap-clamp itinerary should parse");
  }

  const itinerary = parsed;
  let calls = 0;

  const result = await resolveGeneratedItineraryPlaces({
    itinerary,
    sessionExpiresAt: new Date("2031-06-20T00:00:00.000Z"),
    maxRequests: Number.POSITIVE_INFINITY,
    concurrency: 10,
    resolveQuery: async () => {
      calls += 1;
      return { kind: "NO_RESULT" as const };
    },
  });

  assert.equal(result.summary.attempted, 60);
  assert.equal(result.summary.unverified, 60);
  assert.equal(result.summary.skipped, 20);
  assert.equal(calls, 60);
}

async function testProviderWidePreflightStop() {
  const itinerary = createFixtureItinerary();
  let lookups = 0;

  const result = await resolveGeneratedItineraryPlaces({
    itinerary,
    sessionExpiresAt: new Date("2031-06-20T00:00:00.000Z"),
    checkProviderAvailability: async () => ({
      ok: false as const,
      providerWide: true,
    }),
    resolveQuery: async () => {
      lookups += 1;
      return { kind: "NO_RESULT" as const };
    },
  });

  assert.equal(lookups, 0);
  assert.equal(result.summary.attempted, 0);
  assert.equal(result.summary.failed, 1);
  assert.equal(result.summary.skipped, 6);
}

async function testProviderWideFailureStopDuringResolution() {
  const itinerary = createFixtureItinerary();
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
  assert.equal(result.summary.attempted, 1);
  assert.equal(result.summary.failed, 1);
  assert.equal(result.summary.skipped, 5);
}

async function testUnexpectedLookupRejectionDoesNotFailResolution() {
  const itinerary = createFixtureItinerary();

  const result = await resolveGeneratedItineraryPlaces({
    itinerary,
    sessionExpiresAt: new Date("2031-06-20T00:00:00.000Z"),
    concurrency: 1,
    resolveQuery: async (query) => {
      if (query === "Tokyo Station") {
        throw new Error("unexpected rejection");
      }

      return { kind: "NO_RESULT" as const };
    },
  });

  assert.equal(result.summary.attempted, 4);
  assert.equal(result.summary.failed, 1);
  assert.equal(result.summary.unverified, 3);
  assert.equal(result.summary.verified, 0);
  assert.equal(result.summary.skipped, 2);
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
    await testPlaceDetailsBoundary();
    testQueryNormalization();
    await testConcurrencyBoundAndContentPreservation();
    await testRequestCapBehavior();
    await testAbsoluteRequestCapClamp();
    await testProviderWidePreflightStop();
    await testProviderWideFailureStopDuringResolution();
    await testUnexpectedLookupRejectionDoesNotFailResolution();
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
