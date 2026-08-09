import "server-only";

import { z } from "zod";

export const GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT =
  "https://places.googleapis.com/v1/places:searchText";
export const GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK =
  "places.id,places.displayName.text,places.location";

interface GooglePlacesServerConfig {
  apiKey: string;
}

interface GooglePlacesTextSearchInput {
  query: string;
  timeoutMs?: number;
}

type GooglePlacesLookupResult =
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
      reason:
        | "CONFIGURATION"
        | "AUTHENTICATION"
        | "REQUEST"
        | "MALFORMED_RESPONSE";
      providerWide: boolean;
    };

type GooglePlacesProviderAvailability =
  | { ok: true }
  | {
      ok: false;
      reason: "CONFIGURATION";
      providerWide: true;
    };

const placesTextSearchResponseSchema = z
  .object({
    places: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).nullable().optional(),
            displayName: z
              .object({
                text: z.string().trim().min(1).nullable().optional(),
              })
              .nullable()
              .optional(),
            location: z
              .object({
                latitude: z.number(),
                longitude: z.number(),
              })
              .nullable()
              .optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

const GOOGLE_PLACES_REQUEST_TIMEOUT_MS = 5000;

export function parseGooglePlacesServerConfig(
  env: Record<string, string | undefined>,
): GooglePlacesServerConfig | null {
  const apiKey = env.GOOGLE_PLACES_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return { apiKey };
}

export function getGooglePlacesProviderAvailability(
  env: Record<string, string | undefined> = process.env,
): GooglePlacesProviderAvailability {
  const config = parseGooglePlacesServerConfig(env);

  if (!config) {
    return {
      ok: false,
      reason: "CONFIGURATION",
      providerWide: true,
    };
  }

  return { ok: true };
}

export function isValidGooglePlaceCoordinates(
  latitude: number,
  longitude: number,
): boolean {
  return (
    Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
  );
}

export function isDisplayNameCompatibleWithQuery(
  query: string,
  displayName: string,
): boolean {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedDisplayName = normalizeSearchText(displayName);

  if (!normalizedQuery || !normalizedDisplayName) {
    return false;
  }

  if (normalizedQuery === normalizedDisplayName) {
    return true;
  }

  const queryWords = normalizedQuery.split(" ");
  const displayNameWords = normalizedDisplayName.split(" ");

  const shorterWords =
    queryWords.length <= displayNameWords.length ? queryWords : displayNameWords;
  const longerWords =
    queryWords.length <= displayNameWords.length ? displayNameWords : queryWords;

  // Require at least a two-word whole phrase before accepting phrase containment.
  if (
    shorterWords.length >= 2
    && containsWholePhrase(longerWords, shorterWords)
  ) {
    return true;
  }

  // Allow bilingual overlaps when there is a shared non-ASCII token.
  const queryWordSet = new Set(queryWords);
  const sharedWords = displayNameWords.filter((word) => queryWordSet.has(word));

  if (sharedWords.some((word) => /[^\x00-\x7F]/.test(word))) {
    return true;
  }

  // ASCII overlaps must share at least two full words to avoid single-token false matches.
  return sharedWords.length >= 2;
}

export async function searchGooglePlaceByText(
  input: GooglePlacesTextSearchInput,
): Promise<GooglePlacesLookupResult> {
  const config = parseGooglePlacesServerConfig(process.env);

  if (!config) {
    return {
      kind: "FAILED",
      reason: "CONFIGURATION",
      providerWide: true,
    };
  }

  const query = input.query.trim();

  if (!query) {
    return { kind: "NO_RESULT" };
  }

  const timeoutMs =
    typeof input.timeoutMs === "number"
    && Number.isFinite(input.timeoutMs)
    && input.timeoutMs > 0
      ? Math.floor(input.timeoutMs)
      : GOOGLE_PLACES_REQUEST_TIMEOUT_MS;

  const abortController = new AbortController();
  const timeoutHandle = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  try {
    let response: Response;

    try {
      response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": config.apiKey,
          "X-Goog-FieldMask": GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: query,
          pageSize: 1,
        }),
        cache: "no-store",
        signal: abortController.signal,
      });
    } catch {
      return {
        kind: "FAILED",
        reason: "REQUEST",
        providerWide: false,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        kind: "FAILED",
        reason: "AUTHENTICATION",
        providerWide: true,
      };
    }

    if (!response.ok) {
      return {
        kind: "FAILED",
        reason: "REQUEST",
        providerWide: false,
      };
    }

    let raw: unknown;

    try {
      raw = await response.json();
    } catch {
      if (abortController.signal.aborted) {
        return {
          kind: "FAILED",
          reason: "REQUEST",
          providerWide: false,
        };
      }

      return {
        kind: "FAILED",
        reason: "MALFORMED_RESPONSE",
        providerWide: false,
      };
    }

    const parsed = placesTextSearchResponseSchema.safeParse(raw);

    if (!parsed.success) {
      return {
        kind: "FAILED",
        reason: "MALFORMED_RESPONSE",
        providerWide: false,
      };
    }

    const topResult = parsed.data.places?.[0];

    if (!topResult) {
      return { kind: "NO_RESULT" };
    }

    const placeId = topResult.id?.trim();
    const displayName = topResult.displayName?.text?.trim();
    const latitude = topResult.location?.latitude;
    const longitude = topResult.location?.longitude;

    if (!placeId || !displayName || latitude === undefined || longitude === undefined) {
      return { kind: "INVALID_RESULT" };
    }

    if (!isDisplayNameCompatibleWithQuery(query, displayName)) {
      return { kind: "INVALID_RESULT" };
    }

    if (!isValidGooglePlaceCoordinates(latitude, longitude)) {
      return { kind: "INVALID_RESULT" };
    }

    return {
      kind: "VERIFIED",
      placeId,
      latitude,
      longitude,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsWholePhrase(haystackWords: string[], phraseWords: string[]): boolean {
  if (phraseWords.length === 0 || haystackWords.length < phraseWords.length) {
    return false;
  }

  for (let i = 0; i <= haystackWords.length - phraseWords.length; i += 1) {
    let matches = true;

    for (let j = 0; j < phraseWords.length; j += 1) {
      if (haystackWords[i + j] !== phraseWords[j]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return true;
    }
  }

  return false;
}

export type { GooglePlacesLookupResult };
