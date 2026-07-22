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
} as const;

interface RawPlanningSessionRecord {
  id: string;
  initialPrompt: string;
  clarificationMessages: unknown;
  planningBrief: unknown;
  status: PlanningSessionStatusValue;
  expiresAt: Date;
}

export interface PlanningSessionRecord {
  id: string;
  initialPrompt: string;
  clarificationMessages: PlanningSessionClarificationMessages;
  planningBrief: PlanningBrief | null;
  status: PlanningSessionStatusValue;
  expiresAt: Date;
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
}) {
  const session = await prisma.planningSession.update({
    where: { id: input.sessionId },
    data: {
      clarificationMessages: input.clarificationMessages,
      planningBrief:
        input.planningBrief === null ? Prisma.DbNull : input.planningBrief,
      status: input.status,
    },
    select: planningSessionSelect,
  });

  return mapPlanningSessionRecord(session);
}

function mapPlanningSessionRecord(
  session: RawPlanningSessionRecord,
): PlanningSessionRecord {
  return {
    id: session.id,
    initialPrompt: session.initialPrompt,
    clarificationMessages: parseClarificationMessages(
      session.clarificationMessages,
    ),
    planningBrief: parsePlanningBrief(session.planningBrief),
    status: session.status,
    expiresAt: session.expiresAt,
  };
}
