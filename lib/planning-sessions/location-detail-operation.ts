import { createHash } from "node:crypto";

import {
  getGooglePlaceDetails,
  getGooglePlacesProviderAvailability,
  type GooglePlaceDetailsResult,
} from "@/lib/maps/google-places-server";
import { isPlanningSessionExpired } from "@/lib/planning-sessions/expiry";
import { findCanonicalItineraryItemContext } from "@/lib/planning-sessions/itinerary-kanban";
import { PLANNING_SESSION_LOCATION_DETAIL_MAX_ATTEMPTS } from "@/lib/planning-sessions/constants";
import type { PlanningSessionRecord } from "@/lib/planning-sessions/repository";

export interface PlanningSessionLocationDetailPayload {
  itemId: string;
  displayName: string;
  primaryTypeDisplayName: string | null;
  formattedAddress: string | null;
  googleMapsUri: string | null;
}

type ProviderFailureReason =
  | "CONFIGURATION"
  | "AUTHENTICATION"
  | "NOT_FOUND"
  | "REQUEST"
  | "MALFORMED_RESPONSE"
  | "MISMATCHED_ID";

export type PlanningSessionLocationDetailResult =
  | { kind: "NOT_FOUND" }
  | { kind: "EXPIRED" }
  | { kind: "UNAVAILABLE"; reason: "INVALID_STATE" | "MISSING_ITEM" | "MISSING_PLACE_REFERENCE" }
  | { kind: "LIMIT_EXCEEDED" }
  | { kind: "PROVIDER_FAILURE"; reason: ProviderFailureReason; retryable: boolean }
  | { kind: "SUCCESS"; detail: PlanningSessionLocationDetailPayload };

interface LocationDetailDependencies {
  findSessionById: (sessionId: string) => Promise<PlanningSessionRecord | null>;
  isSessionExpired: (expiresAt: Date) => boolean;
  reserveAttempt: (input: {
    sessionId: string;
    maxAttempts: number;
  }) => Promise<{ locationDetailAttempts: number }>;
  getProviderAvailability: () => { ok: true } | { ok: false; reason: "CONFIGURATION" };
  getPlaceDetails: (input: { placeId: string }) => Promise<GooglePlaceDetailsResult>;
  maxAttempts: number;
  logOutcome: (input: {
    sessionId: string;
    itemId: string;
    placeId: string;
    attemptNumber: number;
    outcome: "SUCCESS" | ProviderFailureReason;
  }) => void;
}

export async function getPlanningSessionLocationDetail(input: {
  sessionId: string;
  itemId: string;
}): Promise<PlanningSessionLocationDetailResult> {
  const repository = await import("@/lib/planning-sessions/repository");

  return getPlanningSessionLocationDetailWithDependencies(input, {
    findSessionById: repository.findPlanningSessionById,
    isSessionExpired: isPlanningSessionExpired,
    reserveAttempt: repository.reservePlanningSessionLocationDetailAttempt,
    getProviderAvailability: () => {
      const availability = getGooglePlacesProviderAvailability();

      if (availability.ok) {
        return { ok: true };
      }

      return { ok: false, reason: "CONFIGURATION" };
    },
    getPlaceDetails: getGooglePlaceDetails,
    maxAttempts: PLANNING_SESSION_LOCATION_DETAIL_MAX_ATTEMPTS,
    logOutcome: logLocationDetailOutcome,
  });
}

export async function getPlanningSessionLocationDetailWithDependencies(
  input: {
    sessionId: string;
    itemId: string;
  },
  dependencies: LocationDetailDependencies,
): Promise<PlanningSessionLocationDetailResult> {
  const session = await dependencies.findSessionById(input.sessionId);

  if (!session) {
    return { kind: "NOT_FOUND" };
  }

  if (dependencies.isSessionExpired(session.expiresAt)) {
    return { kind: "EXPIRED" };
  }

  if (session.status !== "GENERATED" || !session.generatedItinerary) {
    return { kind: "UNAVAILABLE", reason: "INVALID_STATE" };
  }

  const itemContext = findCanonicalItineraryItemContext({
    itinerary: session.generatedItinerary,
    itemId: input.itemId,
  });

  if (!itemContext) {
    return { kind: "UNAVAILABLE", reason: "MISSING_ITEM" };
  }

  if (!itemContext.googlePlaceId) {
    return { kind: "UNAVAILABLE", reason: "MISSING_PLACE_REFERENCE" };
  }

  const providerAvailability = dependencies.getProviderAvailability();
  if (!providerAvailability.ok) {
    return {
      kind: "PROVIDER_FAILURE",
      reason: "CONFIGURATION",
      retryable: false,
    };
  }

  let reservedAttemptNumber = -1;

  try {
    const reservedSession = await dependencies.reserveAttempt({
      sessionId: input.sessionId,
      maxAttempts: dependencies.maxAttempts,
    });
    reservedAttemptNumber = reservedSession.locationDetailAttempts;
  } catch (error) {
    if (isPlanningSessionUsageLimitError(error)) {
      return { kind: "LIMIT_EXCEEDED" };
    }

    if (isPlanningSessionInvalidStateError(error)) {
      return { kind: "UNAVAILABLE", reason: "INVALID_STATE" };
    }

    throw error;
  }

  const detailsResult = await dependencies.getPlaceDetails({
    placeId: itemContext.googlePlaceId,
  });

  dependencies.logOutcome({
    sessionId: input.sessionId,
    itemId: input.itemId,
    placeId: itemContext.googlePlaceId,
    attemptNumber: reservedAttemptNumber,
    outcome: detailsResult.kind === "SUCCESS" ? "SUCCESS" : detailsResult.reason,
  });

  if (detailsResult.kind === "FAILED") {
    return {
      kind: "PROVIDER_FAILURE",
      reason: detailsResult.reason,
      retryable: detailsResult.retryable,
    };
  }

  return {
    kind: "SUCCESS",
    detail: {
      itemId: input.itemId,
      displayName: detailsResult.displayName,
      primaryTypeDisplayName: detailsResult.primaryTypeDisplayName,
      formattedAddress: detailsResult.formattedAddress,
      googleMapsUri: detailsResult.googleMapsUri,
    },
  };
}

function isPlanningSessionUsageLimitError(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "name" in error
    && error.name === "PlanningSessionUsageLimitError"
  );
}

function isPlanningSessionInvalidStateError(error: unknown): boolean {
  return (
    typeof error === "object"
    && error !== null
    && "name" in error
    && error.name === "PlanningSessionInvalidStateError"
  );
}

function logLocationDetailOutcome(input: {
  sessionId: string;
  itemId: string;
  placeId: string;
  attemptNumber: number;
  outcome: "SUCCESS" | "CONFIGURATION" | "AUTHENTICATION" | "NOT_FOUND" | "REQUEST" | "MALFORMED_RESPONSE" | "MISMATCHED_ID";
}) {
  const placeIdHash = createHash("sha256").update(input.placeId).digest("hex").slice(0, 16);

  console.info("planning_session_location_detail", {
    sessionId: input.sessionId,
    itemId: input.itemId,
    attemptNumber: input.attemptNumber,
    placeIdHash,
    outcome: input.outcome,
  });
}
