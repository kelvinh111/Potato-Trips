import assert from "node:assert/strict";

import {
  isPlanningBriefExactDateRangeConsistentWithTripLength,
  isPlanningBriefReadyForConfirmation,
  normalizePlanningBrief,
  parsePlanningBrief,
  type PlanningBrief,
} from "@/lib/planning-sessions/types";

function run() {
  const canonicalBriefInput: PlanningBrief = {
    destinations: ["Tokyo"],
    startingLocation: {
      city: "Singapore",
      preferredDepartureAirport: "SIN",
    },
    travelTiming: {
      month: 1,
      year: 2030,
      monthWindow: "MID",
      exactDateRange: {
        startDate: "2030-05-02",
        endDate: "2030-05-07",
      },
    },
    tripLengthDays: 6,
    travellers: {
      adults: 2,
      children: 0,
    },
    budget: "mid-range",
    interestsAndStyle: ["food", "culture", "walkable areas"],
    practicality: {
      isPractical: true,
      notes: ["Direct flights available"],
    },
    finalSummary: "Trip confirmed for a 6-day Tokyo plan.",
  };

  const parsedCanonical = parsePlanningBrief(canonicalBriefInput);
  assert(parsedCanonical, "Canonical brief should parse");

  const normalizedCanonical = normalizePlanningBrief(parsedCanonical);
  assert.equal(
    normalizedCanonical.travelTiming?.month,
    5,
    "Month should normalize from exact start date",
  );
  assert.equal(
    normalizedCanonical.travelTiming?.year,
    2030,
    "Year should normalize from exact start date",
  );
  assert.equal(
    normalizedCanonical.tripLengthDays,
    6,
    "Trip length should remain canonical",
  );

  assert.equal(
    isPlanningBriefExactDateRangeConsistentWithTripLength(normalizedCanonical),
    true,
    "Exact date range and trip length should remain consistent",
  );

  assert.equal(
    isPlanningBriefReadyForConfirmation(normalizedCanonical),
    true,
    "Canonical complete brief should be ready for confirmation",
  );

  const legacyOnlyBrief = {
    destinations: ["Osaka"],
    dateRange: {
      startDate: "2030-06-01",
      endDate: "2030-06-05",
    },
    duration: {
      days: 5,
    },
    travellerCount: 2,
    pace: "relaxed",
    travelStyle: "food-focused",
    interests: ["street food"],
    preferences: ["quiet hotel"],
    constraints: ["avoid red-eye flights"],
    startingLocation: null,
    travelTiming: null,
    tripLengthDays: null,
    travellers: null,
    budget: null,
    interestsAndStyle: null,
    practicality: null,
    finalSummary: null,
  };

  assert.throws(
    () => parsePlanningBrief(legacyOnlyBrief),
    /Unrecognized key|Invalid input|Expected/,
    "Legacy planning-brief shape must be rejected",
  );

  const canonicalButInconsistentTripLength: PlanningBrief = {
    ...canonicalBriefInput,
    tripLengthDays: 5,
  };

  const parsedInconsistent = parsePlanningBrief(canonicalButInconsistentTripLength);
  assert(parsedInconsistent, "Canonical brief should parse even if inconsistent");
  assert.equal(
    isPlanningBriefExactDateRangeConsistentWithTripLength(parsedInconsistent),
    false,
    "Date-range consistency check must still detect mismatch",
  );
  assert.equal(
    isPlanningBriefReadyForConfirmation(parsedInconsistent),
    false,
    "Readiness must remain false when date range and length mismatch",
  );

  console.log("planning-brief-canonical-regression: pass");
}

run();
