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

export function getItineraryItemTypeLabel(type: ItineraryItemType): string {
  return itineraryItemTypeLabels[type];
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