import { z } from "zod";

import {
  PLANNING_SESSION_ID_MAX_LENGTH,
  PLANNING_SESSION_PROMPT_MAX_LENGTH,
} from "@/lib/planning-sessions/constants";

const trimmedPromptSchema = z.string().trim();

export const createPlanningSessionBodySchema = z
  .object({
    initialPrompt: trimmedPromptSchema,
  })
  .strict()
  .refine(
    (value) => value.initialPrompt.length >= 1,
    "initialPrompt must contain at least one non-whitespace character",
  )
  .refine(
    (value) => value.initialPrompt.length <= PLANNING_SESSION_PROMPT_MAX_LENGTH,
    `initialPrompt must not exceed ${PLANNING_SESSION_PROMPT_MAX_LENGTH} characters`,
  );

export const planningSessionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(PLANNING_SESSION_ID_MAX_LENGTH);
