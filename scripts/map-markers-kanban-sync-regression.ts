import assert from "node:assert/strict";

import {
  applySelectedMarkerFocus,
  applyViewportInstruction,
  buildMarkerPayloadSignature,
  deriveEffectiveSelectedItemId,
  deriveGeneratedMapMarkers,
  deriveInteractiveItemIds,
  deriveMarkerViewportInstruction,
  deriveSelectedMarkerFocus,
  reconcileMarkerInteractionBinding,
  reconcileMarkers,
  removeMarkerInteractionBinding,
  resolveSelectedMarker,
  shouldResetInitialViewport,
  type MarkerInteractionBindingState,
  type GeneratedMapMarkerView,
  type MarkerReconcilerAdapter,
} from "@/lib/maps/generated-map-markers";
import { parsePersistedItinerary, type PersistedItinerary } from "@/lib/planning-sessions/types";

interface FakeMarker {
  placeId: string;
  selected: boolean;
  linkedItemIds: string[];
  disposed: boolean;
  updates: number;
}

function createFixtureItinerary(): PersistedItinerary {
  const parsed = parsePersistedItinerary({
    title: "Marker fixture",
    summary: "Feature 20",
    days: [
      {
        id: "day-2",
        dayNumber: 2,
        dayLabel: "Day 2",
        summary: null,
        items: [
          {
            id: "day-2-item-1",
            order: 1,
            type: "PLACE",
            title: "Tokyo Station revisit",
            description: "Second stop",
            planningText: "Return stop",
            placeSearchQuery: "Tokyo Station",
            placeReference: {
              provider: "GOOGLE",
              placeId: "places/tokyo-station",
              latitude: 35.6812,
              longitude: 139.7671,
              coordinatesCachedAt: "2031-01-01T00:00:00.000Z",
              coordinatesExpireAt: "2031-02-01T00:00:00.000Z",
            },
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
          {
            id: "day-2-item-2",
            order: 2,
            type: "PLACE",
            title: "Expired place",
            description: "Should not appear",
            planningText: "Expired",
            placeSearchQuery: "Expired",
            placeReference: {
              provider: "GOOGLE",
              placeId: "places/expired",
              latitude: 35.0,
              longitude: 139.0,
              coordinatesCachedAt: "2031-01-01T00:00:00.000Z",
              coordinatesExpireAt: "2020-01-01T00:00:00.000Z",
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
            id: "day-1-item-1",
            order: 1,
            type: "PLACE",
            title: "Tokyo Station",
            description: "Primary stop",
            planningText: "Start",
            placeSearchQuery: "Tokyo Station",
            placeReference: {
              provider: "GOOGLE",
              placeId: "places/tokyo-station",
              latitude: 35.6812,
              longitude: 139.7671,
              coordinatesCachedAt: "2031-01-01T00:00:00.000Z",
              coordinatesExpireAt: "2031-02-01T00:00:00.000Z",
            },
            suggestedTime: "09:00",
            suggestedDurationMinutes: 60,
          },
          {
            id: "day-1-item-2",
            order: 2,
            type: "PLACE",
            title: "Invalid coordinate",
            description: "Should be ignored",
            planningText: "Invalid",
            placeSearchQuery: "Invalid",
            placeReference: {
              provider: "GOOGLE",
              placeId: "places/invalid",
              latitude: 35.8,
              longitude: 139.7671,
              coordinatesCachedAt: "2031-01-01T00:00:00.000Z",
              coordinatesExpireAt: "2031-02-01T00:00:00.000Z",
            },
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
          {
            id: "day-1-item-3",
            order: 3,
            type: "ACTIVITY",
            title: "Unverified activity",
            description: "No place ref",
            planningText: "Walk",
            placeSearchQuery: null,
            placeReference: null,
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
          {
            id: "day-1-item-4",
            order: 4,
            type: "PLACE",
            title: "Kyoto Station",
            description: "Another place",
            planningText: "Transfer",
            placeSearchQuery: "Kyoto Station",
            placeReference: {
              provider: "GOOGLE",
              placeId: "places/kyoto-station",
              latitude: 34.9855,
              longitude: 135.7587,
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

  if (!parsed) {
    throw new Error("Fixture itinerary must parse");
  }

  parsed.days[1]!.items[1]!.placeReference = {
    ...parsed.days[1]!.items[1]!.placeReference!,
    latitude: 200,
  };

  return parsed;
}

function testMarkerDerivationEligibilityAndOrdering() {
  const itinerary = createFixtureItinerary();

  const markers = deriveGeneratedMapMarkers({
    itinerary,
    now: new Date("2031-01-15T00:00:00.000Z"),
  });

  assert.equal(markers.length, 2);

  assert.deepEqual(
    markers.map((marker) => marker.placeId),
    ["places/tokyo-station", "places/kyoto-station"],
  );

  const tokyoMarker = markers[0]!;
  assert.equal(tokyoMarker.markerTitle, "Tokyo Station (2 linked items)");
  assert.deepEqual(
    tokyoMarker.linkedItems.map((item) => item.itemId),
    ["day-1-item-1", "day-2-item-1"],
  );

  const interactiveItemIds = deriveInteractiveItemIds(markers);
  assert.equal(interactiveItemIds.has("day-1-item-3"), false);
  assert.equal(interactiveItemIds.has("day-1-item-1"), true);
}

function testViewportInstructions() {
  const markers = deriveGeneratedMapMarkers({
    itinerary: createFixtureItinerary(),
    now: new Date("2031-01-15T00:00:00.000Z"),
  });

  const noneInstruction = deriveMarkerViewportInstruction([]);
  assert.deepEqual(noneInstruction, { kind: "NONE" });

  const singleInstruction = deriveMarkerViewportInstruction([markers[0]!]);
  assert.equal(singleInstruction.kind, "SINGLE");
  if (singleInstruction.kind === "SINGLE") {
    assert.equal(singleInstruction.zoom, 13);
  }

  const boundsInstruction = deriveMarkerViewportInstruction(markers);
  assert.equal(boundsInstruction.kind, "BOUNDS");
  if (boundsInstruction.kind === "BOUNDS") {
    assert.equal(boundsInstruction.bounds.north >= boundsInstruction.bounds.south, true);
    assert.equal(boundsInstruction.bounds.east >= boundsInstruction.bounds.west, true);
  }

  const signatureA = buildMarkerPayloadSignature(markers);
  const signatureB = buildMarkerPayloadSignature(markers);
  assert.equal(shouldResetInitialViewport({ previousSignature: signatureA, nextSignature: signatureB }), false);

  const modifiedMarkers: GeneratedMapMarkerView[] = [
    {
      ...markers[0]!,
      latitude: markers[0]!.latitude + 0.01,
    },
    markers[1]!,
  ];
  const signatureC = buildMarkerPayloadSignature(modifiedMarkers);
  assert.equal(shouldResetInitialViewport({ previousSignature: signatureA, nextSignature: signatureC }), true);

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
    instruction: { kind: "NONE" },
    paddingPx: 80,
  });

  assert.equal(panCalls, 0);
  assert.equal(zoomCalls, 0);
  assert.equal(boundsCalls, 0);

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
      kind: "SINGLE",
      latitude: 35.6,
      longitude: 139.7,
      zoom: 13,
    },
    paddingPx: 80,
  });

  assert.equal(panCalls, 1);
  assert.equal(zoomCalls, 1);

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
      bounds: {
        north: 36,
        south: 35,
        east: 140,
        west: 139,
      },
    },
    paddingPx: 80,
  });

  assert.equal(boundsCalls, 1);
}

function testSelectionResolutionAndCleanup() {
  const markers = deriveGeneratedMapMarkers({
    itinerary: createFixtureItinerary(),
    now: new Date("2031-01-15T00:00:00.000Z"),
  });

  assert.deepEqual(
    resolveSelectedMarker({ markers, selectedItemId: "day-2-item-1" }),
    {
      selectedPlaceId: "places/tokyo-station",
      selectedItemId: "day-2-item-1",
    },
  );

  assert.deepEqual(
    resolveSelectedMarker({ markers, selectedItemId: "missing-item" }),
    {
      selectedPlaceId: null,
      selectedItemId: null,
    },
  );

  assert.deepEqual(
    deriveSelectedMarkerFocus({
      markers,
      selectedItemId: "day-2-item-1",
    }),
    {
      latitude: 35.6812,
      longitude: 139.7671,
    },
  );

  assert.equal(
    deriveSelectedMarkerFocus({
      markers,
      selectedItemId: "missing-item",
    }),
    null,
  );

  const interactiveItemIds = deriveInteractiveItemIds(markers);
  assert.equal(
    deriveEffectiveSelectedItemId({
      selectedItemId: "day-1-item-1",
      isMapLinkedInteractionEnabled: true,
      interactiveItemIds,
    }),
    "day-1-item-1",
  );
  assert.equal(
    deriveEffectiveSelectedItemId({
      selectedItemId: "day-1-item-3",
      isMapLinkedInteractionEnabled: true,
      interactiveItemIds,
    }),
    null,
  );
  assert.equal(
    deriveEffectiveSelectedItemId({
      selectedItemId: "day-1-item-1",
      isMapLinkedInteractionEnabled: false,
      interactiveItemIds,
    }),
    null,
  );

  let focusPanCalls = 0;
  let focusSetZoomCalls = 0;
  const noFocusApplied = applySelectedMarkerFocus({
    adapter: {
      panTo() {
        focusPanCalls += 1;
      },
      getZoom() {
        return 12;
      },
      setZoom() {
        focusSetZoomCalls += 1;
      },
    },
    focusTarget: null,
  });
  assert.equal(noFocusApplied, false);

  const focusApplied = applySelectedMarkerFocus({
    adapter: {
      panTo() {
        focusPanCalls += 1;
      },
      getZoom() {
        return 5;
      },
      setZoom() {
        focusSetZoomCalls += 1;
      },
    },
    focusTarget: {
      latitude: 35.6,
      longitude: 139.7,
    },
  });
  assert.equal(focusApplied, true);
  assert.equal(focusPanCalls, 1);
  assert.equal(focusSetZoomCalls, 1);
}

function testMarkerInteractionBindingLifecycle() {
  let bindingState: MarkerInteractionBindingState | null = null;
  let clickHandler: (() => void) | null = null;
  let keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  let clickSetCount = 0;
  let keydownSetCount = 0;
  const activations: string[] = [];

  const adapter = {
    setClickHandler(handler: (() => void) | null) {
      clickHandler = handler;
      clickSetCount += 1;
    },
    setKeydownHandler(handler: ((event: KeyboardEvent) => void) | null) {
      keydownHandler = handler;
      keydownSetCount += 1;
    },
  };

  bindingState = reconcileMarkerInteractionBinding({
    current: bindingState,
    adapter,
    firstLinkedItemId: "item-1",
    onActivate: (itemId) => {
      activations.push(itemId);
    },
  });

  assert.equal(clickSetCount, 1);
  assert.equal(keydownSetCount, 1);
  assert.notEqual(clickHandler, null);
  assert.notEqual(keydownHandler, null);
  assert.notEqual(bindingState, null);

  bindingState.clickHandler?.();
  bindingState.keydownHandler?.({
    key: "Enter",
    preventDefault() {},
  } as KeyboardEvent);
  assert.deepEqual(activations, ["item-1", "item-1"]);

  bindingState = reconcileMarkerInteractionBinding({
    current: bindingState,
    adapter,
    firstLinkedItemId: "item-2",
    onActivate: (itemId) => {
      activations.push(itemId);
    },
  });

  // No duplicate listener application after update.
  assert.equal(clickSetCount, 1);
  assert.equal(keydownSetCount, 1);
  assert.notEqual(bindingState, null);

  bindingState.clickHandler?.();
  bindingState.keydownHandler?.({
    key: " ",
    preventDefault() {},
  } as KeyboardEvent);
  assert.deepEqual(activations, ["item-1", "item-1", "item-2", "item-2"]);

  bindingState = removeMarkerInteractionBinding({
    current: bindingState,
    adapter,
  });

  assert.equal(bindingState, null);
  assert.equal(clickSetCount, 2);
  assert.equal(keydownSetCount, 2);
  assert.equal(clickHandler, null);
  assert.equal(keydownHandler, null);
}

function testMarkerReconciliationLifecycle() {
  const markers = deriveGeneratedMapMarkers({
    itinerary: createFixtureItinerary(),
    now: new Date("2031-01-15T00:00:00.000Z"),
  });

  const createCalls: string[] = [];
  const updateCalls: string[] = [];
  const removeCalls: string[] = [];
  const activationCalls: string[] = [];

  const adapter: MarkerReconcilerAdapter<FakeMarker> = {
    create({ marker, selected }) {
      createCalls.push(marker.placeId);
      return {
        placeId: marker.placeId,
        selected,
        linkedItemIds: marker.linkedItems.map((item) => item.itemId),
        disposed: false,
        updates: 0,
      };
    },
    update({ marker, next, selected, onActivate }) {
      updateCalls.push(next.placeId);
      marker.selected = selected;
      marker.linkedItemIds = next.linkedItems.map((item) => item.itemId);
      marker.updates += 1;
      const firstLinkedItemId = next.linkedItems[0]?.itemId;
      if (firstLinkedItemId) {
        onActivate(firstLinkedItemId);
      }
    },
    remove(marker) {
      marker.disposed = true;
      removeCalls.push(marker.placeId);
    },
  };

  let state = {
    markersByPlaceId: new Map<string, FakeMarker>(),
  };

  state = reconcileMarkers({
    current: state,
    markers,
    selectedItemId: null,
    onActivate: (itemId) => {
      activationCalls.push(itemId);
    },
    adapter,
  });

  assert.deepEqual(createCalls, ["places/tokyo-station", "places/kyoto-station"]);
  assert.deepEqual(removeCalls, []);
  const createCountAfterInitial = createCalls.length;

  state = reconcileMarkers({
    current: state,
    markers,
    selectedItemId: null,
    onActivate: (itemId) => {
      activationCalls.push(itemId);
    },
    adapter,
  });

  assert.equal(createCalls.length, createCountAfterInitial);
  assert.equal(state.markersByPlaceId.size, 2);

  state = reconcileMarkers({
    current: state,
    markers,
    selectedItemId: "day-1-item-4",
    onActivate: (itemId) => {
      activationCalls.push(itemId);
    },
    adapter,
  });

  assert.equal(createCalls.length, createCountAfterInitial);
  assert.equal(updateCalls.length, 4);

  const replacementMarkers: GeneratedMapMarkerView[] = [markers[1]!];

  state = reconcileMarkers({
    current: state,
    markers: replacementMarkers,
    selectedItemId: "day-1-item-4",
    onActivate: (itemId) => {
      activationCalls.push(itemId);
    },
    adapter,
  });

  assert.deepEqual(removeCalls, ["places/tokyo-station"]);
  assert.equal(state.markersByPlaceId.has("places/kyoto-station"), true);
  assert.equal(state.markersByPlaceId.has("places/tokyo-station"), false);
  assert.equal(activationCalls.includes("day-1-item-4"), true);
}

function run() {
  testMarkerDerivationEligibilityAndOrdering();
  testViewportInstructions();
  testSelectionResolutionAndCleanup();
  testMarkerReconciliationLifecycle();
  testMarkerInteractionBindingLifecycle();

  console.log("map-markers-kanban-sync-regression: pass");
}

run();
