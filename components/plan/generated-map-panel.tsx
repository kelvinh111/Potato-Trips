"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildMarkerPayloadSignature,
  deriveFirstLinkedItemId,
  deriveSelectedMarkerFocus,
  deriveMarkerViewportInstruction,
  reconcileMarkers,
  shouldResetInitialViewport,
  type GeneratedMapMarkerView,
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

interface ManagedAdvancedMarker {
  marker: google.maps.marker.AdvancedMarkerElement;
  clickListener: google.maps.MapsEventListener | null;
  linkedItemIds: string[];
  firstLinkedItemId: string | null;
  selected: boolean;
  pinElement: google.maps.marker.PinElement;
  contentElement: HTMLDivElement;
  onKeyDown: (event: KeyboardEvent) => void;
}

interface WindowWithGoogleMapsAuthFailure extends Window {
  gm_authFailure?: () => void;
}

interface GeneratedMapPanelProps {
  markers: GeneratedMapMarkerView[];
  selectedItemId: string | null;
  onMarkerActivate: (itemId: string) => void;
  onMapReadyChange?: (isReady: boolean) => void;
}

export function GeneratedMapPanel({
  markers,
  selectedItemId,
  onMarkerActivate,
  onMapReadyChange,
}: GeneratedMapPanelProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerStateRef = useRef<{ markersByPlaceId: Map<string, ManagedAdvancedMarker> }>({
    markersByPlaceId: new Map(),
  });
  const markerLibraryRef = useRef<google.maps.MarkerLibrary | null>(null);
  const hasInitializationFailureRef = useRef(false);
  const isInitializingRef = useRef(false);
  const mapReadyTimeoutRef = useRef<number | null>(null);
  const activeRequestIdRef = useRef(0);
  const hasMapReadySignalRef = useRef(false);
  const hasAppliedInitialViewportRef = useRef(false);
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
    onMapReadyChangeRef.current?.(hasMapReadySignal);
  }, [hasMapReadySignal]);

  useEffect(() => {
    return () => {
      onMapReadyChangeRef.current?.(false);
    };
  }, []);

  useEffect(() => {
    if (!hasMapReadySignal) {
      hasAppliedInitialViewportRef.current = false;
      markerStateRef.current = reconcileMarkers({
        current: markerStateRef.current,
        markers: [],
        selectedItemId: null,
        onActivate: (itemId) => {
          onMarkerActivateRef.current(itemId);
        },
        adapter: {
          create() {
            throw new Error("marker adapter unavailable before map initialization");
          },
          update() {
          },
          remove(managedMarker) {
            managedMarker.clickListener?.remove();
            managedMarker.clickListener = null;
            managedMarker.contentElement.removeEventListener("keydown", managedMarker.onKeyDown);
            managedMarker.marker.map = null;
          },
        },
      });
      return;
    }

    const map = mapInstanceRef.current;
    if (!map || !config) {
      return;
    }

    let isActive = true;

    const applySelectionFocus = (nextMarkers: GeneratedMapMarkerView[]) => {
      const focusTarget = deriveSelectedMarkerFocus({
        markers: nextMarkers,
        selectedItemId,
      });

      if (!focusTarget) {
        return;
      }

      map.panTo({
        lat: focusTarget.latitude,
        lng: focusTarget.longitude,
      });

      if ((map.getZoom() ?? 0) < 11) {
        map.setZoom(11);
      }
    };

    const applyInitialViewport = (nextMarkers: GeneratedMapMarkerView[]) => {
      if (hasAppliedInitialViewportRef.current) {
        return;
      }

      const instruction = deriveMarkerViewportInstruction(nextMarkers);

      if (instruction.kind === "NONE") {
        hasAppliedInitialViewportRef.current = true;
        return;
      }

      if (instruction.kind === "SINGLE") {
        map.panTo({ lat: instruction.latitude, lng: instruction.longitude });
        map.setZoom(instruction.zoom);
        hasAppliedInitialViewportRef.current = true;
        return;
      }

      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: instruction.bounds.north, lng: instruction.bounds.east });
      bounds.extend({ lat: instruction.bounds.south, lng: instruction.bounds.west });
      map.fitBounds(bounds, MAP_PADDING_PX);
      hasAppliedInitialViewportRef.current = true;
    };

    const nextPayloadSignature = buildMarkerPayloadSignature(markers);

    if (shouldResetInitialViewport({
      previousSignature: markerPayloadSignatureRef.current,
      nextSignature: nextPayloadSignature,
    })) {
      hasAppliedInitialViewportRef.current = false;
      markerPayloadSignatureRef.current = nextPayloadSignature;
    }

    if (markers.length === 0) {
      markerStateRef.current = reconcileMarkers({
        current: markerStateRef.current,
        markers: [],
        selectedItemId,
        onActivate: (itemId) => {
          onMarkerActivateRef.current(itemId);
        },
        adapter: {
          create() {
            throw new Error("cannot create markers with empty marker list");
          },
          update() {
          },
          remove(managedMarker) {
            managedMarker.clickListener?.remove();
            managedMarker.clickListener = null;
            managedMarker.contentElement.removeEventListener("keydown", managedMarker.onKeyDown);
            managedMarker.marker.map = null;
          },
        },
      });
      hasAppliedInitialViewportRef.current = false;
      markerPayloadSignatureRef.current = "";
      return;
    }

    void loadGoogleMarkerLibrary(config)
      .then((markerLibrary) => {
        if (!isActive) {
          return;
        }

        markerLibraryRef.current = markerLibrary;

        markerStateRef.current = reconcileMarkers({
          current: markerStateRef.current,
          markers,
          selectedItemId,
          onActivate: (itemId) => {
            onMarkerActivateRef.current(itemId);
          },
          adapter: {
            create({ marker, selected, onActivate }) {
              const pinElement = createMarkerPinElement(markerLibrary, selected);
              const firstLinkedItemId = deriveFirstLinkedItemId(marker);
              const markerTitle = marker.markerTitle;
              const contentElement = document.createElement("div");
              contentElement.tabIndex = 0;
              contentElement.role = "button";
              contentElement.ariaLabel = markerTitle;
              contentElement.className = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary rounded-full";
              contentElement.appendChild(pinElement.element);

              const onKeyDown = (event: KeyboardEvent) => {
                if (event.key !== "Enter" && event.key !== " ") {
                  return;
                }

                event.preventDefault();
                if (!firstLinkedItemId) {
                  return;
                }

                onActivate(firstLinkedItemId);
              };

              contentElement.addEventListener("keydown", onKeyDown);

              const advancedMarker = new markerLibrary.AdvancedMarkerElement({
                map,
                position: {
                  lat: marker.latitude,
                  lng: marker.longitude,
                },
                title: markerTitle,
                content: contentElement,
                gmpClickable: true,
              });

              const clickListener = advancedMarker.addListener("click", () => {
                if (!firstLinkedItemId) {
                  return;
                }

                onActivate(firstLinkedItemId);
              });

              return {
                marker: advancedMarker,
                clickListener,
                linkedItemIds: marker.linkedItems.map((linkedItem) => linkedItem.itemId),
                firstLinkedItemId,
                selected,
                pinElement,
                contentElement,
                onKeyDown,
              };
            },
            update({ marker: managedMarker, next, selected, onActivate }) {
              managedMarker.marker.position = {
                lat: next.latitude,
                lng: next.longitude,
              };
              managedMarker.marker.title = next.markerTitle;
              managedMarker.contentElement.ariaLabel = next.markerTitle;

              const firstLinkedItemId = deriveFirstLinkedItemId(next);
              const nextLinkedItemIds = next.linkedItems.map((linkedItem) => linkedItem.itemId);
              const needsListenerRefresh =
                managedMarker.firstLinkedItemId !== firstLinkedItemId
                || managedMarker.linkedItemIds.join("|") !== nextLinkedItemIds.join("|");

              if (needsListenerRefresh) {
                managedMarker.clickListener?.remove();
                managedMarker.clickListener = managedMarker.marker.addListener("click", () => {
                  if (!firstLinkedItemId) {
                    return;
                  }

                  onActivate(firstLinkedItemId);
                });
              }

              managedMarker.linkedItemIds = nextLinkedItemIds;
              managedMarker.firstLinkedItemId = firstLinkedItemId;

              if (managedMarker.selected !== selected) {
                applyMarkerSelectionStyling(managedMarker.pinElement, selected);
                managedMarker.selected = selected;
              }
            },
            remove(managedMarker) {
              managedMarker.clickListener?.remove();
              managedMarker.clickListener = null;
              managedMarker.contentElement.removeEventListener("keydown", managedMarker.onKeyDown);
              managedMarker.marker.map = null;
            },
          },
        });

        applyInitialViewport(markers);
        applySelectionFocus(markers);
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
  }, [config, hasMapReadySignal, markers, selectedItemId]);

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
          hasInitializationFailureRef.current = true;
          isInitializingRef.current = false;
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

      markerStateRef.current = reconcileMarkers({
        current: markerStateRef.current,
        markers: [],
        selectedItemId: null,
        onActivate: (itemId) => {
          onMarkerActivateRef.current(itemId);
        },
        adapter: {
          create() {
            throw new Error("marker adapter unavailable during teardown");
          },
          update() {
          },
          remove(managedMarker) {
            managedMarker.clickListener?.remove();
            managedMarker.clickListener = null;
            managedMarker.contentElement.removeEventListener("keydown", managedMarker.onKeyDown);
            managedMarker.marker.map = null;
          },
        },
      });

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
            className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-xl border border-border-subtle bg-bg-elevated/95 px-3 py-2 text-xs text-text-secondary"
          >
            No verified places available for map markers.
          </div>
        ) : null}
      </div>
    </aside>
  );
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
