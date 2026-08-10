import assert from "node:assert/strict";

import {
  activateSelectedItem,
  applySelectedMarkerFocus,
  applyViewportInstruction,
  buildMarkerPayloadSignature,
  deriveEffectiveSelectedItemId,
  deriveGeneratedMapMarkers,
  deriveInteractiveItemIds,
  deriveMarkerEligibilityRefreshDelayMs,
  deriveMarkerPressedState,
  deriveMarkerViewportInstruction,
  deriveNextMarkerEligibilityExpiryEpoch,
  deriveSelectedMarkerFocus,
  reconcileMarkerInteractionBinding,
  reconcileMarkers,
  removeMarkerInteractionBinding,
  resolveSelectedMarker,
  shouldClearSelectedItem,
  type GeneratedMapMarkerView,
  type MarkerInteractionBindingState,
  type MarkerReconcilerAdapter,
} from "@/lib/maps/generated-map-markers";
import {
  deriveGeneratedMapPanelStatus,
  deriveMapInteractionReady,
} from "@/lib/maps/google-maps-foundation";
import {
  parsePersistedItinerary,
  type PersistedItinerary,
} from "@/lib/planning-sessions/types";

interface FakeReconciledMarker {
  placeId: string;
  selected: boolean;
  pressedHistory: Array<"true" | "false">;
}

