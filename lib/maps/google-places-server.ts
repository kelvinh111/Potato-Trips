import "server-only";

import { z } from "zod";

export const GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT =
  "https://places.googleapis.com/v1/places:searchText";
export const GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK =
  "places.id,places.displayName.text,places.location";
export const GOOGLE_PLACE_DETAILS_ENDPOINT_PREFIX =
  "https://places.googleapis.com/v1/places/";
export const GOOGLE_PLACE_DETAILS_FIELD_MASK =
  "id,displayName.text,primaryTypeDisplayName.text,formattedAddress,googleMapsUri";

interface GooglePlacesServerConfig {
  apiKey: string;
}

interface GooglePlacesTextSearchInput {
  query: string;
  expectedIdentity: string;
  timeoutMs?: number;
}

interface GooglePlaceDetailsInput {
  placeId: string;
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

type GooglePlaceDetailsResult =
  | {
      kind: "SUCCESS";
      placeId: string;
      displayName: string;
      primaryTypeDisplayName: string | null;
      formattedAddress: string | null;
      googleMapsUri: string | null;
    }
  | {
      kind: "FAILED";
      reason:
        | "CONFIGURATION"
        | "AUTHENTICATION"
        | "NOT_FOUND"
        | "REQUEST"
        | "MALFORMED_RESPONSE"
        | "MISMATCHED_ID";
      retryable: boolean;
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

const placeDetailsResponseSchema = z
  .object({
    id: z.string().trim().min(1),
    displayName: z
      .object({
        text: z.string().trim().min(1),
      })
      .strict(),
    primaryTypeDisplayName: z
      .object({
        text: z.string().trim().min(1),
      })
      .strict()
      .nullable()
      .optional(),
    formattedAddress: z.string().trim().min(1).optional(),
    googleMapsUri: z.string().url().optional(),
  })
  .strict();

const GOOGLE_PLACES_REQUEST_TIMEOUT_MS = 5000;
const GENERIC_MATCH_TOKENS = new Set([
  "and",
  "at",
  "city",
  "de",
  "des",
  "du",
  "garden",
  "gardens",
  "hotel",
  "in",
  "la",
  "le",
  "les",
  "museum",
  "of",
  "park",
  "place",
  "plaza",
  "restaurant",
  "square",
  "station",
  "temple",
  "the",
]);

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

const SAFE_ALIAS_DESCRIPTOR_TOKENS = new Set([
  "de",
  "des",
  "du",
  "of",
  "la",
  "le",
  "les",
  "garden",
  "jardin",
  "museum",
  "musee",
  "temple",
  "the",
]);

const PLACE_TYPE_DESCRIPTOR_GROUPS: Record<string, string> = {
  aquarium: "aquarium",
  waterpark: "aquarium",
  museum: "museum",
  musee: "museum",
  "博物館": "museum",
  garden: "garden",
  jardin: "garden",
  zoo: "zoo",
  gallery: "gallery",
  galerie: "gallery",
  opera: "opera",
  "水族館": "aquarium",
};

export function isDisplayNameCompatibleWithIdentity(
  expectedIdentity: string,
  displayName: string,
): boolean {
  const normalizedExpectedIdentity = normalizeSearchText(expectedIdentity);
  const normalizedDisplayName = normalizeSearchText(displayName);

  if (!normalizedExpectedIdentity || !normalizedDisplayName) {
    return false;
  }

  if (normalizedExpectedIdentity === normalizedDisplayName) {
    return true;
  }

  const expectedIdentityWords = tokenizeSearchText(normalizedExpectedIdentity);
  const displayNameWords = tokenizeSearchText(normalizedDisplayName);

  if (expectedIdentityWords.length === 0 || displayNameWords.length === 0) {
    return false;
  }

  const shorterWords =
    expectedIdentityWords.length <= displayNameWords.length
      ? expectedIdentityWords
      : displayNameWords;
  const longerWords =
    expectedIdentityWords.length <= displayNameWords.length
      ? displayNameWords
      : expectedIdentityWords;

  if (
    displayNameWords.length > expectedIdentityWords.length
    && containsWholePhrase(displayNameWords, expectedIdentityWords)
    && !hasSafeContainmentAliasTokens(displayNameWords, expectedIdentityWords)
  ) {
    return false;
  }

  const expectedDescriptorGroups = derivePlaceTypeDescriptorGroups(expectedIdentityWords);
  const displayDescriptorGroups = derivePlaceTypeDescriptorGroups(displayNameWords);

  if (
    expectedDescriptorGroups.size > 0
    && displayDescriptorGroups.size > 0
    && !hasOverlappingDescriptorGroup(expectedDescriptorGroups, displayDescriptorGroups)
  ) {
    return false;
  }

  // Phrase containment can only verify identity when additional tokens are
  // explicitly safe alias descriptors.
  if (shorterWords.length >= 2 && containsWholePhrase(longerWords, shorterWords)) {
    if (hasSafeContainmentAliasTokens(longerWords, shorterWords)) {
      return true;
    }
  }

  const expectedIdentityWordSet = new Set(expectedIdentityWords);
  const sharedWords = displayNameWords.filter((word, index, words) => {
    return expectedIdentityWordSet.has(word) && words.indexOf(word) === index;
  });

  if (sharedWords.length === 0) {
    return false;
  }

  const sharedDistinctiveWords = sharedWords.filter((word) => !isGenericMatchToken(word));

  // Reject overlaps consisting only of generic terms (e.g. "museum", "garden").
  if (sharedDistinctiveWords.length === 0) {
    return false;
  }

  if (sharedDistinctiveWords.length >= 2) {
    return true;
  }

  const distinctiveToken = sharedDistinctiveWords[0] ?? null;
  if (!distinctiveToken) {
    return false;
  }

  const distinctiveExpectedIdentityWords = expectedIdentityWords.filter(
    (word) => !isGenericMatchToken(word),
  );
  const distinctiveDisplayWords = displayNameWords.filter((word) => !isGenericMatchToken(word));

  const unmatchedDistinctiveExpectedWords = distinctiveExpectedIdentityWords.filter((word) => {
    return !sharedDistinctiveWords.includes(word);
  });
  const unmatchedDistinctiveDisplayWords = distinctiveDisplayWords.filter((word) => {
    return !sharedDistinctiveWords.includes(word);
  });

  if (
    sharedDistinctiveWords.length === 1
    && /[^\x00-\x7F]/.test(distinctiveToken)
    && (expectedIdentityWords.length === 1 || displayNameWords.length === 1)
  ) {
    return true;
  }

  // If both sides have extra distinctive identity terms, shared overlap is likely
  // location context (e.g. city) rather than the place identity.
  if (
    unmatchedDistinctiveExpectedWords.length > 0
    && unmatchedDistinctiveDisplayWords.length > 0
  ) {
    return false;
  }

  // With only one shared distinctive token, any extra terms on both sides are
  // context-only overlap unless all extras are safe alias descriptors.
  if (sharedDistinctiveWords.length === 1) {
    const extraExpectedWords = expectedIdentityWords.filter((word) => word !== distinctiveToken);
    const extraDisplayWords = displayNameWords.filter((word) => word !== distinctiveToken);

    if (extraExpectedWords.length > 0 && extraDisplayWords.length > 0) {
      const expectedExtrasAreSafe = extraExpectedWords.every((word) => {
        return SAFE_ALIAS_DESCRIPTOR_TOKENS.has(word);
      });
      const displayExtrasAreSafe = extraDisplayWords.every((word) => {
        return SAFE_ALIAS_DESCRIPTOR_TOKENS.has(word);
      });

      if (!expectedExtrasAreSafe || !displayExtrasAreSafe) {
        return false;
      }
    }
  }

  // Accept a single shared distinctive token for localized/canonical alias pairs,
  // but avoid broad one-word query matches.
  return (
    distinctiveToken.length >= 4
    && expectedIdentityWords.length >= 2
    && displayNameWords.length >= 2
  );
}

function tokenizeSearchText(value: string): string[] {
  return value.split(" ").filter((part) => part.length > 0);
}

function derivePlaceTypeDescriptorGroups(words: string[]): Set<string> {
  const groups = new Set<string>();

  words.forEach((word) => {
    const group = PLACE_TYPE_DESCRIPTOR_GROUPS[word];
    if (group) {
      groups.add(group);
    }
  });

  return groups;
}

function hasOverlappingDescriptorGroup(left: Set<string>, right: Set<string>): boolean {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }

  return false;
}

function hasSafeContainmentAliasTokens(
  longerWords: string[],
  containedPhraseWords: string[],
): boolean {
  if (containedPhraseWords.length === 0 || longerWords.length < containedPhraseWords.length) {
    return false;
  }

  for (let i = 0; i <= longerWords.length - containedPhraseWords.length; i += 1) {
    let matches = true;

    for (let j = 0; j < containedPhraseWords.length; j += 1) {
      if (longerWords[i + j] !== containedPhraseWords[j]) {
        matches = false;
        break;
      }
    }

    if (!matches) {
      continue;
    }

    const beforeTokens = longerWords.slice(0, i);
    const afterTokens = longerWords.slice(i + containedPhraseWords.length);
    const extraTokens = beforeTokens.concat(afterTokens);

    if (extraTokens.every((token) => SAFE_ALIAS_DESCRIPTOR_TOKENS.has(token))) {
      return true;
    }
  }

  return false;
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
  const expectedIdentity = input.expectedIdentity.trim();

  if (!query || !expectedIdentity) {
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

    if (!isDisplayNameCompatibleWithIdentity(expectedIdentity, displayName)) {
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

export async function getGooglePlaceDetails(
  input: GooglePlaceDetailsInput,
): Promise<GooglePlaceDetailsResult> {
  const config = parseGooglePlacesServerConfig(process.env);

  if (!config) {
    return {
      kind: "FAILED",
      reason: "CONFIGURATION",
      retryable: false,
      providerWide: true,
    };
  }

  const placeId = input.placeId.trim();
  if (!placeId) {
    return {
      kind: "FAILED",
      reason: "MALFORMED_RESPONSE",
      retryable: false,
      providerWide: false,
    };
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
      response = await fetch(
        `${GOOGLE_PLACE_DETAILS_ENDPOINT_PREFIX}${encodeURIComponent(placeId)}`,
        {
          method: "GET",
          headers: {
            "X-Goog-Api-Key": config.apiKey,
            "X-Goog-FieldMask": GOOGLE_PLACE_DETAILS_FIELD_MASK,
          },
          cache: "no-store",
          signal: abortController.signal,
        },
      );
    } catch {
      return {
        kind: "FAILED",
        reason: "REQUEST",
        retryable: true,
        providerWide: false,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        kind: "FAILED",
        reason: "AUTHENTICATION",
        retryable: true,
        providerWide: true,
      };
    }

    if (response.status === 404) {
      return {
        kind: "FAILED",
        reason: "NOT_FOUND",
        retryable: false,
        providerWide: false,
      };
    }

    if (!response.ok) {
      return {
        kind: "FAILED",
        reason: "REQUEST",
        retryable: true,
        providerWide: false,
      };
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      return {
        kind: "FAILED",
        reason: "MALFORMED_RESPONSE",
        retryable: false,
        providerWide: false,
      };
    }

    const parsed = placeDetailsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        kind: "FAILED",
        reason: "MALFORMED_RESPONSE",
        retryable: false,
        providerWide: false,
      };
    }

    if (parsed.data.id !== placeId) {
      return {
        kind: "FAILED",
        reason: "MISMATCHED_ID",
        retryable: false,
        providerWide: false,
      };
    }

    return {
      kind: "SUCCESS",
      placeId: parsed.data.id,
      displayName: parsed.data.displayName.text,
      primaryTypeDisplayName: parsed.data.primaryTypeDisplayName?.text ?? null,
      formattedAddress: parsed.data.formattedAddress ?? null,
      googleMapsUri: parsed.data.googleMapsUri ?? null,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericMatchToken(value: string): boolean {
  return GENERIC_MATCH_TOKENS.has(value);
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

export type { GooglePlaceDetailsResult, GooglePlacesLookupResult };
