"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  applyNeutralViewportReset,
  applySelectedMarkerFocus,
  applyViewportInstruction,
  buildMarkerPayloadSignature,
  deriveMarkerPressedState,
  deriveFirstLinkedItemId,
  deriveSelectedMarkerFocus,
  deriveMarkerViewportInstruction,
  reconcileMarkerInteractionBinding,
  reconcileMarkers,
  removeMarkerInteractionBinding,
  type GeneratedMapMarkerView,
  type MarkerInteractionBindingState,
} from "@/lib/maps/generated-map-markers";
import {
  loadGoogleMarkerLibrary,
  loadGoogleMapsLibrary,
} from "@/lib/maps/google-maps-client";
import {
  deriveGeneratedMapPanelStatus,
  isStaleMapInitializationResult,
  readGoogleMapsPublicConfig,
  shouldAttemptMapInitialization,
  shouldInitializeGoogleMap,
  type GeneratedMapPanelStatus,
} from "@/lib/maps/google-maps-foundation";

const MAP_READY_TIMEOUT_MS = 10000;
const MAP_PADDING_PX = 80;
const NEUTRAL_CENTER = { latitude: 20, longitude: 0 };
const NEUTRAL_ZOOM = 2;

interface ManagedAdvancedMarker {
  marker: google.maps.marker.AdvancedMarkerElement;
  selected: boolean;
  pinElement: google.maps.marker.PinElement;
  interactionBindingState: MarkerInteractionBindingState | null;
  clickListener: EventListener | null;
}

interface WindowWithGoogleMapsAuthFailure extends Window {
  gm_authFailure?: () => void;
}

interface GeneratedMapPanelProps {
  markers: GeneratedMapMarkerView[];
  selectedItemId: string | null;
  selectionActivationVersion?: number;
  onMarkerActivate: (itemId: string) => void;
  onMapReadyChange?: (isReady: boolean) => void;
}

