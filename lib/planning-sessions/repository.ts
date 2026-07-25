import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseClarificationMessages,
  parsePersistedItinerary,
  parsePlanningSessionGenerationPhase,
  parsePlanningBrief,
  persistedItinerarySchema,
  type PersistedItinerary,
  type PlanningBrief,
  type PlanningSessionClarificationMessages,
  type PlanningSessionGenerationPhaseValue,
  type PlanningSessionStatusValue,
} from "@/lib/planning-sessions/types";

const planningSessionSelect = {
  id: true,
  initialPrompt: true,
  clarificationMessages: true,
  planningBrief: true,
  generatedItinerary: true,
  generationPhase: true,
  generationAttempts: true,
  generationError: true,
  status: true,
  expiresAt: true,
  updatedAt: true,
} as const;

interface RawPlanningSessionRecord {
  id: string;
  initialPrompt: string;
  clarificationMessages: unknown;
  planningBrief: unknown;
  generatedItinerary: unknown;
  generationPhase: unknown;
  generationAttempts: number;
  generationError: string | null;
  status: PlanningSessionStatusValue;
  expiresAt: Date;
  updatedAt: Date;
}

export interface PlanningSessionRecord {
  id: string;
  initialPrompt: string;
  clarificationMessages: PlanningSessionClarificationMessages;
  planningBrief: PlanningBrief | null;
  generatedItinerary: PersistedItinerary | null;
  generationPhase: PlanningSessionGenerationPhaseValue | null;
  generationAttempts: number;
  generationError: string | null;
  status: PlanningSessionStatusValue;
  expiresAt: Date;
  updatedAt: Date;
}

export class PlanningSessionConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningSessionConcurrencyError";
  }
}

export class PlanningSessionDataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningSessionDataValidationError";
  }
}

export class PlanningSessionInvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningSessionInvalidStateError";
  }
}

export class PlanningSessionUsageLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanningSessionUsageLimitError";
  }
}

export async function createPlanningSession(input: {
  initialPrompt: string;
  expiresAt: Date;
}) {
  const session = await prisma.planningSession.create({
    data: {
      initialPrompt: input.initialPrompt,
      expiresAt: input.expiresAt,
    },
    select: planningSessionSelect,
  });

  return mapPlanningSessionRecord(session);
}

export async function findPlanningSessionById(sessionId: string) {
  const session = await prisma.planningSession.findUnique({
    where: { id: sessionId },
    select: planningSessionSelect,
  });

  if (!session) {
    return null;
  }

  return mapPlanningSessionRecord(session);
}

export async function updatePlanningSessionClarification(input: {
  sessionId: string;
  clarificationMessages: PlanningSessionClarificationMessages;
  planningBrief: PlanningBrief | null;
  status: "CLARIFYING" | "READY_TO_GENERATE";
  expectedUpdatedAt: Date;
}) {
  const clarificationMessages = parseClarificationMessages(
    input.clarificationMessages,
  );
  const planningBrief = parsePlanningBrief(input.planningBrief);

  const updateResult = await prisma.planningSession.updateMany({
    where: {
      id: input.sessionId,
      updatedAt: input.expectedUpdatedAt,
    },
    data: {
      clarificationMessages,
      planningBrief:
        planningBrief === null ? Prisma.DbNull : planningBrief,
      status: input.status,
      generationError: null,
    },
  });

  if (updateResult.count === 0) {
    throw new PlanningSessionConcurrencyError(
      "Planning session was updated by another request.",
    );
  }

  const session = await prisma.planningSession.findUnique({
    where: { id: input.sessionId },
    select: planningSessionSelect,
  });

  if (!session) {
    throw new PlanningSessionDataValidationError(
      "Planning session missing after successful update.",
    );
  }

  return mapPlanningSessionRecord(session);
}

