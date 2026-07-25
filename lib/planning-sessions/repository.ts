import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseClarificationMessages,
  parsePlanningBrief,
  type PlanningBrief,
  type PlanningSessionClarificationMessages,
  type PlanningSessionStatusValue,
} from "@/lib/planning-sessions/types";

const planningSessionSelect = {
  id: true,
  initialPrompt: true,
  clarificationMessages: true,
  planningBrief: true,
  status: true,
  expiresAt: true,
  updatedAt: true,
} as const;

interface RawPlanningSessionRecord {
  id: string;
  initialPrompt: string;
  clarificationMessages: unknown;
  planningBrief: unknown;
  status: PlanningSessionStatusValue;
  expiresAt: Date;
  updatedAt: Date;
}

export interface PlanningSessionRecord {
  id: string;
  initialPrompt: string;
  clarificationMessages: PlanningSessionClarificationMessages;
  planningBrief: PlanningBrief | null;
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
