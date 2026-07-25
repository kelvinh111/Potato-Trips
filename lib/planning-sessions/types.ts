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

export const clarificationReadinessSchema = z.enum([
  "NEEDS_CLARIFICATION",
  "READY",
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

export const planningBriefSchema = z
  .object({
    destinations: z.array(nonEmptyStringSchema).max(20).nullable(),
    dateRange: planningBriefDateRangeSchema.nullable(),
    duration: planningBriefDurationSchema.nullable(),
    travellerCount: z.number().int().positive().max(50).nullable(),
    budget: nonEmptyStringSchema.nullable(),
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
  })
  .strict();

export type ClarificationAiOutput = z.infer<typeof clarificationAiOutputSchema>;

export function parseClarificationMessages(
  value: unknown,
): PlanningSessionClarificationMessages {
  return planningSessionClarificationMessagesSchema.parse(value);
}

export function parsePlanningBrief(value: unknown): PlanningBrief | null {
  if (value === null || value === undefined) {
    return null;
  }

  return planningBriefSchema.parse(value);
}

export function isPlanningBriefReady(brief: PlanningBrief): boolean {
  const hasDestination =
    Array.isArray(brief.destinations) && brief.destinations.length > 0;

  const hasDuration = brief.duration !== null;
  const hasDateRange = brief.dateRange !== null;

  return hasDestination && (hasDuration || hasDateRange);
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
