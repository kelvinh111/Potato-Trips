import assert from "node:assert/strict";

import {
  formatSuggestedDurationMinutes,
  getItineraryItemTypeLabel,
  toItineraryKanbanViewModel,
} from "@/lib/planning-sessions/itinerary-kanban";
import type { PersistedItinerary } from "@/lib/planning-sessions/types";

function createFixture(): PersistedItinerary {
  return {
    title: "Kyoto and Osaka Highlights",
    summary: "A focused city-to-city plan with food, culture, and transport blocks.",
    days: [
      {
        id: "day-2",
        dayNumber: 2,
        dayLabel: "Osaka Downtown",
        summary: null,
        items: [
          {
            id: "day-2-item-2",
            order: 2,
            type: "NOTE",
            title: "Evening note",
            description: "Keep luggage light for night transfer.",
            planningText: "Leave heavy bags at hotel before dinner.",
            suggestedTime: null,
            suggestedDurationMinutes: null,
          },
          {
            id: "day-2-item-0",
            order: 0,
            type: "FOOD",
            title: "Kuromon Market breakfast",
            description: "Start with local market stalls.",
            planningText: "Try grilled seafood and tamago skewers.",
            suggestedTime: "08:30",
            suggestedDurationMinutes: 60,
          },
          {
            id: "day-2-item-1",
            order: 1,
            type: "ACTIVITY",
            title: "Dotonbori walk",
            description: "Explore canal streets and shopfront signs.",
            planningText: "Pause at river viewpoints for photos.",
            suggestedTime: "10:00",
            suggestedDurationMinutes: 90,
          },
        ],
      },
      {
        id: "day-1",
        dayNumber: 1,
        dayLabel: "Kyoto East",
        summary: "Shrines and old streets.",
        items: [
          {
            id: "day-1-item-1",
            order: 1,
            type: "PLACE",
            title: "Kiyomizu-dera",
            description: "Historic temple with hillside views.",
            planningText: "Visit before noon for lighter crowds.",
            suggestedTime: "09:00",
            suggestedDurationMinutes: 120,
          },
          {
            id: "day-1-item-0",
            order: 0,
            type: "LODGING",
            title: "Hotel check-in",
            description: "Drop bags near Gion.",
            planningText: "Request early baggage hold if room not ready.",
            suggestedTime: null,
            suggestedDurationMinutes: 30,
          },
        ],
      },
      {
        id: "day-3",
        dayNumber: 3,
        dayLabel: "Transfer day",
        summary: "Major city transfer.",
        items: [
          {
            id: "day-3-item-0",
            order: 0,
            type: "TRANSPORT",
            title: "Shinkansen to Tokyo",
            description: "Board at Shin-Osaka station.",
            planningText: "Arrive platform 15 minutes before departure.",
            suggestedTime: "11:20",
            suggestedDurationMinutes: 165,
          },
        ],
      },
    ],
  };
}

function testDurationFormatting() {
  assert.equal(formatSuggestedDurationMinutes(null), null);
  assert.equal(formatSuggestedDurationMinutes(45), "45m");
  assert.equal(formatSuggestedDurationMinutes(60), "1h");
  assert.equal(formatSuggestedDurationMinutes(90), "1h 30m");
  assert.equal(formatSuggestedDurationMinutes(121), "2h 1m");
}

function testTypeLabelCoverage() {
  assert.equal(getItineraryItemTypeLabel("PLACE"), "Place");
  assert.equal(getItineraryItemTypeLabel("ACTIVITY"), "Activity");
  assert.equal(getItineraryItemTypeLabel("FOOD"), "Food");
  assert.equal(getItineraryItemTypeLabel("NOTE"), "Note");
  assert.equal(getItineraryItemTypeLabel("TRANSPORT"), "Transport");
  assert.equal(getItineraryItemTypeLabel("LODGING"), "Lodging");
}

function testKanbanViewModelOrderingAndCounts() {
  const viewModel = toItineraryKanbanViewModel(createFixture());

  assert.equal(viewModel.title, "Kyoto and Osaka Highlights");
  assert.equal(
    viewModel.summary,
    "A focused city-to-city plan with food, culture, and transport blocks.",
  );
  assert.equal(viewModel.dayCount, 3);
  assert.equal(viewModel.totalItemCount, 6);

  assert.deepEqual(
    viewModel.days.map((day) => day.dayNumber),
    [1, 2, 3],
  );

  assert.deepEqual(
    viewModel.days[0]?.items.map((item) => item.order),
    [0, 1],
  );
  assert.deepEqual(
    viewModel.days[1]?.items.map((item) => item.order),
    [0, 1, 2],
  );

  const firstItem = viewModel.days[0]?.items[0];
  assert.equal(firstItem?.typeLabel, "Lodging");
  assert.equal(firstItem?.suggestedTime, null);
  assert.equal(firstItem?.suggestedDurationLabel, "30m");

  const noteItem = viewModel.days[1]?.items[2];
  assert.equal(noteItem?.typeLabel, "Note");
  assert.equal(noteItem?.suggestedTime, null);
  assert.equal(noteItem?.suggestedDurationLabel, null);
}

function run() {
  testDurationFormatting();
  testTypeLabelCoverage();
  testKanbanViewModelOrderingAndCounts();

  console.log("itinerary-kanban-regression: pass");
}

run();