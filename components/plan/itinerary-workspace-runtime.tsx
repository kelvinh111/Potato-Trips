"use client";

/* eslint-disable react-hooks/refs */

import { useCallback, useEffect, useMemo, useState } from "react";

import { GeneratedMapPanel } from "@/components/plan/generated-map-panel";
import { ItineraryKanbanBoard } from "@/components/plan/itinerary-kanban-board";
import { LocationDetailPanel } from "@/components/plan/location-detail-panel";
import { PlanningChatPanel } from "@/components/plan/planning-chat-panel";
import { TripPlanStatusPanel } from "@/components/plan/trip-plan-status-panel";
import {
  activateSelectedItem,
  deriveMarkerEligibilityRefreshDelayMs,
  deriveNextMarkerEligibilityExpiryEpoch,
  deriveEffectiveSelectedItemId,
  deriveGeneratedMapMarkers,
  deriveInteractiveItemIds,
  MAX_BROWSER_TIMER_DELAY_MS,
} from "@/lib/maps/generated-map-markers";
import {
  WORKSPACE_DESKTOP_MEDIA_QUERY,
  shouldDisplayGeneratedDesktopMapPanel,
} from "@/lib/maps/google-maps-foundation";
import {
  usePlanningSessionGenerationController,
} from "@/lib/planning-sessions/generation-controller";
import {
  findCanonicalItineraryItemContext,
} from "@/lib/planning-sessions/itinerary-kanban";
import { useDesktopCenterMapSplit } from "@/lib/planning-sessions/workspace-layout-sizing";
import type { PlanningSessionRecord } from "@/lib/planning-sessions/repository";

interface ItineraryWorkspaceRuntimeProps {
  session: PlanningSessionRecord;
}

type CenterPanelState =
  | { kind: "ITINERARY" }
  | { kind: "LOCATION_DETAIL"; itemId: string; activationVersion: number };

