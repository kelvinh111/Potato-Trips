import "server-only";

import { z } from "zod";

import {
  GOOGLE_PLACE_DETAILS_ENDPOINT_PREFIX,
  GOOGLE_PLACE_DETAILS_FIELD_MASK,
  GOOGLE_PLACES_REQUEST_TIMEOUT_MS,
  parseGooglePlacesServerConfig,
} from "@/lib/maps/google-places-config";

export interface GooglePlaceDetailsInput {
  placeId: string;
  timeoutMs?: number;
}

export type GooglePlaceDetailsResult =
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