export function GeneratedMapPanel({
  markers,
  selectedItemId,
  selectionActivationVersion = 0,
  onMarkerActivate,
  onMapReadyChange,
}: GeneratedMapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerStateRef = useRef<{ markersByPlaceId: Map<string, ManagedAdvancedMarker> }>({
    markersByPlaceId: new Map(),
  });
  const hasInitializationFailureRef = useRef(false);
  const isInitializingRef = useRef(false);
  const mapReadyTimeoutRef = useRef<number | null>(null);
  const activeRequestIdRef = useRef(0);
  const hasMapReadySignalRef = useRef(false);
  const hasAppliedInitialViewportRef = useRef(false);
  const previousMarkerCountRef = useRef(0);
  const markerPayloadSignatureRef = useRef("");
  const onMarkerActivateRef = useRef(onMarkerActivate);
  const onMapReadyChangeRef = useRef(onMapReadyChange);
  const [hasMapReadySignal, setHasMapReadySignal] = useState(false);
  const [hasAuthFailure, setHasAuthFailure] = useState(false);
  const [hasLoadFailure, setHasLoadFailure] = useState(false);
  const [hasRenderFailure, setHasRenderFailure] = useState(false);

  const config = useMemo(() => {
    return readGoogleMapsPublicConfig();
  }, []);

  useEffect(() => {
    onMarkerActivateRef.current = onMarkerActivate;
  }, [onMarkerActivate]);

  useEffect(() => {
    onMapReadyChangeRef.current = onMapReadyChange;
  }, [onMapReadyChange]);

  useEffect(() => {
    return () => {
      onMapReadyChangeRef.current?.(false);
    };
  }, []);

  const clearManagedMarkers = useCallback(() => {
    for (const managedMarker of markerStateRef.current.markersByPlaceId.values()) {
      disposeManagedMarker(managedMarker);
    }

    markerStateRef.current = {
      markersByPlaceId: new Map(),
    };
  }, []);

  useEffect(() => {
    if (!hasMapReadySignal) {
      hasAppliedInitialViewportRef.current = false;
      previousMarkerCountRef.current = 0;
      markerPayloadSignatureRef.current = "";
      clearManagedMarkers();
      return;
    }

    const map = mapInstanceRef.current;
    if (!map || !config) {
      return;
    }

    let isActive = true;

    const applySelectionFocus = () => {
      applySelectedMarkerFocus({
        adapter: {
          panTo(position) {
            map.panTo({
              lat: position.latitude,
              lng: position.longitude,
            });
          },
          getZoom() {
            return map.getZoom() ?? null;
          },
          setZoom(zoom) {
            map.setZoom(zoom);
          },
        },
        focusTarget: deriveSelectedMarkerFocus({
          markers,
          selectedItemId,
        }),
      });
    };

    const applyInitialViewport = () => {
      if (hasAppliedInitialViewportRef.current) {
        return;
      }

      const instruction = deriveMarkerViewportInstruction(markers);
      applyViewportInstruction({
        adapter: {
          panTo(position) {
            map.panTo({
              lat: position.latitude,
              lng: position.longitude,
            });
          },
          setZoom(zoom) {
            map.setZoom(zoom);
          },
          fitBounds(bounds, paddingPx) {
            map.fitBounds(
              {
                north: bounds.north,
                south: bounds.south,
                east: bounds.east,
                west: bounds.west,
              },
              paddingPx,
            );
          },
        },
        instruction,
        paddingPx: MAP_PADDING_PX,
      });
      hasAppliedInitialViewportRef.current = true;
    };

    const nextPayloadSignature = buildMarkerPayloadSignature(markers);

    if (markerPayloadSignatureRef.current !== nextPayloadSignature) {
      hasAppliedInitialViewportRef.current = false;
      markerPayloadSignatureRef.current = nextPayloadSignature;
    }

    if (markers.length === 0) {
      applyNeutralViewportReset({
        adapter: {
          panTo(position) {
            map.panTo({ lat: position.latitude, lng: position.longitude });
          },
          setZoom(zoom) {
            map.setZoom(zoom);
          },
        },
        previousMarkerCount: previousMarkerCountRef.current,
        nextMarkerCount: 0,
        neutralCenter: NEUTRAL_CENTER,
        neutralZoom: NEUTRAL_ZOOM,
      });

      clearManagedMarkers();
      hasAppliedInitialViewportRef.current = false;
      previousMarkerCountRef.current = 0;
      markerPayloadSignatureRef.current = "";
      return;
    }

    previousMarkerCountRef.current = markers.length;

    void loadGoogleMarkerLibrary(config)
      .then((markerLibrary) => {
        if (!isActive) {
          return;
        }

        markerStateRef.current = reconcileMarkers({
          current: markerStateRef.current,
          markers,
          selectedItemId,
          onActivate: (itemId) => {
            onMarkerActivateRef.current(itemId);
          },
          adapter: buildMarkerReconcilerAdapter({
            map,
            markerLibrary,
            onActivate: (itemId) => {
              onMarkerActivateRef.current(itemId);
            },
          }),
        });

        applyInitialViewport();
        applySelectionFocus();
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setHasLoadFailure(true);
      });

    return () => {
      isActive = false;
    };
  }, [clearManagedMarkers, config, hasMapReadySignal, markers, selectedItemId, selectionActivationVersion]);

  useEffect(() => {
    const shouldInitialize = shouldInitializeGoogleMap({
      status: "GENERATED",
      isMapPanelDisplayed: true,
      hasConfig: config !== null,
    });

    if (!config || !shouldInitialize) {
      return;
    }

    if (!shouldAttemptMapInitialization({
      hasConfig: true,
      hasMapReadySignal: hasMapReadySignalRef.current,
      hasInitializationFailure: hasInitializationFailureRef.current,
      hasInFlightInitialization: isInitializingRef.current,
      hasMapInstance: mapInstanceRef.current !== null,
    })) {
      return;
    }

    isInitializingRef.current = true;
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    let isComponentActive = true;
    const windowWithAuthFailure = window as WindowWithGoogleMapsAuthFailure;
    const previousAuthFailureHandler = windowWithAuthFailure.gm_authFailure;
    let readyListener: google.maps.MapsEventListener | null = null;

    setHasAuthFailure(false);
    setHasLoadFailure(false);
    setHasRenderFailure(false);
    setHasMapReadySignal(false);
    hasAppliedInitialViewportRef.current = false;
    markerPayloadSignatureRef.current = "";
    hasMapReadySignalRef.current = false;
    hasInitializationFailureRef.current = false;

    windowWithAuthFailure.gm_authFailure = () => {
      if (isStaleMapInitializationResult({
        isComponentActive,
        requestId,
        activeRequestId: activeRequestIdRef.current,
      })) {
        return;
      }

      hasInitializationFailureRef.current = true;
      isInitializingRef.current = false;
      clearReadyTimeout();
      setHasMapReadySignal(false);
      hasMapReadySignalRef.current = false;
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
        hasInitializationFailureRef.current = true;
        isInitializingRef.current = false;
        setHasMapReadySignal(false);
        hasMapReadySignalRef.current = false;
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
          hasInitializationFailureRef.current = true;
          isInitializingRef.current = false;
          setHasMapReadySignal(false);
          hasMapReadySignalRef.current = false;
          setHasRenderFailure(true);
          return;
        }

        try {
          mapInstanceRef.current = new mapsLibrary.Map(mapContainerRef.current, {
            mapId: config.mapId,
            center: {
                lat: NEUTRAL_CENTER.latitude,
                lng: NEUTRAL_CENTER.longitude,
            },
              zoom: NEUTRAL_ZOOM,
            minZoom: 2,
            streetViewControl: false,
            fullscreenControl: true,
            mapTypeControl: true,
          });
        } catch {
          hasInitializationFailureRef.current = true;
          isInitializingRef.current = false;
          setHasMapReadySignal(false);
          hasMapReadySignalRef.current = false;
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
          isInitializingRef.current = false;
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

        hasInitializationFailureRef.current = true;
        isInitializingRef.current = false;
        setHasMapReadySignal(false);
        hasMapReadySignalRef.current = false;
        setHasLoadFailure(true);
      });

    return () => {
      isComponentActive = false;
      isInitializingRef.current = false;
      clearReadyTimeout();

      if (readyListener) {
        readyListener.remove();
        readyListener = null;
      }

      if (mapInstanceRef.current) {
        google.maps.event.clearInstanceListeners(mapInstanceRef.current);
        mapInstanceRef.current = null;
      }

      clearManagedMarkers();

      windowWithAuthFailure.gm_authFailure = previousAuthFailureHandler;
    };
  }, [clearManagedMarkers, config]);

  const resolvedPanelStatus: GeneratedMapPanelStatus = deriveGeneratedMapPanelStatus({
    hasConfig: config !== null,
    hasAuthFailure,
    hasLoadFailure,
    hasRenderFailure,
    hasMapReadySignal,
  });

  useEffect(() => {
    onMapReadyChangeRef.current?.(resolvedPanelStatus === "ready");
  }, [resolvedPanelStatus]);

  return (
    <aside
      aria-label="Map panel"
      className="min-h-0 overflow-hidden rounded-[2rem] border-0 bg-column-map"
    >
      <div className="relative h-full w-full">
        <div
          ref={mapContainerRef}
          className={`h-full w-full ${resolvedPanelStatus === "ready" ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          aria-hidden={resolvedPanelStatus !== "ready"}
          tabIndex={resolvedPanelStatus === "ready" ? undefined : -1}
          style={resolvedPanelStatus === "ready" ? undefined : { visibility: "hidden" }}
        />

        {resolvedPanelStatus === "loading" ? (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-0 z-10 flex items-center justify-center bg-column-map px-6 text-center"
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
            className="absolute inset-0 z-10 flex items-center justify-center bg-column-map px-6 text-center"
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
            className="absolute inset-0 z-10 flex items-center justify-center bg-column-map px-6 text-center"
          >
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-text-primary">Map failed to load</h2>
              <p className="text-sm text-text-secondary">
                Refresh the page to try again.
              </p>
            </div>
          </div>
        ) : null}

        {resolvedPanelStatus === "ready" && markers.length === 0 ? (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-xl border border-border-subtle bg-bg-elevated/95 px-3 py-2 text-xs text-text-secondary"
          >
            No verified places available for map markers.
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function buildInteractionAdapter(
  managedMarker: ManagedAdvancedMarker,
): {
  setClickHandler: (handler: (() => void) | null) => void;
} {
  return {
    setClickHandler(handler) {
      if (managedMarker.clickListener) {
        managedMarker.marker.removeEventListener("gmp-click", managedMarker.clickListener);
      }
      managedMarker.clickListener = null;

      if (!handler) {
        return;
      }

      const listener: EventListener = () => {
        handler();
      };
      managedMarker.marker.addEventListener("gmp-click", listener);
      managedMarker.clickListener = listener;
    },
  };
}

function buildMarkerReconcilerAdapter(input: {
  map: google.maps.Map;
  markerLibrary: google.maps.MarkerLibrary;
  onActivate: (itemId: string) => void;
}): {
  create: (args: {
    marker: GeneratedMapMarkerView;
    selected: boolean;
    onActivate: (itemId: string) => void;
  }) => ManagedAdvancedMarker;
  update: (args: {
    marker: ManagedAdvancedMarker;
    next: GeneratedMapMarkerView;
    selected: boolean;
    onActivate: (itemId: string) => void;
  }) => void;
  remove: (marker: ManagedAdvancedMarker) => void;
} {
  return {
    create({ marker, selected, onActivate }) {
      const pinElement = createMarkerPinElement(input.markerLibrary, selected);
      const advancedMarker = new input.markerLibrary.AdvancedMarkerElement({
        map: input.map,
        position: {
          lat: marker.latitude,
          lng: marker.longitude,
        },
        title: marker.markerTitle,
        gmpClickable: true,
      });

      advancedMarker.className = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary rounded-full";
      advancedMarker.append(pinElement);
      advancedMarker.setAttribute("aria-pressed", deriveMarkerPressedState(selected));

      const managedMarker: ManagedAdvancedMarker = {
        marker: advancedMarker,
        selected,
        pinElement,
        interactionBindingState: null,
        clickListener: null,
      };

      managedMarker.interactionBindingState = reconcileMarkerInteractionBinding({
        current: managedMarker.interactionBindingState,
        adapter: buildInteractionAdapter(managedMarker),
        firstLinkedItemId: deriveFirstLinkedItemId(marker),
        onActivate,
      });

      return managedMarker;
    },
    update({ marker: managedMarker, next, selected, onActivate }) {
      managedMarker.marker.position = {
        lat: next.latitude,
        lng: next.longitude,
      };
      managedMarker.marker.title = next.markerTitle;
      managedMarker.marker.setAttribute("aria-pressed", deriveMarkerPressedState(selected));

      managedMarker.interactionBindingState = reconcileMarkerInteractionBinding({
        current: managedMarker.interactionBindingState,
        adapter: buildInteractionAdapter(managedMarker),
        firstLinkedItemId: deriveFirstLinkedItemId(next),
        onActivate,
      });

      if (managedMarker.selected === selected) {
        return;
      }

      applyMarkerSelectionStyling(managedMarker.pinElement, selected);
      managedMarker.selected = selected;
    },
    remove(managedMarker) {
      disposeManagedMarker(managedMarker);
    },
  };
}

function disposeManagedMarker(managedMarker: ManagedAdvancedMarker) {
  managedMarker.interactionBindingState = removeMarkerInteractionBinding({
    current: managedMarker.interactionBindingState,
    adapter: buildInteractionAdapter(managedMarker),
  });
  managedMarker.marker.map = null;
}

function createMarkerPinElement(
  markerLibrary: google.maps.MarkerLibrary,
  selected: boolean,
): google.maps.marker.PinElement {
  return new markerLibrary.PinElement(
    resolveMarkerPinColors(selected),
  );
}

function applyMarkerSelectionStyling(
  pinElement: google.maps.marker.PinElement,
  selected: boolean,
) {
  const nextColors = resolveMarkerPinColors(selected);
  pinElement.background = nextColors.background;
  pinElement.borderColor = nextColors.borderColor;
  pinElement.glyphColor = nextColors.glyphColor;
}

function resolveMarkerPinColors(selected: boolean): {
  background: string;
  borderColor: string;
  glyphColor: string;
} {
  const rootStyles = getComputedStyle(document.documentElement);
  const accentPrimary = rootStyles.getPropertyValue("--accent-primary").trim();
  const bgSelected = rootStyles.getPropertyValue("--bg-selected").trim();
  const textPrimary = rootStyles.getPropertyValue("--text-primary").trim();
  const bgSurface = rootStyles.getPropertyValue("--bg-surface").trim();

  if (selected) {
    return {
      background: accentPrimary || "var(--accent-primary)",
      borderColor: textPrimary || "var(--text-primary)",
      glyphColor: bgSurface || "var(--bg-surface)",
    };
  }

  return {
    background: bgSelected || "var(--bg-selected)",
    borderColor: accentPrimary || "var(--accent-primary)",
    glyphColor: textPrimary || "var(--text-primary)",
  };
}