export function ItineraryWorkspaceRuntime({ session }: ItineraryWorkspaceRuntimeProps) {
  const generationController = usePlanningSessionGenerationController({
    sessionId: session.id,
    initialSessionState: {
      status: session.status,
      clarificationMessages: session.clarificationMessages,
      planningBrief: session.planningBrief,
      generationPhase: session.generationPhase,
      generatedItinerary: session.generatedItinerary,
      generationAttempts: session.generationAttempts,
      generationError: session.generationError,
    },
  });
  const state = generationController.sessionState;
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectionActivationVersion, setSelectionActivationVersion] = useState(0);
  const [markerEligibilityNowEpoch, setMarkerEligibilityNowEpoch] = useState(() => Date.now());
  const [isMapReady, setIsMapReady] = useState(false);
  const [hoverPreviewItemId, setHoverPreviewItemId] = useState<string | null>(null);
  const [centerPanel, setCenterPanel] = useState<CenterPanelState>({
    kind: "ITINERARY",
  });
  const [focusRestore, setFocusRestore] = useState<{
    titleElementId: string | null;
    version: number;
  }>({ titleElementId: null, version: 0 });

  useEffect(() => {
    const mediaQueryList = window.matchMedia(WORKSPACE_DESKTOP_MEDIA_QUERY);

    const updateDesktopLayout = () => {
      setIsDesktopLayout(mediaQueryList.matches);
    };

    updateDesktopLayout();

    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", updateDesktopLayout);
    } else {
      mediaQueryList.addListener(updateDesktopLayout);
    }

    return () => {
      if (typeof mediaQueryList.removeEventListener === "function") {
        mediaQueryList.removeEventListener("change", updateDesktopLayout);
      } else {
        mediaQueryList.removeListener(updateDesktopLayout);
      }
    };
  }, []);

  const showStatusPanel = useMemo(() => state.status !== "GENERATED", [state.status]);
  const showMapSlot = useMemo(() => {
    return shouldDisplayGeneratedDesktopMapPanel(state.status, isDesktopLayout);
  }, [state.status, isDesktopLayout]);

  const markers = useMemo(() => {
    return deriveGeneratedMapMarkers({
      itinerary: state.generatedItinerary,
      now: new Date(markerEligibilityNowEpoch),
    });
  }, [markerEligibilityNowEpoch, state.generatedItinerary]);

  const interactiveItemIds = useMemo(() => {
    return deriveInteractiveItemIds(markers);
  }, [markers]);

  const itineraryItemIds = useMemo(() => {
    const itemIds = new Set<string>();

    if (!state.generatedItinerary) {
      return itemIds;
    }

    for (const day of state.generatedItinerary.days) {
      for (const item of day.items) {
        itemIds.add(item.id);
      }
    }

    return itemIds;
  }, [state.generatedItinerary]);

  const isMapLinkedInteractionEnabled = showMapSlot && isMapReady;

  const effectiveSelectedItemId = deriveEffectiveSelectedItemId({
    selectedItemId,
    isMapLinkedInteractionEnabled,
    interactiveItemIds,
  });

  const effectivePreviewItemId = useMemo(() => {
    if (!isMapLinkedInteractionEnabled || !hoverPreviewItemId) {
      return null;
    }

    return interactiveItemIds.has(hoverPreviewItemId) ? hoverPreviewItemId : null;
  }, [hoverPreviewItemId, interactiveItemIds, isMapLinkedInteractionEnabled]);

  const focusedMapItemId = effectivePreviewItemId ?? effectiveSelectedItemId;

  const handleSelectItem = useCallback((itemId: string) => {
    const next = activateSelectedItem({
      state: {
        selectedItemId,
        activationVersion: selectionActivationVersion,
      },
      itemId,
    });

    setSelectedItemId(next.selectedItemId);
    setSelectionActivationVersion(next.activationVersion);
  }, [selectedItemId, selectionActivationVersion]);

  const handleActivateLocationDetailItem = useCallback((itemId: string) => {
    const nextSelection = activateSelectedItem({
      state: {
        selectedItemId,
        activationVersion: selectionActivationVersion,
      },
      itemId,
    });

    setSelectedItemId(nextSelection.selectedItemId);
    setSelectionActivationVersion(nextSelection.activationVersion);
    setHoverPreviewItemId(null);

    setCenterPanel((previous) => {
      const nextActivationVersion =
        previous.kind === "LOCATION_DETAIL" ? previous.activationVersion + 1 : 1;

      return {
        kind: "LOCATION_DETAIL",
        itemId,
        activationVersion: nextActivationVersion,
      };
    });
  }, [selectedItemId, selectionActivationVersion]);

  const handleCloseLocationDetail = useCallback(() => {
    if (centerPanel.kind === "LOCATION_DETAIL") {
      setFocusRestore((stateValue) => ({
        titleElementId: `itinerary-item-title-${centerPanel.itemId}`,
        version: stateValue.version + 1,
      }));
    }

    setCenterPanel({ kind: "ITINERARY" });
  }, [centerPanel]);

  const handleMapReadyChange = useCallback((ready: boolean) => {
    setIsMapReady(ready);
  }, []);

  const handlePreviewInteractiveItem = useCallback((itemId: string | null) => {
    setHoverPreviewItemId(itemId);
  }, []);

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }

    if (itineraryItemIds.has(selectedItemId)) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSelectedItemId(null);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [itineraryItemIds, selectedItemId]);

  useEffect(() => {
    if (state.status === "GENERATED") {
      return;
    }

    const timerId = window.setTimeout(() => {
      setCenterPanel({ kind: "ITINERARY" });
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [state.status]);

  useEffect(() => {
    if (centerPanel.kind !== "LOCATION_DETAIL") {
      return;
    }

    const detailContext = state.generatedItinerary
      ? findCanonicalItineraryItemContext({
        itinerary: state.generatedItinerary,
        itemId: centerPanel.itemId,
      })
      : null;

    if (detailContext) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setCenterPanel({ kind: "ITINERARY" });
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [centerPanel, state.generatedItinerary]);

  useEffect(() => {
    if (isMapLinkedInteractionEnabled) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHoverPreviewItemId(null);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isMapLinkedInteractionEnabled]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setMarkerEligibilityNowEpoch(Date.now());
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [state.generatedItinerary]);

  useEffect(() => {
    const nowEpoch = Date.now();
    const nextExpiryEpoch = deriveNextMarkerEligibilityExpiryEpoch({
      itinerary: state.generatedItinerary,
      nowEpoch,
    });
    const refreshDelayMs = deriveMarkerEligibilityRefreshDelayMs({
      nextExpiryEpoch,
      nowEpoch,
      maxDelayMs: MAX_BROWSER_TIMER_DELAY_MS,
    });

    if (refreshDelayMs === null) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setMarkerEligibilityNowEpoch(Date.now());
    }, refreshDelayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [state.generatedItinerary, markerEligibilityNowEpoch]);

  const desktopSplit = useDesktopCenterMapSplit({
    isDesktopLayout,
    showMapSlot,
  });
  const desktopContainerRef = desktopSplit.containerRef;
  const desktopLayout = desktopSplit.layout;
  const handleSeparatorKeyDown = desktopSplit.handleSeparatorKeyDown;
  const handleSeparatorPointerDown = desktopSplit.handleSeparatorPointerDown;
  const handleSeparatorPointerMove = desktopSplit.handleSeparatorPointerMove;
  const handleSeparatorPointerUp = desktopSplit.handleSeparatorPointerUp;

  const mobileGridClassName = showMapSlot
    ? "grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[minmax(18rem,1fr)_minmax(18rem,1fr)] gap-3 overflow-x-hidden overflow-y-auto p-3 sm:gap-4 sm:p-4"
    : "grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[minmax(18rem,1fr)_minmax(18rem,1fr)] gap-3 overflow-x-hidden overflow-y-auto p-3 sm:gap-4 sm:p-4";

  const desktopChatStyle = desktopLayout
    ? { width: `${desktopLayout.chatWidth}px` }
    : undefined;
  const desktopCenterStyle = desktopLayout
    ? { width: `${desktopLayout.centerWidth}px` }
    : undefined;
  const desktopMapStyle = desktopLayout
    ? { width: `${desktopLayout.mapWidth}px` }
    : undefined;

  return (
    <main className="flex min-h-0 flex-1 overflow-hidden">
      <div className="hidden min-h-0 w-full flex-1 gap-4 overflow-hidden p-4 lg:flex" ref={desktopContainerRef}>
        <div className="min-h-0 shrink-0" style={desktopChatStyle}>
          <PlanningChatPanel
            sessionId={session.id}
            initialPrompt={session.initialPrompt}
            status={state.status}
            clarificationMessages={state.clarificationMessages}
            onSessionUpdate={generationController.applyClarificationSession}
          />
        </div>

        <div className="min-h-0 shrink-0" style={desktopCenterStyle}>
          {showStatusPanel ? (
            <TripPlanStatusPanel generationController={generationController} />
          ) : (
            <section
              aria-label="Itinerary panel"
              className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[2rem] border-0 bg-column-center"
            >
              <h1 className="sr-only">Itinerary Plan</h1>
              {centerPanel.kind === "LOCATION_DETAIL" ? (
                <LocationDetailPanel
                  key={`${centerPanel.itemId}:${centerPanel.activationVersion}`}
                  sessionId={session.id}
                  itinerary={state.generatedItinerary}
                  itemId={centerPanel.itemId}
                  activationVersion={centerPanel.activationVersion}
                  onClose={handleCloseLocationDetail}
                />
              ) : (
                <ItineraryKanbanBoard
                  itinerary={state.generatedItinerary}
                  selectedItemId={selectedItemId}
                  selectionActivationVersion={selectionActivationVersion}
                  interactiveItemIds={interactiveItemIds}
                  isMapLinkedInteractionEnabled={isMapLinkedInteractionEnabled}
                  focusRestoreElementId={focusRestore.titleElementId}
                  focusRestoreVersion={focusRestore.version}
                  onActivateLocationDetailItem={handleActivateLocationDetailItem}
                  onPreviewInteractiveItem={handlePreviewInteractiveItem}
                  onActivateInteractiveItem={handleSelectItem}
                />
              )}
            </section>
          )}
        </div>

        {showMapSlot && desktopLayout ? (
          <div
            role="separator"
            aria-label="Resize itinerary and map panels"
            aria-orientation="vertical"
            aria-valuemin={desktopLayout.separatorMin}
            aria-valuemax={desktopLayout.separatorMax}
            aria-valuenow={desktopLayout.separatorValue}
            tabIndex={0}
            onKeyDown={handleSeparatorKeyDown}
            onPointerDown={handleSeparatorPointerDown}
            onPointerMove={handleSeparatorPointerMove}
            onPointerUp={handleSeparatorPointerUp}
            onPointerCancel={handleSeparatorPointerUp}
            className="w-2 cursor-col-resize rounded-full bg-border-subtle/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
          />
        ) : null}

        {showMapSlot ? (
          <div className="min-h-0 min-w-0 flex-1" style={desktopMapStyle}>
            <GeneratedMapPanel
              markers={markers}
              selectedItemId={effectiveSelectedItemId}
              focusedItemId={focusedMapItemId}
              selectionActivationVersion={selectionActivationVersion}
              onMarkerActivate={handleSelectItem}
              onMapReadyChange={handleMapReadyChange}
            />
          </div>
        ) : null}
      </div>

      <div className={`${mobileGridClassName} lg:hidden`}>
        <PlanningChatPanel
          sessionId={session.id}
          initialPrompt={session.initialPrompt}
          status={state.status}
          clarificationMessages={state.clarificationMessages}
          onSessionUpdate={generationController.applyClarificationSession}
        />
        {showStatusPanel ? (
          <TripPlanStatusPanel generationController={generationController} />
        ) : (
          <section
            aria-label="Itinerary panel"
            className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[2rem] border-0 bg-column-center"
          >
            <h1 className="sr-only">Itinerary Plan</h1>
            {centerPanel.kind === "LOCATION_DETAIL" ? (
              <LocationDetailPanel
                key={`${centerPanel.itemId}:${centerPanel.activationVersion}`}
                sessionId={session.id}
                itinerary={state.generatedItinerary}
                itemId={centerPanel.itemId}
                activationVersion={centerPanel.activationVersion}
                onClose={handleCloseLocationDetail}
              />
            ) : (
              <ItineraryKanbanBoard
                itinerary={state.generatedItinerary}
                selectedItemId={selectedItemId}
                selectionActivationVersion={selectionActivationVersion}
                interactiveItemIds={interactiveItemIds}
                isMapLinkedInteractionEnabled={isMapLinkedInteractionEnabled}
                focusRestoreElementId={focusRestore.titleElementId}
                focusRestoreVersion={focusRestore.version}
                onActivateLocationDetailItem={handleActivateLocationDetailItem}
                onPreviewInteractiveItem={handlePreviewInteractiveItem}
                onActivateInteractiveItem={handleSelectItem}
              />
            )}
          </section>
        )}
        {showMapSlot ? (
          <GeneratedMapPanel
            markers={markers}
            selectedItemId={effectiveSelectedItemId}
            focusedItemId={focusedMapItemId}
            selectionActivationVersion={selectionActivationVersion}
            onMarkerActivate={handleSelectItem}
            onMapReadyChange={handleMapReadyChange}
          />
        ) : null}
      </div>
    </main>
  );
}
