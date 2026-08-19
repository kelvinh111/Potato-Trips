import "server-only";

import { z } from "zod";

import {
  GOOGLE_PLACES_REQUEST_TIMEOUT_MS,
  GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT,
  GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK,
  parseGooglePlacesServerConfig,
} from "@/lib/maps/google-places-config";
import { isDisplayNameCompatibleWithIdentity } from "@/lib/maps/google-places-identity-matching";

export interface GooglePlacesTextSearchInput {
  query: string;
  expectedIdentity: string;
  timeoutMs?: number;
}

export type GooglePlacesLookupResult =
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
