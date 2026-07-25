import { z } from "zod";

import { PLANNING_SESSION_MESSAGE_MAX_LENGTH } from "@/lib/planning-sessions/constants";

const nonEmptyStringSchema = z.string().trim().min(1).max(240);
const nonEmptyLongStringSchema = z
  .string()
  .trim()
  .min(1)
  .max(PLANNING_SESSION_MESSAGE_MAX_LENGTH);

const canonicalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => isValidCanonicalDate(value), {
    message: "Date must be a valid calendar date in YYYY-MM-DD format",
  });

export const planningSessionStatusSchema = z.enum([
  "CLARIFYING",
  "READY_TO_GENERATE",
  "GENERATING",
  "GENERATED",
  "FAILED",
]);

export type PlanningSessionStatusValue = z.infer<typeof planningSessionStatusSchema>;

export const planningSessionGenerationPhaseSchema = z.enum([
  "PREPARING_TRIP",
  "GENERATING_ITINERARY",
  "CHECKING_PLAN",
  "SAVING_ITINERARY",
]);

export type PlanningSessionGenerationPhaseValue = z.infer<
  typeof planningSessionGenerationPhaseSchema
>;

export const clarificationReadinessSchema = z.enum([
  "NEEDS_CLARIFICATION",
  "READY_FOR_CONFIRMATION",
  "CONFIRMED",
]);

export type ClarificationReadiness = z.infer<typeof clarificationReadinessSchema>;

export const planningSessionClarificationMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: nonEmptyLongStringSchema,
  })
  .strict();

export type PlanningSessionClarificationMessage = z.infer<
  typeof planningSessionClarificationMessageSchema
>;

export const planningSessionClarificationMessagesSchema = z
  .array(planningSessionClarificationMessageSchema)
  .max(500);

export type PlanningSessionClarificationMessages = z.infer<
  typeof planningSessionClarificationMessagesSchema
>;

const planningBriefDateRangeSchema = z
  .object({
    startDate: canonicalDateSchema,
    endDate: canonicalDateSchema,
  })
  .strict()
  .refine(
    (value) => {
      const start = toUtcEpochDay(value.startDate);
      const end = toUtcEpochDay(value.endDate);

      return start <= end;
    },
    {
      message: "startDate must be before or equal to endDate",
      path: ["endDate"],
    },
  );

const planningBriefDurationSchema = z
  .object({
    days: z.number().int().positive().max(365),
  })
  .strict();

const planningBriefStartingLocationSchema = z
  .object({
    city: nonEmptyStringSchema,
    preferredDepartureAirport: nonEmptyStringSchema.nullable(),
  })
  .strict();

const planningBriefTravelTimingSchema = z
  .object({
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2024).max(2100),
    monthWindow: z.enum(["EARLY", "MID", "LATE"]).nullable(),
    exactDateRange: planningBriefDateRangeSchema.nullable(),
  })
  .strict();

const planningBriefTravellersSchema = z
  .object({
    adults: z.number().int().min(0).max(30),
    children: z.number().int().min(0).max(30),
  })
  .strict()
  .refine((value) => value.adults + value.children >= 1, {
    message: "At least one traveller is required",
  });

const planningBriefPracticalitySchema = z
  .object({
    isPractical: z.boolean(),
    notes: z.array(nonEmptyStringSchema).max(10),
  })
  .strict();

export const planningBriefSchema = z
  .object({
    destinations: z.array(nonEmptyStringSchema).max(20).nullable(),
    startingLocation: planningBriefStartingLocationSchema.nullable(),
    travelTiming: planningBriefTravelTimingSchema.nullable(),
    tripLengthDays: z.number().int().min(1).max(14).nullable(),
    travellers: planningBriefTravellersSchema.nullable(),
    budget: nonEmptyStringSchema.nullable(),
    interestsAndStyle: z.array(nonEmptyStringSchema).max(50).nullable(),
    practicality: planningBriefPracticalitySchema.nullable(),
    finalSummary: nonEmptyLongStringSchema.nullable(),

    // Legacy fields retained for persisted-data compatibility.
    dateRange: planningBriefDateRangeSchema.nullable(),
    duration: planningBriefDurationSchema.nullable(),
    travellerCount: z.number().int().positive().max(50).nullable(),
    pace: nonEmptyStringSchema.nullable(),
    travelStyle: nonEmptyStringSchema.nullable(),
    interests: z.array(nonEmptyStringSchema).max(50).nullable(),
    preferences: z.array(nonEmptyStringSchema).max(50).nullable(),
    constraints: z.array(nonEmptyStringSchema).max(50).nullable(),
  })
  .strict();

