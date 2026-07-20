import { NextResponse } from "next/server";

import type { PlanningSessionRecord } from "@/lib/planning-sessions/repository";

export type PlanningSessionErrorCode =
  | "INVALID_REQUEST"
  | "PLANNING_SESSION_NOT_FOUND"
  | "PLANNING_SESSION_EXPIRED"
  | "INTERNAL_ERROR";

export function planningSessionSuccessResponse(
  session: PlanningSessionRecord,
  status: number,
) {
  return NextResponse.json({ session }, { status });
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
