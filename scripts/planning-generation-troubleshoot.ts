import { config as loadEnv } from "dotenv";
import { Prisma } from "../app/generated/prisma/client";

import {
  PLANNING_SESSION_STALE_GENERATION_ERROR_MESSAGE,
  PLANNING_SESSION_STALE_ACTIVE_GENERATION_MS,
  PLANNING_SESSION_STALE_PREPARING_TRIP_MS,
} from "../lib/planning-sessions/constants";
import { isPlanningSessionGenerationStale } from "../lib/planning-sessions/generation-recovery";

loadEnv({ path: ".env.local", override: false });
loadEnv({ path: ".env", override: false });

function parseArgs(argv: string[]) {
  let hours = 24;
  let sessionId: string | null = null;
  let repair = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--hours") {
      const value = Number(argv[index + 1]);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("--hours must be a positive number.");
      }

      hours = value;
      index += 1;
      continue;
    }

    if (token === "--session") {
      const value = argv[index + 1];
      if (!value || value.trim().length === 0) {
        throw new Error("--session requires a non-empty session id.");
      }

      sessionId = value.trim();
      index += 1;
      continue;
    }

    if (token === "--repair") {
      repair = true;
      continue;
    }

    if (token === "--help") {
      console.log("Usage: npm run generation:troubleshoot -- [--hours 24] [--session <id>] [--repair]");
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return { hours, sessionId, repair };
}

function msToMinutes(ms: number) {
  return Math.floor(ms / 60000);
}

async function main() {
  const { prisma } = await import("../lib/prisma");
  try {
    const args = parseArgs(process.argv.slice(2));
    const now = new Date();
    const since = new Date(now.getTime() - args.hours * 60 * 60 * 1000);

    const sessions = await prisma.planningSession.findMany({
      where: args.sessionId
        ? {
            id: args.sessionId,
          }
        : {
            updatedAt: {
              gte: since,
            },
            status: {
              in: ["GENERATING", "FAILED", "GENERATED"],
            },
          },
      select: {
        id: true,
        status: true,
        generationPhase: true,
        generationAttempts: true,
        generationError: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: args.sessionId ? 1 : 100,
    });

    if (sessions.length === 0) {
      console.log("No matching planning sessions found.");
      return;
    }

    console.log("Generation troubleshoot report:");
    console.log(
      JSON.stringify(
        {
          now: now.toISOString(),
          windowHours: args.hours,
          stalePreparingTripMinutes: msToMinutes(
            PLANNING_SESSION_STALE_PREPARING_TRIP_MS,
          ),
          staleActiveGenerationMinutes: msToMinutes(
            PLANNING_SESSION_STALE_ACTIVE_GENERATION_MS,
          ),
          count: sessions.length,
        },
        null,
        2,
      ),
    );

    const staleSessionIds: string[] = [];

    for (const session of sessions) {
      const idleMs = now.getTime() - session.updatedAt.getTime();
      const stale = isPlanningSessionGenerationStale({
        status: session.status,
        generationPhase: session.generationPhase,
        updatedAt: session.updatedAt,
        now,
      });

      if (stale) {
        staleSessionIds.push(session.id);
      }

      console.log(
        JSON.stringify(
          {
            id: session.id,
            status: session.status,
            generationPhase: session.generationPhase,
            generationAttempts: session.generationAttempts,
            generationError: session.generationError,
            createdAt: session.createdAt.toISOString(),
            updatedAt: session.updatedAt.toISOString(),
            idleMinutes: msToMinutes(idleMs),
            isStale: stale,
          },
          null,
          2,
        ),
      );
    }

    if (!args.repair) {
      console.log(
        `Stale generating sessions found: ${staleSessionIds.length}. Re-run with --repair to auto-fail stale records.`,
      );
      return;
    }

    if (staleSessionIds.length === 0) {
      console.log("No stale generating sessions to repair.");
      return;
    }

    const repairResult = await prisma.planningSession.updateMany({
      where: {
        id: {
          in: staleSessionIds,
        },
        status: "GENERATING",
      },
      data: {
        status: "FAILED",
        generationPhase: null,
        generationError: PLANNING_SESSION_STALE_GENERATION_ERROR_MESSAGE,
        generatedItinerary: Prisma.DbNull,
      },
    });

    console.log(
      JSON.stringify(
        {
          repairedCount: repairResult.count,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Generation troubleshoot failed:", message);
    process.exit(1);
  });
