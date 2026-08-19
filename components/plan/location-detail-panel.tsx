"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { shouldApplyLocationDetailResponse } from "@/lib/planning-sessions/location-detail-client-state";
import { findCanonicalItineraryItemContext } from "@/lib/planning-sessions/itinerary-kanban";
import { shouldRequestProviderDetailForInteraction } from "@/lib/planning-sessions/location-detail-interactions";
import {
  requestPlanningSessionLocationDetail,
  type PlanningSessionLocationDetailApiPayload,
} from "@/lib/planning-sessions/client-api";
import type { PersistedItinerary } from "@/lib/planning-sessions/types";

interface LocationDetailPanelProps {
  sessionId: string;
  itinerary: PersistedItinerary | null;
  itemId: string;
  activationVersion: number;
  onClose: () => void;
}

type DetailRequestState =
  | { kind: "loading" }
  | { kind: "success"; detail: PlanningSessionLocationDetailApiPayload }
  | { kind: "error"; message: string };

export function LocationDetailPanel({
  sessionId,
  itinerary,
  itemId,
  activationVersion,
  onClose,
}: LocationDetailPanelProps) {
  const [retryNonce, setRetryNonce] = useState(0);
  const [requestState, setRequestState] = useState<DetailRequestState>({ kind: "loading" });
  const requestIdRef = useRef(0);

  const itemContext = useMemo(() => {
    if (!itinerary) {
      return null;
    }

    return findCanonicalItineraryItemContext({ itinerary, itemId });
  }, [itinerary, itemId]);

  const hasProviderDetailEligibility = Boolean(itemContext?.googlePlaceId);
  const shouldRequestProviderDetail = shouldRequestProviderDetailForInteraction({
    kind: "click",
    hasGooglePlaceId: hasProviderDetailEligibility,
  });

  useEffect(() => {
    if (!itemContext || !shouldRequestProviderDetail) {
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    void requestPlanningSessionLocationDetail(sessionId, itemId)
      .then((detail) => {
        if (!shouldApplyLocationDetailResponse({
          activeRequestId: requestIdRef.current,
          responseRequestId: requestId,
        })) {
          return;
        }

        setRequestState({ kind: "success", detail });
      })
      .catch((error) => {
        if (!shouldApplyLocationDetailResponse({
          activeRequestId: requestIdRef.current,
          responseRequestId: requestId,
        })) {
          return;
        }

        setRequestState({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load location details right now. Please retry.",
        });
      });
  }, [activationVersion, itemContext, itemId, retryNonce, sessionId, shouldRequestProviderDetail]);

  if (!itemContext) {
    return (
      <section
        aria-label="Location detail"
        className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[2rem] border-0 bg-column-center"
      >
        <header className="flex items-center justify-between border-b border-border-subtle px-4 py-4 sm:px-6">
          <h2 className="text-base font-semibold text-text-primary">Location Detail</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close location detail"
            className="rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <p role="status" aria-live="polite" className="text-sm text-text-secondary">
            Location detail is unavailable.
          </p>
        </div>
      </section>
    );
  }

  const showSuccess = requestState.kind === "success";
  const showItineraryOnly = !hasProviderDetailEligibility;
  const detail = showSuccess ? requestState.detail : null;

  return (
    <section
      aria-label="Location detail"
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[2rem] border-0 bg-column-center"
    >
      <header className="flex items-start justify-between border-b border-border-subtle px-4 py-4 sm:px-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Itinerary Plan &gt; Day {itemContext.dayNumber}
          </p>
          <p className="inline-flex rounded-full border border-border-default bg-bg-elevated px-3 py-1 text-xs font-semibold text-text-secondary">
            {itemContext.itemTypeLabel}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary">
            {detail?.displayName ?? itemContext.title}
          </h2>
          {showSuccess && detail?.formattedAddress ? (
            <p className="inline-flex items-start gap-2 text-sm text-text-secondary">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{detail.formattedAddress}</span>
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close location detail"
          className="rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        {requestState.kind === "loading" ? (
          <p
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-sm text-text-secondary"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading location details...
          </p>
        ) : null}

        {requestState.kind === "error" ? (
          <div
            role="alert"
            aria-live="assertive"
            className="space-y-3 rounded-2xl border border-state-error/30 bg-state-error/10 px-4 py-3"
          >
            <p className="text-sm text-state-error">{requestState.message}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRequestState({ kind: "loading" });
                setRetryNonce((value) => value + 1);
              }}
              className="rounded-xl"
            >
              Retry
            </Button>
          </div>
        ) : null}

        {showSuccess ? (
          <div className="space-y-5">
            {detail?.primaryTypeDisplayName ? (
              <div className="rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Category</p>
                <p className="mt-1 text-sm text-text-primary">{detail.primaryTypeDisplayName}</p>
              </div>
            ) : null}

            {detail?.googleMapsUri ? (
              <div className="rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-3">
                <a
                  href={detail.googleMapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-accent-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                >
                  View on Google Maps
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        {showItineraryOnly ? (
          <div className="rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Detail source</p>
            <p className="mt-1 text-sm text-text-secondary">
              Showing itinerary-authored details for this item.
            </p>
          </div>
        ) : null}

        <div className="mt-5 rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-4">
          <h3 className="text-base font-semibold text-text-primary">About</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
            {itemContext.description}
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-4">
          <h3 className="text-base font-semibold text-text-primary">Planning Text</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
            {itemContext.planningText}
          </p>
        </div>

        {showSuccess ? (
          <p className="mt-4 text-xs text-text-faint">Place data © Google Maps</p>
        ) : null}
      </div>
    </section>
  );
}
