"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { loadGoogleMapsLibrary } from "@/lib/maps/google-maps-client";
import {
  deriveGeneratedMapPanelStatus,
  isStaleMapInitializationResult,
  readGoogleMapsPublicConfig,
  shouldInitializeGoogleMap,
  type GeneratedMapPanelStatus,
} from "@/lib/maps/google-maps-foundation";

const MAP_READY_TIMEOUT_MS = 10000;

interface WindowWithGoogleMapsAuthFailure extends Window {
  gm_authFailure?: () => void;
}

export function GeneratedMapPanel() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const hasInitializationAttemptedRef = useRef(false);
  const mapReadyTimeoutRef = useRef<number | null>(null);
  const activeRequestIdRef = useRef(0);
  const hasMapReadySignalRef = useRef(false);
  const [hasMapReadySignal, setHasMapReadySignal] = useState(false);
  const [hasAuthFailure, setHasAuthFailure] = useState(false);
  const [hasLoadFailure, setHasLoadFailure] = useState(false);
  const [hasRenderFailure, setHasRenderFailure] = useState(false);

  const config = useMemo(() => {
    return readGoogleMapsPublicConfig();
  }, []);

  useEffect(() => {
    const shouldInitialize = shouldInitializeGoogleMap({
      status: "GENERATED",
      isMapPanelDisplayed: true,
      hasConfig: config !== null,
    });

    if (!config || !shouldInitialize) {
      return;
    }

    if (hasInitializationAttemptedRef.current) {
      return;
    }

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    let isComponentActive = true;
    hasInitializationAttemptedRef.current = true;
    const windowWithAuthFailure = window as WindowWithGoogleMapsAuthFailure;
    const previousAuthFailureHandler = windowWithAuthFailure.gm_authFailure;
    let readyListener: google.maps.MapsEventListener | null = null;

    setHasAuthFailure(false);
    setHasLoadFailure(false);
    setHasRenderFailure(false);
    setHasMapReadySignal(false);
    hasMapReadySignalRef.current = false;

    windowWithAuthFailure.gm_authFailure = () => {
      if (isStaleMapInitializationResult({
        isComponentActive,
        requestId,
        activeRequestId: activeRequestIdRef.current,
      })) {
        return;
      }

      setHasAuthFailure(true);
    };

    const clearReadyTimeout = () => {
      if (mapReadyTimeoutRef.current !== null) {
        window.clearTimeout(mapReadyTimeoutRef.current);
        mapReadyTimeoutRef.current = null;
      }
    };

    mapReadyTimeoutRef.current = window.setTimeout(() => {
      if (isStaleMapInitializationResult({
        isComponentActive,
        requestId,
        activeRequestId: activeRequestIdRef.current,
      })) {
        return;
      }

      if (!hasMapReadySignalRef.current) {
        setHasRenderFailure(true);
      }
    }, MAP_READY_TIMEOUT_MS);

    void loadGoogleMapsLibrary(config)
      .then((mapsLibrary) => {
        if (isStaleMapInitializationResult({
          isComponentActive,
          requestId,
          activeRequestId: activeRequestIdRef.current,
        })) {
          return;
        }

        if (!mapContainerRef.current) {
          setHasRenderFailure(true);
          return;
        }

        try {
          mapInstanceRef.current = new mapsLibrary.Map(mapContainerRef.current, {
            mapId: config.mapId,
            center: {
              lat: 20,
              lng: 0,
            },
            zoom: 2,
            minZoom: 2,
            streetViewControl: false,
            fullscreenControl: true,
            mapTypeControl: true,
          });
        } catch {
          setHasRenderFailure(true);
          return;
        }

        readyListener = mapInstanceRef.current.addListener("idle", () => {
          if (isStaleMapInitializationResult({
            isComponentActive,
            requestId,
            activeRequestId: activeRequestIdRef.current,
          })) {
            return;
          }

          setHasMapReadySignal(true);
          hasMapReadySignalRef.current = true;
          clearReadyTimeout();

          if (readyListener) {
            readyListener.remove();
            readyListener = null;
          }
        });
      })
      .catch(() => {
        if (isStaleMapInitializationResult({
          isComponentActive,
          requestId,
          activeRequestId: activeRequestIdRef.current,
        })) {
          return;
        }

        setHasLoadFailure(true);
      });

    return () => {
      isComponentActive = false;
      clearReadyTimeout();

      if (readyListener) {
        readyListener.remove();
        readyListener = null;
      }

      if (mapInstanceRef.current) {
        google.maps.event.clearInstanceListeners(mapInstanceRef.current);
        mapInstanceRef.current = null;
      }

      windowWithAuthFailure.gm_authFailure = previousAuthFailureHandler;
    };
  }, [config]);

  const resolvedPanelStatus: GeneratedMapPanelStatus = deriveGeneratedMapPanelStatus({
    hasConfig: config !== null,
    hasAuthFailure,
    hasLoadFailure,
    hasRenderFailure,
    hasMapReadySignal,
  });

  return (
    <aside
      aria-label="Map panel"
      className="min-h-0 overflow-hidden rounded-[2rem] border-0 bg-column-map"
    >
      <div className="relative h-full w-full">
        <div
          ref={mapContainerRef}
          className={`h-full w-full ${resolvedPanelStatus === "ready" ? "opacity-100" : "opacity-0"}`}
          aria-hidden={resolvedPanelStatus !== "ready"}
        />

        {resolvedPanelStatus === "loading" ? (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 flex items-center justify-center bg-column-map px-6 text-center"
          >
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-text-primary">Loading map</h2>
              <p className="text-sm text-text-secondary">
                Preparing Google Maps for this itinerary workspace.
              </p>
            </div>
          </div>
        ) : null}

        {resolvedPanelStatus === "unavailable" ? (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 flex items-center justify-center bg-column-map px-6 text-center"
          >
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-text-primary">Map unavailable</h2>
              <p className="text-sm text-text-secondary">
                Add public Google Maps configuration to enable this panel.
              </p>
            </div>
          </div>
        ) : null}

        {resolvedPanelStatus === "error" ? (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 flex items-center justify-center bg-column-map px-6 text-center"
          >
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-text-primary">Map failed to load</h2>
              <p className="text-sm text-text-secondary">
                Refresh the page to try again.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
