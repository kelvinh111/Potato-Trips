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

const DEFAULT_SINGLE_MARKER_ZOOM = 13;

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
    east: Number.NEGATIVE_INFINITY,
    west: Number.POSITIVE_INFINITY,
  };

  for (const marker of markers) {
    bounds.north = Math.max(bounds.north, marker.latitude);
    bounds.south = Math.min(bounds.south, marker.latitude);
    bounds.east = Math.max(bounds.east, marker.longitude);
    bounds.west = Math.min(bounds.west, marker.longitude);
  }

  return {
    kind: "BOUNDS",
    bounds,
  };
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

export function buildMarkerPayloadSignature(markers: GeneratedMapMarkerView[]): string {
  return markers
    .map((marker) => {
      return `${marker.placeId}:${marker.latitude}:${marker.longitude}:${marker.linkedItems.length}`;
    })
    .join("|");
}

export function shouldResetInitialViewport(input: {
  previousSignature: string;
  nextSignature: string;
}): boolean {
  return input.previousSignature !== input.nextSignature;
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