export async function beginPlanningSessionGeneration(input: {
  sessionId: string;
  maxAttempts: number;
}) {
  const session = await prisma.planningSession.findUnique({
    where: { id: input.sessionId },
    select: planningSessionSelect,
  });

  if (!session) {
    return null;
  }

  const mappedSession = mapPlanningSessionRecord(session);

  if (mappedSession.status === "GENERATING") {
    return {
      session: mappedSession,
      started: false,
    };
  }

  if (mappedSession.status !== "READY_TO_GENERATE" && mappedSession.status !== "FAILED") {
    throw new PlanningSessionInvalidStateError(
      "Planning session is not ready for generation.",
    );
  }

  if (mappedSession.planningBrief === null) {
    throw new PlanningSessionInvalidStateError(
      "Planning brief is required before generation.",
    );
  }

  if (mappedSession.generationAttempts >= input.maxAttempts) {
    throw new PlanningSessionUsageLimitError(
      "Generation attempt limit reached for this planning session.",
    );
  }

  const updateResult = await prisma.planningSession.updateMany({
    where: {
      id: input.sessionId,
      status: {
        in: ["READY_TO_GENERATE", "FAILED"],
      },
      generationAttempts: {
        lt: input.maxAttempts,
      },
    },
    data: {
      status: "GENERATING",
      generationPhase: "PREPARING_TRIP",
      generationAttempts: {
        increment: 1,
      },
      generationError: null,
      generatedItinerary: Prisma.DbNull,
    },
  });

  if (updateResult.count === 0) {
    const refreshed = await prisma.planningSession.findUnique({
      where: { id: input.sessionId },
      select: planningSessionSelect,
    });

    if (!refreshed) {
      return null;
    }

    return {
      session: mapPlanningSessionRecord(refreshed),
      started: false,
    };
  }

  const updated = await prisma.planningSession.findUnique({
    where: { id: input.sessionId },
    select: planningSessionSelect,
  });

  if (!updated) {
    throw new PlanningSessionDataValidationError(
      "Planning session missing after generation start.",
    );
  }

  return {
    session: mapPlanningSessionRecord(updated),
    started: true,
  };
}

export async function setPlanningSessionGenerationPhase(input: {
  sessionId: string;
  phase: PlanningSessionGenerationPhaseValue;
}) {
  const updateResult = await prisma.planningSession.updateMany({
    where: {
      id: input.sessionId,
      status: "GENERATING",
    },
    data: {
      generationPhase: input.phase,
    },
  });

  if (updateResult.count === 0) {
    throw new PlanningSessionInvalidStateError(
      "Planning session is not generating.",
    );
  }
}

export async function completePlanningSessionGeneration(input: {
  sessionId: string;
  itinerary: PersistedItinerary;
}) {
  const itinerary = persistedItinerarySchema.parse(input.itinerary);

  const updateResult = await prisma.planningSession.updateMany({
    where: {
      id: input.sessionId,
      status: "GENERATING",
    },
    data: {
      status: "GENERATED",
      generationPhase: null,
      generationError: null,
      generatedItinerary: itinerary,
    },
  });

  if (updateResult.count === 0) {
    throw new PlanningSessionInvalidStateError(
      "Planning session is not generating.",
    );
  }
}

export async function failPlanningSessionGeneration(input: {
  sessionId: string;
  errorMessage: string;
}) {
  await prisma.planningSession.updateMany({
    where: {
      id: input.sessionId,
      status: "GENERATING",
    },
    data: {
      status: "FAILED",
      generationPhase: null,
      generationError: input.errorMessage,
      generatedItinerary: Prisma.DbNull,
    },
  });
}

function mapPlanningSessionRecord(
  session: RawPlanningSessionRecord,
): PlanningSessionRecord {
  try {
    return {
      id: session.id,
      initialPrompt: session.initialPrompt,
      clarificationMessages: parseClarificationMessages(
        session.clarificationMessages,
      ),
      planningBrief: parsePlanningBrief(session.planningBrief),
      generatedItinerary: parsePersistedItinerary(session.generatedItinerary),
      generationPhase: parsePlanningSessionGenerationPhase(session.generationPhase),
      generationAttempts: session.generationAttempts,
      generationError: session.generationError,
      status: session.status,
      expiresAt: session.expiresAt,
      updatedAt: session.updatedAt,
    };
  } catch {
    throw new PlanningSessionDataValidationError(
      "Planning session contains invalid persisted data.",
    );
  }
}
