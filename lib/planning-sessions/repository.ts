import { prisma } from "@/lib/prisma";

const planningSessionSelect = {
  id: true,
  initialPrompt: true,
  status: true,
  expiresAt: true,
} as const;

export type PlanningSessionRecord = Awaited<
  ReturnType<typeof createPlanningSession>
>;

export async function createPlanningSession(input: {
  initialPrompt: string;
  expiresAt: Date;
}) {
  return prisma.planningSession.create({
    data: {
      initialPrompt: input.initialPrompt,
      expiresAt: input.expiresAt,
    },
    select: planningSessionSelect,
  });
}

export async function findPlanningSessionById(sessionId: string) {
  return prisma.planningSession.findUnique({
    where: { id: sessionId },
    select: planningSessionSelect,
  });
}
