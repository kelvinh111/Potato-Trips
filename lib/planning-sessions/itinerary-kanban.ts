import type {
  ItineraryItemType,
  PersistedItinerary,
} from "@/lib/planning-sessions/types";

const itineraryItemTypeLabels: Record<ItineraryItemType, string> = {
  PLACE: "Place",
  ACTIVITY: "Activity",
  FOOD: "Food",
  NOTE: "Note",
  TRANSPORT: "Transport",
  LODGING: "Lodging",
};

export interface ItineraryKanbanItemViewModel {
  id: string;
  order: number;
  typeLabel: string;
  title: string;
  description: string;
  planningText: string;
  suggestedTime: string | null;
  suggestedDurationLabel: string | null;
}

export interface ItineraryKanbanDayViewModel {
  id: string;
  dayNumber: number;
  dayLabel: string;
  summary: string | null;
  items: ItineraryKanbanItemViewModel[];
}

export interface ItineraryKanbanViewModel {
  title: string;
  summary: string;
  dayCount: number;
  totalItemCount: number;
  days: ItineraryKanbanDayViewModel[];
}

export interface CanonicalItineraryItemContext {
  dayId: string;
  dayNumber: number;
  dayLabel: string;
  itemId: string;
  itemType: ItineraryItemType;
  itemTypeLabel: string;
  title: string;
  description: string;
  planningText: string;
  googlePlaceId: string | null;
}

export function findScopedItineraryItemElementById(input: {
  root: ParentNode | null;
  itemId: string;
}): HTMLElement | null {
  if (!input.root) {
    return null;
  }

  const candidates = input.root.querySelectorAll<HTMLElement>("[data-itinerary-item-id]");
  for (const candidate of candidates) {
    if (candidate.dataset.itineraryItemId === input.itemId) {
      return candidate;
    }
  }

  return null;
}

export function getItineraryItemTypeLabel(type: ItineraryItemType): string {
  return itineraryItemTypeLabels[type];
}

export function findCanonicalItineraryItemContext(input: {
  itinerary: PersistedItinerary;
  itemId: string;
}): CanonicalItineraryItemContext | null {
  for (const day of input.itinerary.days) {
    for (const item of day.items) {
      if (item.id !== input.itemId) {
        continue;
      }

      const placeId =
        item.placeReference?.provider === "GOOGLE"
          ? item.placeReference.placeId.trim()
          : "";

      return {
        dayId: day.id,
        dayNumber: day.dayNumber,
        dayLabel: day.dayLabel,
        itemId: item.id,
        itemType: item.type,
        itemTypeLabel: getItineraryItemTypeLabel(item.type),
        title: item.title,
        description: item.description,
        planningText: item.planningText,
        googlePlaceId: placeId || null,
      };
    }
  }

  return null;
}

export function formatSuggestedDurationMinutes(minutes: number | null): string | null {
  if (minutes === null) {
    return null;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function toItineraryKanbanViewModel(
  itinerary: PersistedItinerary,
): ItineraryKanbanViewModel {
  const orderedDays = [...itinerary.days].sort((left, right) => {
    return left.dayNumber - right.dayNumber;
  });

  const days = orderedDays.map((day) => {
    const orderedItems = [...day.items].sort((left, right) => {
      return left.order - right.order;
    });

    return {
      id: day.id,
      dayNumber: day.dayNumber,
      dayLabel: day.dayLabel,
      summary: day.summary,
      items: orderedItems.map((item) => ({
        id: item.id,
        order: item.order,
        typeLabel: getItineraryItemTypeLabel(item.type),
        title: item.title,
        description: item.description,
        planningText: item.planningText,
        suggestedTime: item.suggestedTime,
        suggestedDurationLabel: formatSuggestedDurationMinutes(
          item.suggestedDurationMinutes,
        ),
      })),
    };
  });

  const totalItemCount = days.reduce((count, day) => {
    return count + day.items.length;
  }, 0);

  return {
    title: itinerary.title,
    summary: itinerary.summary,
    dayCount: days.length,
    totalItemCount,
    days,
  };
}

export function deriveLocationDetailEligibleItemIds(
  itinerary: PersistedItinerary | null,
): Set<string> {
  const itemIds = new Set<string>();

  if (!itinerary) {
    return itemIds;
  }

  for (const day of itinerary.days) {
    for (const item of day.items) {
      itemIds.add(item.id);
    }
  }

  return itemIds;
}