function createFixtureItinerary(): PersistedItinerary {
  const itinerary = parsePersistedItinerary({
    title: "Fixture",
    summary: "Feature 20",
    days: [
      {
        id: "day-2",
        dayNumber: 2,
        dayLabel: "Day 2",
        summary: null,
        items: [
          {
            id: "d2-1",
            order: 1,
            type: "PLACE",
            title: "Tokyo Station revisit",
            description: "return stop",
            planningText: "return stop",
            placeSearchQuery: "tokyo",
            placeReference: {
              provider: "GOOGLE",
              placeId: "places/tokyo",
              latitude: 35.6812,
              longitude: 139.7671,
              coordinatesCachedAt: "2031-01-01T00:00:00.000Z",
              coordinatesExpireAt: "2031-02-01T00:00:00.000Z",
            },
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
        ],
      },
      {
        id: "day-1",
        dayNumber: 1,
        dayLabel: "Day 1",
        summary: null,
        items: [
          {
            id: "d1-1",
            order: 1,
            type: "PLACE",
            title: "Tokyo Station",
            description: "arrival",
            planningText: "arrival",
            placeSearchQuery: "tokyo",
            placeReference: {
              provider: "GOOGLE",
              placeId: "places/tokyo",
              latitude: 35.6812,
              longitude: 139.7671,
              coordinatesCachedAt: "2031-01-01T00:00:00.000Z",
              coordinatesExpireAt: "2031-02-01T00:00:00.000Z",
            },
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
          {
            id: "d1-2",
            order: 2,
            type: "PLACE",
            title: "Kyoto Station",
            description: "transfer",
            planningText: "transfer",
            placeSearchQuery: "kyoto",
            placeReference: {
              provider: "GOOGLE",
              placeId: "places/kyoto",
              latitude: 34.9855,
              longitude: 135.7587,
              coordinatesCachedAt: "2031-01-01T00:00:00.000Z",
              coordinatesExpireAt: "2031-02-01T00:00:00.000Z",
            },
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
          {
            id: "d1-3",
            order: 3,
            type: "ACTIVITY",
            title: "Unverified",
            description: "walk",
            planningText: "walk",
            placeSearchQuery: null,
            placeReference: null,
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
          {
            id: "d1-4",
            order: 4,
            type: "PLACE",
            title: "Invalid lat",
            description: "invalid",
            planningText: "invalid",
            placeSearchQuery: "invalid",
            placeReference: {
              provider: "GOOGLE",
              placeId: "places/invalid",
              latitude: 35.7,
              longitude: 139.7,
              coordinatesCachedAt: "2031-01-01T00:00:00.000Z",
              coordinatesExpireAt: "2031-02-01T00:00:00.000Z",
            },
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
        ],
      },
    ],
  });

  if (!itinerary) {
    throw new Error("fixture parse failed");
  }

  itinerary.days[1]!.items[3]!.placeReference = {
    ...itinerary.days[1]!.items[3]!.placeReference!,
    latitude: 200,
  };

  return itinerary;
}

function testMarkerDerivationAndOrdering() {
  const markers = deriveGeneratedMapMarkers({
    itinerary: createFixtureItinerary(),
    now: new Date("2031-01-15T00:00:00.000Z"),
  });

  assert.deepEqual(markers.map((m) => m.placeId), ["places/tokyo", "places/kyoto"]);
  assert.equal(markers[0]?.markerTitle, "Tokyo Station (2 linked items)");
  assert.deepEqual(markers[0]?.linkedItems.map((item) => item.itemId), ["d1-1", "d2-1"]);

  const interactiveIds = deriveInteractiveItemIds(markers);
  assert.equal(interactiveIds.has("d1-3"), false);
  assert.equal(interactiveIds.has("d1-1"), true);
}

function testViewportAndFocus() {
  const markers = deriveGeneratedMapMarkers({
    itinerary: createFixtureItinerary(),
    now: new Date("2031-01-15T00:00:00.000Z"),
  });

  assert.deepEqual(deriveMarkerViewportInstruction([]), { kind: "NONE" });
  assert.equal(deriveMarkerViewportInstruction([markers[0]!]).kind, "SINGLE");
  const ordinaryBounds = deriveMarkerViewportInstruction(markers);
  assert.equal(ordinaryBounds.kind, "BOUNDS");
  if (ordinaryBounds.kind === "BOUNDS") {
    assert.equal(ordinaryBounds.bounds.west <= ordinaryBounds.bounds.east, true);
    assert.equal(ordinaryBounds.bounds.west, 135.7587);
    assert.equal(ordinaryBounds.bounds.east, 139.7671);
  }

  const antimeridianBounds = deriveMarkerViewportInstruction([
    {
      placeId: "east",
      latitude: 10,
      longitude: 179,
      markerTitle: "east",
      linkedItems: [{ itemId: "east-1", dayNumber: 1, itemOrder: 1, title: "east" }],
    },
    {
      placeId: "west",
      latitude: 12,
      longitude: -179,
      markerTitle: "west",
      linkedItems: [{ itemId: "west-1", dayNumber: 1, itemOrder: 2, title: "west" }],
    },
  ]);

  assert.equal(antimeridianBounds.kind, "BOUNDS");
  if (antimeridianBounds.kind === "BOUNDS") {
    assert.equal(antimeridianBounds.bounds.west, 179);
    assert.equal(antimeridianBounds.bounds.east, 181);
    assert.equal(antimeridianBounds.bounds.east - antimeridianBounds.bounds.west, 2);
  }

  const sigA = buildMarkerPayloadSignature(markers);
  const sigB = buildMarkerPayloadSignature(markers);
  assert.equal(sigA === sigB, true);

  let panCalls = 0;
  let zoomCalls = 0;
  let boundsCalls = 0;

  applyViewportInstruction({
    adapter: {
      panTo() {
        panCalls += 1;
      },
      setZoom() {
        zoomCalls += 1;
      },
      fitBounds() {
        boundsCalls += 1;
      },
    },
    instruction: { kind: "SINGLE", latitude: 35.6, longitude: 139.7, zoom: 13 },
    paddingPx: 80,
  });

  applyViewportInstruction({
    adapter: {
      panTo() {
        panCalls += 1;
      },
      setZoom() {
        zoomCalls += 1;
      },
      fitBounds() {
        boundsCalls += 1;
      },
    },
    instruction: {
      kind: "BOUNDS",
      bounds: { north: 36, south: 35, east: 140, west: 139 },
    },
    paddingPx: 80,
  });

  assert.equal(panCalls, 1);
  assert.equal(zoomCalls, 1);
  assert.equal(boundsCalls, 1);

  const focus = deriveSelectedMarkerFocus({ markers, selectedItemId: "d2-1" });
  assert.notEqual(focus, null);

  let focusPanCalls = 0;
  let focusZoomCalls = 0;
  const focused = applySelectedMarkerFocus({
    adapter: {
      panTo() {
        focusPanCalls += 1;
      },
      getZoom() {
        return 5;
      },
      setZoom() {
        focusZoomCalls += 1;
      },
    },
    focusTarget: focus,
  });

  assert.equal(focused, true);
  assert.equal(focusPanCalls, 1);
  assert.equal(focusZoomCalls, 1);
}

function testRepeatedActivationAndSelectionCleanup() {
  const activation = activateSelectedItem({
    state: { selectedItemId: "d1-1", activationVersion: 8 },
    itemId: "d1-1",
  });
  assert.equal(activation.selectedItemId, "d1-1");
  assert.equal(activation.activationVersion, 9);

  const markers = deriveGeneratedMapMarkers({
    itinerary: createFixtureItinerary(),
    now: new Date("2031-01-15T00:00:00.000Z"),
  });

  const interactive = deriveInteractiveItemIds(markers);
  const effective = deriveEffectiveSelectedItemId({
    selectedItemId: "d1-1",
    isMapLinkedInteractionEnabled: true,
    interactiveItemIds: interactive,
  });
  assert.equal(effective, "d1-1");

  const missing = deriveEffectiveSelectedItemId({
    selectedItemId: "missing",
    isMapLinkedInteractionEnabled: true,
    interactiveItemIds: interactive,
  });
  assert.equal(missing, null);
  assert.equal(
    shouldClearSelectedItem({ selectedItemId: "missing", effectiveSelectedItemId: missing }),
    true,
  );

  assert.equal(resolveSelectedMarker({ markers, selectedItemId: "d2-1" }).selectedPlaceId, "places/tokyo");
}

function testExpiryRearmAndCleanup() {
  const itinerary = createFixtureItinerary();
  const beforeExpiry = Date.parse("2031-01-31T23:59:59.000Z");
  const atExpiry = Date.parse("2031-02-01T00:00:00.000Z");

  const nextExpiry = deriveNextMarkerEligibilityExpiryEpoch({
    itinerary,
    nowEpoch: beforeExpiry,
  });

  assert.equal(nextExpiry, Date.parse("2031-02-01T00:00:00.000Z"));
  assert.equal(
    deriveMarkerEligibilityRefreshDelayMs({
      nextExpiryEpoch: nextExpiry,
      nowEpoch: beforeExpiry,
      maxDelayMs: 2_147_483_647,
    }),
    1000,
  );

  assert.equal(
    deriveMarkerEligibilityRefreshDelayMs({
      nextExpiryEpoch: beforeExpiry + 6000,
      nowEpoch: beforeExpiry,
      maxDelayMs: 1200,
    }),
    1200,
  );

  const expiredMarkers = deriveGeneratedMapMarkers({
    itinerary,
    now: new Date(atExpiry),
  });

  assert.equal(expiredMarkers.length, 0);
}

function testSingleActivationPathBinding() {
  let binding: MarkerInteractionBindingState | null = null;
  let clickSetCount = 0;
  let clickHandler: (() => void) | null = null;
  const activations: string[] = [];

  const adapter = {
    setClickHandler(handler: (() => void) | null) {
      clickSetCount += 1;
      clickHandler = handler;
    },
  };

  binding = reconcileMarkerInteractionBinding({
    current: binding,
    adapter,
    firstLinkedItemId: "item-1",
    onActivate(itemId) {
      activations.push(itemId);
    },
  });

  assert.notEqual(clickHandler, null);

  binding?.clickHandler?.();

  binding = reconcileMarkerInteractionBinding({
    current: binding,
    adapter,
    firstLinkedItemId: "item-2",
    onActivate(itemId) {
      activations.push(itemId);
    },
  });

  binding?.clickHandler?.();

  binding = removeMarkerInteractionBinding({ current: binding, adapter });

  assert.equal(binding, null);
  assert.equal(clickHandler, null);
  assert.equal(clickSetCount, 2);
  assert.deepEqual(activations, ["item-1", "item-2"]);
}

function testReconciliationPressedStateSync() {
  const markers = deriveGeneratedMapMarkers({
    itinerary: createFixtureItinerary(),
    now: new Date("2031-01-15T00:00:00.000Z"),
  });

  const adapter: MarkerReconcilerAdapter<FakeReconciledMarker> = {
    create({ marker, selected }) {
      return {
        placeId: marker.placeId,
        selected,
        pressedHistory: [deriveMarkerPressedState(selected)],
      };
    },
    update({ marker, selected }) {
      marker.selected = selected;
      marker.pressedHistory.push(deriveMarkerPressedState(selected));
    },
    remove() {
    },
  };

  let state = { markersByPlaceId: new Map<string, FakeReconciledMarker>() };

  state = reconcileMarkers({
    current: state,
    markers,
    selectedItemId: null,
    onActivate() {
    },
    adapter,
  });

  state = reconcileMarkers({
    current: state,
    markers,
    selectedItemId: "d1-1",
    onActivate() {
    },
    adapter,
  });

  state = reconcileMarkers({
    current: state,
    markers,
    selectedItemId: null,
    onActivate() {
    },
    adapter,
  });

  const tokyo = state.markersByPlaceId.get("places/tokyo");
  assert.deepEqual(tokyo?.pressedHistory, ["false", "true", "false"]);
}

function testMarkerLifecycleReconciliationWithFakes() {
  interface FakeManagedMarker {
    placeId: string;
    selected: boolean;
    latitude: number;
    firstLinkedItemId: string | null;
    binding: MarkerInteractionBindingState | null;
    clickSetCount: number;
    clickHandler: (() => void) | null;
  }

  const baseMarkers = deriveGeneratedMapMarkers({
    itinerary: createFixtureItinerary(),
    now: new Date("2031-01-15T00:00:00.000Z"),
  });

  const updatedMarkers: GeneratedMapMarkerView[] = [
    {
      ...baseMarkers[0]!,
      latitude: baseMarkers[0]!.latitude + 0.25,
      linkedItems: [
        {
          ...baseMarkers[0]!.linkedItems[1]!,
        },
        {
          ...baseMarkers[0]!.linkedItems[0]!,
        },
      ],
    },
    baseMarkers[1]!,
  ];

  const replacementMarkers: GeneratedMapMarkerView[] = [updatedMarkers[1]!];

  const createCalls: string[] = [];
  const updateCalls: string[] = [];
  const removeCalls: string[] = [];
  const activationCalls: string[] = [];

  const adapter: MarkerReconcilerAdapter<FakeManagedMarker> = {
    create({ marker, selected, onActivate }) {
      createCalls.push(marker.placeId);
      const managed: FakeManagedMarker = {
        placeId: marker.placeId,
        selected,
        latitude: marker.latitude,
        firstLinkedItemId: marker.linkedItems[0]?.itemId ?? null,
        binding: null,
        clickSetCount: 0,
        clickHandler: null,
      };

      managed.binding = reconcileMarkerInteractionBinding({
        current: managed.binding,
        firstLinkedItemId: managed.firstLinkedItemId,
        onActivate,
        adapter: {
          setClickHandler(handler) {
            managed.clickSetCount += 1;
            managed.clickHandler = handler;
          },
        },
      });

      return managed;
    },
    update({ marker, next, selected, onActivate }) {
      updateCalls.push(next.placeId);
      marker.selected = selected;
      marker.latitude = next.latitude;
      marker.firstLinkedItemId = next.linkedItems[0]?.itemId ?? null;

      marker.binding = reconcileMarkerInteractionBinding({
        current: marker.binding,
        firstLinkedItemId: marker.firstLinkedItemId,
        onActivate,
        adapter: {
          setClickHandler(handler) {
            marker.clickSetCount += 1;
            marker.clickHandler = handler;
          },
        },
      });
    },
    remove(marker) {
      removeCalls.push(marker.placeId);
      marker.binding = removeMarkerInteractionBinding({
        current: marker.binding,
        adapter: {
          setClickHandler(handler) {
            marker.clickSetCount += 1;
            marker.clickHandler = handler;
          },
        },
      });
    },
  };

  let state = { markersByPlaceId: new Map<string, FakeManagedMarker>() };

  state = reconcileMarkers({
    current: state,
    markers: baseMarkers,
    selectedItemId: null,
    onActivate(itemId) {
      activationCalls.push(itemId);
    },
    adapter,
  });

  assert.deepEqual(createCalls, ["places/tokyo", "places/kyoto"]);
  const initialTokyo = state.markersByPlaceId.get("places/tokyo");
  const initialKyoto = state.markersByPlaceId.get("places/kyoto");
  assert.notEqual(initialTokyo, undefined);
  assert.notEqual(initialKyoto, undefined);
  assert.equal(initialTokyo?.clickSetCount, 1);
  assert.equal(initialKyoto?.clickSetCount, 1);

  state = reconcileMarkers({
    current: state,
    markers: baseMarkers,
    selectedItemId: null,
    onActivate(itemId) {
      activationCalls.push(itemId);
    },
    adapter,
  });

  assert.deepEqual(createCalls, ["places/tokyo", "places/kyoto"]);
  assert.equal(state.markersByPlaceId.get("places/tokyo"), initialTokyo);
  assert.equal(state.markersByPlaceId.get("places/kyoto"), initialKyoto);
  assert.equal(initialTokyo?.clickSetCount, 1);
  assert.equal(initialKyoto?.clickSetCount, 1);

  state = reconcileMarkers({
    current: state,
    markers: updatedMarkers,
    selectedItemId: "d2-1",
    onActivate(itemId) {
      activationCalls.push(itemId);
    },
    adapter,
  });

  const updatedTokyo = state.markersByPlaceId.get("places/tokyo");
  assert.equal(updatedTokyo, initialTokyo);
  assert.equal(updatedTokyo?.selected, true);
  assert.equal(updatedTokyo?.latitude, baseMarkers[0]!.latitude + 0.25);
  assert.equal(updatedTokyo?.firstLinkedItemId, "d2-1");
  assert.equal(updatedTokyo?.clickSetCount, 1);
  assert.equal(updateCalls.includes("places/tokyo"), true);

  updatedTokyo?.clickHandler?.();
  assert.equal(activationCalls.includes("d2-1"), true);

  state = reconcileMarkers({
    current: state,
    markers: replacementMarkers,
    selectedItemId: null,
    onActivate(itemId) {
      activationCalls.push(itemId);
    },
    adapter,
  });

  assert.deepEqual(removeCalls, ["places/tokyo"]);
  assert.equal(state.markersByPlaceId.has("places/tokyo"), false);
  assert.equal(initialTokyo?.clickSetCount, 2);

  state = reconcileMarkers({
    current: state,
    markers: [],
    selectedItemId: null,
    onActivate(itemId) {
      activationCalls.push(itemId);
    },
    adapter,
  });

  assert.deepEqual(removeCalls, ["places/tokyo", "places/kyoto"]);
  assert.equal(state.markersByPlaceId.size, 0);
  assert.equal(initialKyoto?.clickSetCount, 2);
}

function testReadinessLossAfterFailure() {
  const ready = deriveGeneratedMapPanelStatus({
    hasConfig: true,
    hasAuthFailure: false,
    hasLoadFailure: false,
    hasRenderFailure: false,
    hasMapReadySignal: true,
  });
  assert.equal(deriveMapInteractionReady(ready), true);

  const failed = deriveGeneratedMapPanelStatus({
    hasConfig: true,
    hasAuthFailure: false,
    hasLoadFailure: true,
    hasRenderFailure: false,
    hasMapReadySignal: true,
  });
  assert.equal(failed, "error");
  assert.equal(deriveMapInteractionReady(failed), false);
}

function run() {
  testMarkerDerivationAndOrdering();
  testViewportAndFocus();
  testRepeatedActivationAndSelectionCleanup();
  testExpiryRearmAndCleanup();
  testSingleActivationPathBinding();
  testReconciliationPressedStateSync();
  testMarkerLifecycleReconciliationWithFakes();
  testReadinessLossAfterFailure();

  console.log("map-markers-kanban-sync-regression: pass");
}

run();
