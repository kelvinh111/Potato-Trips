import { z } from "zod";

import {
  parsePersistedItinerary,
  parsePlanningBrief,
  parsePlanningSessionGenerationPhase,
  planningSessionClarificationMessagesSchema,
  planningSessionStatusSchema,
  type PersistedItinerary,
  type PlanningBrief,
  type PlanningSessionClarificationMessages,
  type PlanningSessionGenerationPhaseValue,
  type PlanningSessionStatusValue,
} from "@/lib/planning-sessions/types";

interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
  };
}

const apiErrorPayloadSchema = z
  .object({
    error: z
      .object({
        code: z.string(),
        message: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict();

export interface PlanningSessionClarificationApiSession {
  status: PlanningSessionStatusValue;
  clarificationMessages: PlanningSessionClarificationMessages;
  planningBrief: PlanningBrief | null;
  generationPhase: PlanningSessionGenerationPhaseValue | null;
  generatedItinerary: PersistedItinerary | null;
  generationAttempts: number;
  generationError: string | null;
}

export interface PlanningSessionGenerationApiSession {
  status: PlanningSessionStatusValue;
  planningBrief: PlanningBrief | null;
  generationPhase: PlanningSessionGenerationPhaseValue | null;
  generatedItinerary: PersistedItinerary | null;
  generationAttempts: number;
  generationError: string | null;
}

export class PlanningSessionClientApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningSessionClientApiError";
  }
}

interface RequestOptions {
  fetchImpl?: typeof fetch;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function parseJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function parseApiErrorPayload(payload: unknown): ApiErrorPayload | null {
  const result = apiErrorPayloadSchema.safeParse(payload);
  if (!result.success) {
    return null;
  }

  return result.data;
}

function readApiErrorMessage(payload: unknown): string {
  const parsedPayload = parseApiErrorPayload(payload);
  if (parsedPayload) {
    return parsedPayload.error.message;
  }

  return "Unable to complete that request. Please try again.";
}

function parseGenerationAttempts(value: unknown, invalidMessage: string): number {
  const numericValue = Number(value ?? 0);

  if (!Number.isInteger(numericValue)) {
    throw new PlanningSessionClientApiError(invalidMessage);
  }

  return numericValue;
}

function parseClarificationSessionPayload(
  payload: unknown,
): PlanningSessionClarificationApiSession {
  if (!isObjectRecord(payload) || !isObjectRecord(payload.session)) {
    throw new PlanningSessionClientApiError("Invalid clarification response.");
  }

  const session = payload.session;

  const statusResult = planningSessionStatusSchema.safeParse(session.status);
  const messagesResult = planningSessionClarificationMessagesSchema.safeParse(
    session.clarificationMessages,
  );

  if (!statusResult.success || !messagesResult.success) {
    throw new PlanningSessionClientApiError("Invalid clarification response.");
  }

  return {
    status: statusResult.data,
    clarificationMessages: messagesResult.data,
    planningBrief: parsePlanningBrief(session.planningBrief),
    generationPhase: parsePlanningSessionGenerationPhase(session.generationPhase),
    generatedItinerary: parsePersistedItinerary(session.generatedItinerary),
    generationAttempts: parseGenerationAttempts(
      session.generationAttempts,
      "Invalid clarification response.",
    ),
    generationError:
      typeof session.generationError === "string" ? session.generationError : null,
  };
}

function parseGenerationSessionPayload(
  payload: unknown,
): PlanningSessionGenerationApiSession {
  if (!isObjectRecord(payload) || !isObjectRecord(payload.session)) {
    throw new PlanningSessionClientApiError("Invalid generation response.");
  }

  const session = payload.session;

  const statusResult = planningSessionStatusSchema.safeParse(session.status);

  if (!statusResult.success) {
    throw new PlanningSessionClientApiError("Invalid generation response.");
  }

  return {
    status: statusResult.data,
    planningBrief: parsePlanningBrief(session.planningBrief),
    generationPhase: parsePlanningSessionGenerationPhase(session.generationPhase),
    generatedItinerary: parsePersistedItinerary(session.generatedItinerary),
    generationAttempts: parseGenerationAttempts(
      session.generationAttempts,
      "Invalid generation response.",
    ),
    generationError:
      typeof session.generationError === "string" ? session.generationError : null,
  };
}

async function requestPlanningSessionApi(
  input: {
    url: string;
    init: RequestInit;
  },
  options?: RequestOptions,
): Promise<unknown> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const response = await fetchImpl(input.url, input.init);
  const payload = await parseJsonPayload(response);

  if (!response.ok) {
    throw new PlanningSessionClientApiError(readApiErrorMessage(payload));
  }

  return payload;
}

export async function requestPlanningSessionClarificationStart(
  sessionId: string,
  options?: RequestOptions,
): Promise<PlanningSessionClarificationApiSession> {
  const payload = await requestPlanningSessionApi(
    {
      url: `/api/planning-sessions/${sessionId}/clarify`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "start" }),
      },
    },
    options,
  );

  return parseClarificationSessionPayload(payload);
}

export async function requestPlanningSessionClarificationReply(
  sessionId: string,
  message: string,
  options?: RequestOptions,
): Promise<PlanningSessionClarificationApiSession> {
  const payload = await requestPlanningSessionApi(
    {
      url: `/api/planning-sessions/${sessionId}/clarify`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reply",
          message,
        }),
      },
    },
    options,
  );

  return parseClarificationSessionPayload(payload);
}

export async function requestPlanningSessionGenerationStart(
  sessionId: string,
  options?: RequestOptions,
): Promise<PlanningSessionGenerationApiSession> {
  const payload = await requestPlanningSessionApi(
    {
      url: `/api/planning-sessions/${sessionId}/generate`,
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "start" }),
      },
    },
    options,
  );

  return parseGenerationSessionPayload(payload);
}

export async function requestPlanningSessionGenerationState(
  sessionId: string,
  options?: RequestOptions,
): Promise<PlanningSessionGenerationApiSession> {
  const payload = await requestPlanningSessionApi(
    {
      url: `/api/planning-sessions/${sessionId}/generation`,
      init: {
        method: "GET",
      },
    },
    options,
  );

  return parseGenerationSessionPayload(payload);
}
