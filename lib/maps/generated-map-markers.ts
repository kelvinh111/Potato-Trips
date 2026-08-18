import type { PersistedItinerary } from "@/lib/planning-sessions/types";

export interface GeneratedMapLinkedItem {
  itemId: string;
  dayNumber: number;
  itemOrder: number;
  title: string;
}

export interface GeneratedMapMarkerView {
  placeId: string;
  latitude: number;
  longitude: number;
  markerTitle: string;
  linkedItems: GeneratedMapLinkedItem[];
}

export interface MarkerBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type MarkerViewportInstruction =
  | { kind: "NONE" }
  | {
      kind: "SINGLE";
      latitude: number;
      longitude: number;
      zoom: number;
    }
  | {
      kind: "BOUNDS";
      bounds: MarkerBounds;
    };

export interface MarkerSelectionResolution {
  selectedPlaceId: string | null;
  selectedItemId: string | null;
}

export interface MarkerFocusTarget {
  latitude: number;
  longitude: number;
}

export interface MarkerViewportAdapter {
  panTo(position: { latitude: number; longitude: number }): void;
  setZoom(zoom: number): void;
  fitBounds(bounds: MarkerBounds, paddingPx: number): void;
}

export interface NeutralViewportAdapter {
  panTo(position: { latitude: number; longitude: number }): void;
  setZoom(zoom: number): void;
}

export interface MarkerFocusAdapter {
  panTo(position: { latitude: number; longitude: number }): void;
  getZoom(): number | null;
  setZoom(zoom: number): void;
}

export interface MarkerInteractionAdapter {
  setClickHandler(handler: (() => void) | null): void;
}

export interface MarkerInteractionBindingState {
  firstLinkedItemIdRef: { current: string | null };
  clickHandler: (() => void) | null;
}

export interface MarkerReconciliationState<TMarker> {
  markersByPlaceId: Map<string, TMarker>;
}

export interface MarkerReconcilerAdapter<TMarker> {
  create(args: {
    marker: GeneratedMapMarkerView;
    selected: boolean;
    onActivate: (itemId: string) => void;
  }): TMarker;
  update(args: {
    marker: TMarker;
    next: GeneratedMapMarkerView;
    selected: boolean;
    onActivate: (itemId: string) => void;
  }): void;
  remove(marker: TMarker): void;
}

export interface SelectedItemActivationState {
  selectedItemId: string | null;
  activationVersion: number;
}

const DEFAULT_SINGLE_MARKER_ZOOM = 13;
const DEFAULT_SELECTION_MIN_ZOOM = 11;
export const MAX_BROWSER_TIMER_DELAY_MS = 2_147_483_647;

export function deriveGeneratedMapMarkers(input: {
  itinerary: PersistedItinerary | null;
  now?: Date;
}): GeneratedMapMarkerView[] {
  if (!input.itinerary) {
    return [];
  }

  const nowEpoch = (input.now ?? new Date()).getTime();
  const grouped = new Map<string, GeneratedMapMarkerView>();

  const orderedDays = [...input.itinerary.days].sort((left, right) => {
    return left.dayNumber - right.dayNumber;
  });

  for (const day of orderedDays) {
    const orderedItems = [...day.items].sort((left, right) => {
      return left.order - right.order;
    });

    for (const item of orderedItems) {
      const reference = item.placeReference;
      if (!reference || reference.provider !== "GOOGLE") {
        continue;
      }

      const placeId = reference.placeId.trim();
      if (!placeId) {
        continue;
      }

      if (!isValidCoordinate(reference.latitude, reference.longitude)) {
        continue;
      }

      const expireAtEpoch = Date.parse(reference.coordinatesExpireAt);
      if (!Number.isFinite(expireAtEpoch) || expireAtEpoch <= nowEpoch) {
        continue;
      }

      const linkedItem: GeneratedMapLinkedItem = {
        itemId: item.id,
        dayNumber: day.dayNumber,
        itemOrder: item.order,
        title: item.title,
      };

      const existing = grouped.get(placeId);
      if (existing) {
        existing.linkedItems.push(linkedItem);
        continue;
      }

      grouped.set(placeId, {
        placeId,
        latitude: reference.latitude,
        longitude: reference.longitude,
        markerTitle: item.title,
        linkedItems: [linkedItem],
      });
    }
  }

  const result = Array.from(grouped.values()).map((entry) => {
    const linkedItems = [...entry.linkedItems].sort((left, right) => {
      if (left.dayNumber !== right.dayNumber) {
        return left.dayNumber - right.dayNumber;
      }

      if (left.itemOrder !== right.itemOrder) {
        return left.itemOrder - right.itemOrder;
      }

      return left.itemId.localeCompare(right.itemId);
    });

    const first = linkedItems[0];
    const markerTitle =
      linkedItems.length > 1
        ? `${first?.title ?? entry.markerTitle} (${linkedItems.length} linked items)`
        : `${first?.title ?? entry.markerTitle}`;

    return {
      ...entry,
      markerTitle,
      linkedItems,
    };
  });

  result.sort((left, right) => {
    const leftFirst = left.linkedItems[0];
    const rightFirst = right.linkedItems[0];

    if (leftFirst && rightFirst) {
      if (leftFirst.dayNumber !== rightFirst.dayNumber) {
        return leftFirst.dayNumber - rightFirst.dayNumber;
      }

      if (leftFirst.itemOrder !== rightFirst.itemOrder) {
        return leftFirst.itemOrder - rightFirst.itemOrder;
      }
    }

    return left.placeId.localeCompare(right.placeId);
  });

  return result;
}