export type PlanningBrief = z.infer<typeof planningBriefSchema>;

export const clarificationAiOutputSchema = z
  .object({
    assistantMessage: nonEmptyLongStringSchema,
    readiness: clarificationReadinessSchema,
    planningBrief: planningBriefSchema,
    missingInformation: z.array(nonEmptyStringSchema).max(12),
  })
  .strict();

export type ClarificationAiOutput = z.infer<typeof clarificationAiOutputSchema>;

export const itineraryItemTypeSchema = z.enum([
  "PLACE",
  "ACTIVITY",
  "FOOD",
  "NOTE",
  "TRANSPORT",
  "LODGING",
]);

export type ItineraryItemType = z.infer<typeof itineraryItemTypeSchema>;

const aiGeneratedItineraryItemSchema = z
  .object({
    type: itineraryItemTypeSchema,
    title: nonEmptyStringSchema,
    description: nonEmptyLongStringSchema,
    planningText: nonEmptyLongStringSchema,
    suggestedTime: nonEmptyStringSchema.nullable(),
    suggestedDurationMinutes: z.number().int().min(1).max(24 * 60).nullable(),
  })
  .strict();

const aiGeneratedItineraryDaySchema = z
  .object({
    dayLabel: nonEmptyStringSchema,
    summary: nonEmptyLongStringSchema.nullable(),
    items: z.array(aiGeneratedItineraryItemSchema).min(1).max(20),
  })
  .strict();

export const aiGeneratedItinerarySchema = z
  .object({
    title: nonEmptyStringSchema,
    summary: nonEmptyLongStringSchema,
    days: z.array(aiGeneratedItineraryDaySchema).min(1).max(14),
  })
  .strict();

export type AiGeneratedItinerary = z.infer<typeof aiGeneratedItinerarySchema>;

export const persistedItineraryItemSchema = z
  .object({
    id: nonEmptyStringSchema,
    order: z.number().int().min(0),
    type: itineraryItemTypeSchema,
    title: nonEmptyStringSchema,
    description: nonEmptyLongStringSchema,
    planningText: nonEmptyLongStringSchema,
    suggestedTime: nonEmptyStringSchema.nullable(),
    suggestedDurationMinutes: z.number().int().min(1).max(24 * 60).nullable(),
  })
  .strict();

export const persistedItineraryDaySchema = z
  .object({
    id: nonEmptyStringSchema,
    dayNumber: z.number().int().min(1).max(14),
    dayLabel: nonEmptyStringSchema,
    summary: nonEmptyLongStringSchema.nullable(),
    items: z.array(persistedItineraryItemSchema).min(1).max(20),
  })
  .strict();

export const persistedItinerarySchema = z
  .object({
    title: nonEmptyStringSchema,
    summary: nonEmptyLongStringSchema,
    days: z.array(persistedItineraryDaySchema).min(1).max(14),
  })
  .strict();

export type PersistedItinerary = z.infer<typeof persistedItinerarySchema>;

export function parseClarificationMessages(
  value: unknown,
): PlanningSessionClarificationMessages {
  return planningSessionClarificationMessagesSchema.parse(value);
}

export function parsePlanningBrief(value: unknown): PlanningBrief | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = planningBriefSchema.parse(value);

  return normalizePlanningBrief(parsed);
}

export function parsePlanningSessionGenerationPhase(
  value: unknown,
): PlanningSessionGenerationPhaseValue | null {
  if (value === null || value === undefined) {
    return null;
  }

  return planningSessionGenerationPhaseSchema.parse(value);
}

export function parsePersistedItinerary(value: unknown): PersistedItinerary | null {
  if (value === null || value === undefined) {
    return null;
  }

  return persistedItinerarySchema.parse(value);
}

