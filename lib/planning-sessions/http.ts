import { NextResponse } from "next/server";

import type { PlanningSessionRecord } from "@/lib/planning-sessions/repository";
import type {
  PersistedItinerary,
  PlanningBrief,
  PlanningSessionClarificationMessages,
  PlanningSessionGenerationPhaseValue,
} from "@/lib/planning-sessions/types";

export type PlanningSessionErrorCode =
  | "INVALID_REQUEST"
  | "USAGE_LIMIT_EXCEEDED"
  | "PLANNING_SESSION_NOT_FOUND"
  | "PLANNING_SESSION_EXPIRED"
  | "INTERNAL_ERROR";

interface PlanningSessionPublicDto {
  id: string;
  initialPrompt: string;
  status: PlanningSessionRecord["status"];
  expiresAt: Date;
}

interface PlanningSessionClarificationDto {
  status: PlanningSessionRecord["status"];
  clarificationMessages: PlanningSessionClarificationMessages;
  planningBrief: PlanningBrief | null;
  generationPhase: PlanningSessionGenerationPhaseValue | null;
  generatedItinerary: PersistedItinerary | null;
  generationAttempts: number;
  generationError: string | null;
}

interface PlanningSessionGenerationDto {
  status: PlanningSessionRecord["status"];
  planningBrief: PlanningBrief | null;
  generationPhase: PlanningSessionGenerationPhaseValue | null;
  generatedItinerary: PersistedItinerary | null;
  generationAttempts: number;
  generationError: string | null;
}

export function planningSessionPublicSuccessResponse(
  session: PlanningSessionRecord,
  status: number,
) {
  const publicDto: PlanningSessionPublicDto = {
    id: session.id,
    initialPrompt: session.initialPrompt,
    status: session.status,
    expiresAt: session.expiresAt,
  };

  return NextResponse.json({ session: publicDto }, { status });
}

export function planningSessionClarificationSuccessResponse(
  session: PlanningSessionRecord,
  status: number,
) {
  const clarificationDto: PlanningSessionClarificationDto = {
    status: session.status,
    clarificationMessages: session.clarificationMessages,
    planningBrief: session.planningBrief,
    generationPhase: session.generationPhase,
    generatedItinerary: session.generatedItinerary,
    generationAttempts: session.generationAttempts,
    generationError: session.generationError,
  };

  return NextResponse.json({ session: clarificationDto }, { status });
}

export function planningSessionGenerationSuccessResponse(
  session: PlanningSessionRecord,
  status: number,
) {
  const generationDto: PlanningSessionGenerationDto = {
    status: session.status,
    planningBrief: session.planningBrief,
    generationPhase: session.generationPhase,
    generatedItinerary: session.generatedItinerary,
    generationAttempts: session.generationAttempts,
    generationError: session.generationError,
  };

  return NextResponse.json({ session: generationDto }, { status });
}

export function planningSessionErrorResponse(input: {
  code: PlanningSessionErrorCode;
  message: string;
  status: number;
}) {
  return NextResponse.json(
    {
      error: {
        code: input.code,
        message: input.message,
      },
    },
    { status: input.status },
  );
}
