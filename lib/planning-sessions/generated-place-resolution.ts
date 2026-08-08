import {
  PLANNING_SESSION_PLACE_COORDINATES_TTL_DAYS,
  PLANNING_SESSION_PLACE_RESOLUTION_CONCURRENCY,
  PLANNING_SESSION_PLACE_RESOLUTION_MAX_REQUESTS,
} from "@/lib/planning-sessions/constants";
import type {
  GooglePlaceReference,
  PersistedItinerary,
} from "@/lib/planning-sessions/types";

interface ResolveGeneratedPlacesInput {
  itinerary: PersistedItinerary;
  sessionExpiresAt: Date;
  resolveQuery: (query: string) => Promise<
    | {
        kind: "VERIFIED";
        placeId: string;
        latitude: number;
        longitude: number;
      }
    | { kind: "NO_RESULT" }
    | { kind: "INVALID_RESULT" }
    | {
        kind: "FAILED";
        providerWide: boolean;
      }
  >;
  now?: Date;
  maxRequests?: number;
  concurrency?: number;
}

export interface GeneratedPlaceResolutionSummary {
  attempted: number;
  verified: number;
  unverified: number;
  skipped: number;
  failed: number;
}

interface ResolutionTargetItem {
  dayIndex: number;
  itemIndex: number;
  query: string;
}

const nonPlaceQueryPhrases = [
  "free time",
  "explore area",
  "walk around",
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "local food",
  "shopping",
  "rest",
  "arrival",
  "departure",
];

const placeAnchors = [
  "airport",
  "station",
  "hotel",
  "hostel",
  "temple",
  "shrine",
  "museum",
  "park",
  "tower",
  "market",
  "restaurant",
  "cafe",
  "bar",
  "mall",
  "bridge",
  "castle",
  "palace",
];

export function deriveCoordinatesExpireAt(input: {
  now: Date;
  sessionExpiresAt: Date;
}): Date {
  const ttlDeadline = new Date(
    input.now.getTime() + PLANNING_SESSION_PLACE_COORDINATES_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  return ttlDeadline <= input.sessionExpiresAt ? ttlDeadline : input.sessionExpiresAt;
}

export async function resolveGeneratedItineraryPlaces(
  input: ResolveGeneratedPlacesInput,
): Promise<{
  itinerary: PersistedItinerary;
  summary: GeneratedPlaceResolutionSummary;
}> {
  const now = input.now ?? new Date();
  const maxRequests = input.maxRequests ?? PLANNING_SESSION_PLACE_RESOLUTION_MAX_REQUESTS;
  const concurrency = input.concurrency ?? PLANNING_SESSION_PLACE_RESOLUTION_CONCURRENCY;
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const safeMaxRequests = Math.max(0, Math.floor(maxRequests));

  const itinerary: PersistedItinerary = {
    ...input.itinerary,
    days: input.itinerary.days.map((day) => ({
      ...day,
      items: day.items.map((item) => ({
        ...item,
        placeSearchQuery: item.placeSearchQuery ?? null,
        placeReference: null,
      })),
    })),
  };

  const summary: GeneratedPlaceResolutionSummary = {
    attempted: 0,
    verified: 0,
    unverified: 0,
    skipped: 0,
    failed: 0,
  };

  const targets: ResolutionTargetItem[] = [];

  itinerary.days.forEach((day, dayIndex) => {
    day.items.forEach((item, itemIndex) => {
      const query = derivePlaceSearchQueryForGeneratedItem({
        type: item.type,
        placeSearchQuery: item.placeSearchQuery ?? null,
      });

      itinerary.days[dayIndex]!.items[itemIndex]!.placeSearchQuery = query;

      if (!query) {
        summary.skipped += 1;
        return;
      }

      targets.push({ dayIndex, itemIndex, query });
    });
  });

  if (targets.length === 0) {
    return { itinerary, summary };
  }

  let providerWideFailure = false;
  let cursor = 0;

  const workers = Array.from({ length: Math.min(safeConcurrency, targets.length) }, () => {
    return (async () => {
      while (cursor < targets.length) {
        const currentIndex = cursor;
        cursor += 1;
        const target = targets[currentIndex];

        if (!target) {
          return;
        }

        if (providerWideFailure || summary.attempted >= safeMaxRequests) {
          summary.skipped += 1;
          continue;
        }

        summary.attempted += 1;
        const result = await input.resolveQuery(target.query);

        if (result.kind === "VERIFIED") {
          const expiresAt = deriveCoordinatesExpireAt({
            now,
            sessionExpiresAt: input.sessionExpiresAt,
          });

          const placeReference: GooglePlaceReference = {
            provider: "GOOGLE",
            placeId: result.placeId,
            latitude: result.latitude,
            longitude: result.longitude,
            coordinatesCachedAt: now.toISOString(),
            coordinatesExpireAt: expiresAt.toISOString(),
          };

          itinerary.days[target.dayIndex]!.items[target.itemIndex]!.placeReference =
            placeReference;
          summary.verified += 1;
          continue;
        }

        if (result.kind === "NO_RESULT" || result.kind === "INVALID_RESULT") {
          summary.unverified += 1;
          continue;
        }

        summary.failed += 1;
        if (result.providerWide) {
          providerWideFailure = true;
        }
      }
    })();
  });

  await Promise.all(workers);

  return {
    itinerary,
    summary,
  };
}

export function derivePlaceSearchQueryForGeneratedItem(input: {
  type: PersistedItinerary["days"][number]["items"][number]["type"];
  placeSearchQuery: string | null;
}): string | null {
  const candidate = input.placeSearchQuery?.trim() ?? "";

  if (!candidate) {
    return null;
  }

  const normalized = candidate.toLowerCase();
  const hasPlaceAnchor = placeAnchors.some((anchor) => normalized.includes(anchor));
  const isGeneric = nonPlaceQueryPhrases.some((phrase) => normalized.includes(phrase));

  if (input.type === "NOTE") {
    return null;
  }

  if (input.type === "ACTIVITY" || input.type === "FOOD") {
    if (isGeneric && !hasPlaceAnchor) {
      return null;
    }
  }

  if (input.type === "TRANSPORT") {
    if (!hasPlaceAnchor) {
      return null;
    }
  }

  return candidate;
}