export function isPlanningBriefReadyForConfirmation(brief: PlanningBrief): boolean {
  const normalized = normalizePlanningBrief(brief);

  const hasDestination =
    Array.isArray(normalized.destinations) && normalized.destinations.length > 0;

  const hasStartingLocation = normalized.startingLocation !== null;
  const hasTravelTiming = normalized.travelTiming !== null;
  const hasTripLength = normalized.tripLengthDays !== null;
  const hasTravellers = normalized.travellers !== null;
  const hasBudget = normalized.budget !== null;
  const hasInterests =
    Array.isArray(normalized.interestsAndStyle) &&
    normalized.interestsAndStyle.length > 0;
  const isPractical = normalized.practicality?.isPractical === true;

  return (
    hasDestination &&
    hasStartingLocation &&
    hasTravelTiming &&
    hasTripLength &&
    hasTravellers &&
    hasBudget &&
    hasInterests &&
    isPractical
  );
}

export function normalizePlanningBrief(brief: PlanningBrief): PlanningBrief {
  const monthWindowFromDateRange =
    brief.dateRange !== undefined && brief.dateRange !== null
      ? inferMonthWindow(brief.dateRange.startDate)
      : null;

  const travelTimingFromDateRange =
    brief.dateRange !== undefined && brief.dateRange !== null
      ? {
          month: Number(brief.dateRange.startDate.split("-")[1]),
          year: Number(brief.dateRange.startDate.split("-")[0]),
          monthWindow: monthWindowFromDateRange,
          exactDateRange: brief.dateRange,
        }
      : null;

  const interestsAndStyle =
    brief.interestsAndStyle ??
    mergeLegacyInterests({
      interests: brief.interests,
      travelStyle: brief.travelStyle ?? null,
      pace: brief.pace ?? null,
    });

  const travellers =
    brief.travellers ??
    (brief.travellerCount !== undefined && brief.travellerCount !== null
      ? {
          adults: brief.travellerCount,
          children: 0,
        }
      : null);

  return {
    ...brief,
    travelTiming: brief.travelTiming ?? travelTimingFromDateRange,
    tripLengthDays: brief.tripLengthDays ?? brief.duration?.days ?? null,
    travellers,
    interestsAndStyle,
    finalSummary: brief.finalSummary ?? null,
  };
}

export function normalizeGeneratedItinerary(
  input: AiGeneratedItinerary,
): PersistedItinerary {
  const days = input.days.map((day, dayIndex) => ({
    id: `day-${dayIndex + 1}`,
    dayNumber: dayIndex + 1,
    dayLabel: day.dayLabel,
    summary: day.summary,
    items: day.items.map((item, itemIndex) => ({
      id: `day-${dayIndex + 1}-item-${itemIndex + 1}`,
      order: itemIndex,
      type: item.type,
      title: item.title,
      description: item.description,
      planningText: item.planningText,
      suggestedTime: item.suggestedTime,
      suggestedDurationMinutes: item.suggestedDurationMinutes,
    })),
  }));

  return persistedItinerarySchema.parse({
    title: input.title,
    summary: input.summary,
    days,
  });
}

export function isPlanningBriefReady(brief: PlanningBrief): boolean {
  return isPlanningBriefReadyForConfirmation(brief);
}

function mergeLegacyInterests(input: {
  interests: string[] | null;
  travelStyle: string | null;
  pace: string | null;
}): string[] | null {
  const values = [
    ...(input.interests ?? []),
    ...(input.travelStyle ? [input.travelStyle] : []),
    ...(input.pace ? [input.pace] : []),
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (values.length === 0) {
    return null;
  }

  return Array.from(new Set(values));
}

function inferMonthWindow(canonicalDate: string): "EARLY" | "MID" | "LATE" {
  const day = Number(canonicalDate.split("-")[2]);

  if (day <= 10) {
    return "EARLY";
  }

  if (day <= 20) {
    return "MID";
  }

  return "LATE";
}

export function isClarificationStageStatus(
  status: PlanningSessionStatusValue,
): boolean {
  return status === "CLARIFYING" || status === "READY_TO_GENERATE";
}

function isValidCanonicalDate(value: string): boolean {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");

  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

function toUtcEpochDay(value: string): number {
  const [yearRaw, monthRaw, dayRaw] = value.split("-");

  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  return Date.UTC(year, month - 1, day);
}