export function deriveMarkerViewportInstruction(
  markers: GeneratedMapMarkerView[],
): MarkerViewportInstruction {
  if (markers.length === 0) {
    return { kind: "NONE" };
  }

  if (markers.length === 1) {
    const marker = markers[0]!;
    return {
      kind: "SINGLE",
      latitude: marker.latitude,
      longitude: marker.longitude,
      zoom: DEFAULT_SINGLE_MARKER_ZOOM,
    };
  }

  const bounds: MarkerBounds = {
    north: Number.NEGATIVE_INFINITY,
    south: Number.POSITIVE_INFINITY,
    east: 0,
    west: 0,
  };
  const longitudes: number[] = [];

  for (const marker of markers) {
    bounds.north = Math.max(bounds.north, marker.latitude);
    bounds.south = Math.min(bounds.south, marker.latitude);
    longitudes.push(marker.longitude);
  }

  const longitudeInterval = deriveSmallestCircularLongitudeInterval(longitudes);
  bounds.west = longitudeInterval.west;
  bounds.east = longitudeInterval.east;

  return {
    kind: "BOUNDS",
    bounds,
  };
}

function deriveSmallestCircularLongitudeInterval(longitudes: number[]): {
  west: number;
  east: number;
} {
  const normalized = longitudes
    .map((longitude) => normalizeLongitudeTo360(longitude))
    .sort((left, right) => left - right);

  let largestGap = -1;
  let largestGapIndex = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index]!;
    const next = index === normalized.length - 1
      ? normalized[0]! + 360
      : normalized[index + 1]!;
    const gap = next - current;

    if (gap > largestGap) {
      largestGap = gap;
      largestGapIndex = index;
    }
  }

  const intervalStart = normalized[(largestGapIndex + 1) % normalized.length]!;
  const intervalEndBase = normalized[largestGapIndex]!;
  const intervalEnd = intervalEndBase < intervalStart ? intervalEndBase + 360 : intervalEndBase;
  const span = intervalEnd - intervalStart;
  const west = normalizeLongitudeToSigned(intervalStart);
  const east = normalizeLongitudeToSigned(west + span);

  return {
    west,
    east,
  };
}

function normalizeLongitudeTo360(longitude: number): number {
  const normalized = longitude % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function normalizeLongitudeToSigned(longitude: number): number {
  const wrapped = normalizeLongitudeTo360(longitude);
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

export function resolveSelectedMarker(input: {
  markers: GeneratedMapMarkerView[];
  selectedItemId: string | null;
}): MarkerSelectionResolution {
  if (!input.selectedItemId) {
    return {
      selectedPlaceId: null,
      selectedItemId: null,
    };
  }

  for (const marker of input.markers) {
    const hasItem = marker.linkedItems.some((linkedItem) => {
      return linkedItem.itemId === input.selectedItemId;
    });

    if (hasItem) {
      return {
        selectedPlaceId: marker.placeId,
        selectedItemId: input.selectedItemId,
      };
    }
  }

  return {
    selectedPlaceId: null,
    selectedItemId: null,
  };
}

export function deriveFirstLinkedItemId(marker: GeneratedMapMarkerView): string | null {
  return marker.linkedItems[0]?.itemId ?? null;
}

export function deriveInteractiveItemIds(markers: GeneratedMapMarkerView[]): Set<string> {
  const itemIds = new Set<string>();

  for (const marker of markers) {
    for (const linkedItem of marker.linkedItems) {
      itemIds.add(linkedItem.itemId);
    }
  }

  return itemIds;
}

export function deriveEffectiveSelectedItemId(input: {
  selectedItemId: string | null;
  isMapLinkedInteractionEnabled: boolean;
  interactiveItemIds: Set<string>;
}): string | null {
  if (!input.selectedItemId) {
    return null;
  }

  if (!input.isMapLinkedInteractionEnabled) {
    return null;
  }

  return input.interactiveItemIds.has(input.selectedItemId) ? input.selectedItemId : null;
}

export function activateSelectedItem(input: {
  state: SelectedItemActivationState;
  itemId: string;
}): SelectedItemActivationState {
  return {
    selectedItemId: input.itemId,
    activationVersion: input.state.activationVersion + 1,
  };
}

export function shouldClearSelectedItem(input: {
  selectedItemId: string | null;
  effectiveSelectedItemId: string | null;
}): boolean {
  return input.selectedItemId !== null && input.effectiveSelectedItemId === null;
}

export function deriveNextMarkerEligibilityExpiryEpoch(input: {
  itinerary: PersistedItinerary | null;
  nowEpoch?: number;
}): number | null {
  if (!input.itinerary) {
    return null;
  }

  const nowEpoch = input.nowEpoch ?? Date.now();
  let nextExpiryEpoch: number | null = null;

  for (const day of input.itinerary.days) {
    for (const item of day.items) {
      const reference = item.placeReference;
      if (!reference || reference.provider !== "GOOGLE") {
        continue;
      }

      const placeId = reference.placeId.trim();
      if (!placeId) {
        continue;
      }

      if (!isValidCoordinate(reference.latitude, reference.longitude)) {
        continue;
      }

      const expireAtEpoch = Date.parse(reference.coordinatesExpireAt);
      if (!Number.isFinite(expireAtEpoch) || expireAtEpoch <= nowEpoch) {
        continue;
      }

      if (nextExpiryEpoch === null || expireAtEpoch < nextExpiryEpoch) {
        nextExpiryEpoch = expireAtEpoch;
      }
    }
  }

  return nextExpiryEpoch;
}

export function deriveMarkerEligibilityRefreshDelayMs(input: {
  nextExpiryEpoch: number | null;
  nowEpoch?: number;
  maxDelayMs?: number;
}): number | null {
  if (input.nextExpiryEpoch === null) {
    return null;
  }

  const nowEpoch = input.nowEpoch ?? Date.now();
  const maxDelayMs = input.maxDelayMs ?? MAX_BROWSER_TIMER_DELAY_MS;
  const remainingMs = input.nextExpiryEpoch - nowEpoch;

  if (remainingMs <= 0) {
    return 0;
  }

  return Math.min(remainingMs, maxDelayMs);
}

export function deriveMarkerPressedState(selected: boolean): "true" | "false" {
  return selected ? "true" : "false";
}

export function buildMarkerPayloadSignature(markers: GeneratedMapMarkerView[]): string {
  return markers
    .map((marker) => {
      return `${marker.placeId}:${marker.latitude}:${marker.longitude}:${marker.linkedItems.length}`;
    })
    .join("|");
}

export function deriveSelectedMarkerFocus(input: {
  markers: GeneratedMapMarkerView[];
  selectedItemId: string | null;
}): MarkerFocusTarget | null {
  const selected = resolveSelectedMarker({
    markers: input.markers,
    selectedItemId: input.selectedItemId,
  });

  if (!selected.selectedPlaceId) {
    return null;
  }

  const focusedMarker = input.markers.find((marker) => {
    return marker.placeId === selected.selectedPlaceId;
  });

  if (!focusedMarker) {
    return null;
  }

  return {
    latitude: focusedMarker.latitude,
    longitude: focusedMarker.longitude,
  };
}

export function applyViewportInstruction(input: {
  adapter: MarkerViewportAdapter;
  instruction: MarkerViewportInstruction;
  paddingPx: number;
}): boolean {
  if (input.instruction.kind === "NONE") {
    return false;
  }

  if (input.instruction.kind === "SINGLE") {
    input.adapter.panTo({
      latitude: input.instruction.latitude,
      longitude: input.instruction.longitude,
    });
    input.adapter.setZoom(input.instruction.zoom);
    return true;
  }

  input.adapter.fitBounds(input.instruction.bounds, input.paddingPx);
  return true;
}

export function applyNeutralViewportReset(input: {
  adapter: NeutralViewportAdapter;
  previousMarkerCount: number;
  nextMarkerCount: number;
  neutralCenter: { latitude: number; longitude: number };
  neutralZoom: number;
}): boolean {
  if (input.previousMarkerCount <= 0 || input.nextMarkerCount !== 0) {
    return false;
  }

  input.adapter.panTo(input.neutralCenter);
  input.adapter.setZoom(input.neutralZoom);
  return true;
}

export function applySelectedMarkerFocus(input: {
  adapter: MarkerFocusAdapter;
  focusTarget: MarkerFocusTarget | null;
  minimumZoom?: number;
}): boolean {
  if (!input.focusTarget) {
    return false;
  }

  input.adapter.panTo({
    latitude: input.focusTarget.latitude,
    longitude: input.focusTarget.longitude,
  });

  const minimumZoom = input.minimumZoom ?? DEFAULT_SELECTION_MIN_ZOOM;
  const currentZoom = input.adapter.getZoom();
  if (currentZoom === null || currentZoom < minimumZoom) {
    input.adapter.setZoom(minimumZoom);
  }

  return true;
}

export function reconcileMarkerInteractionBinding(input: {
  current: MarkerInteractionBindingState | null;
  adapter: MarkerInteractionAdapter;
  firstLinkedItemId: string | null;
  onActivate: (itemId: string) => void;
}): MarkerInteractionBindingState {
  if (!input.current) {
    const firstLinkedItemIdRef = { current: input.firstLinkedItemId };

    const clickHandler = () => {
      if (!firstLinkedItemIdRef.current) {
        return;
      }

      input.onActivate(firstLinkedItemIdRef.current);
    };

    input.adapter.setClickHandler(clickHandler);

    return {
      firstLinkedItemIdRef,
      clickHandler,
    };
  }

  input.current.firstLinkedItemIdRef.current = input.firstLinkedItemId;
  return input.current;
}

export function removeMarkerInteractionBinding(input: {
  current: MarkerInteractionBindingState | null;
  adapter: MarkerInteractionAdapter;
}): MarkerInteractionBindingState | null {
  if (!input.current) {
    return null;
  }

  input.adapter.setClickHandler(null);
  return null;
}

export function reconcileMarkers<TMarker>(input: {
  current: MarkerReconciliationState<TMarker>;
  markers: GeneratedMapMarkerView[];
  selectedItemId: string | null;
  onActivate: (itemId: string) => void;
  adapter: MarkerReconcilerAdapter<TMarker>;
}): MarkerReconciliationState<TMarker> {
  const nextByPlaceId = new Map<string, TMarker>();
  const staleByPlaceId = new Map(input.current.markersByPlaceId);

  for (const marker of input.markers) {
    const selected = marker.linkedItems.some((linkedItem) => {
      return linkedItem.itemId === input.selectedItemId;
    });

    const existing = staleByPlaceId.get(marker.placeId);

    if (existing) {
      input.adapter.update({
        marker: existing,
        next: marker,
        selected,
        onActivate: input.onActivate,
      });
      nextByPlaceId.set(marker.placeId, existing);
      staleByPlaceId.delete(marker.placeId);
      continue;
    }

    const created = input.adapter.create({
      marker,
      selected,
      onActivate: input.onActivate,
    });
    nextByPlaceId.set(marker.placeId, created);
  }

  for (const marker of staleByPlaceId.values()) {
    input.adapter.remove(marker);
  }

  return {
    markersByPlaceId: nextByPlaceId,
  };
}

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
  );
}
