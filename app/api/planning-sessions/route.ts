import { ZodError } from "zod";

import {
  planningSessionErrorResponse,
  planningSessionSuccessResponse,
} from "@/lib/planning-sessions/http";
import {
  createPlanningSession,
  type PlanningSessionRecord,
} from "@/lib/planning-sessions/repository";
import { getPlanningSessionExpiryFrom } from "@/lib/planning-sessions/expiry";
import { createPlanningSessionBodySchema } from "@/lib/planning-sessions/validation";

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ZodError([
      {
        code: "custom",
        message: "Malformed JSON body",
        path: [],
      },
    ]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    const parsed = createPlanningSessionBodySchema.parse(body);

    const session: PlanningSessionRecord = await createPlanningSession({
      initialPrompt: parsed.initialPrompt,
      expiresAt: getPlanningSessionExpiryFrom(),
    });

    return planningSessionSuccessResponse(session, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return planningSessionErrorResponse({
        code: "INVALID_REQUEST",
        message: "Invalid request body.",
        status: 400,
      });
    }

    return planningSessionErrorResponse({
      code: "INTERNAL_ERROR",
      message: "Internal server error.",
      status: 500,
    });
  }
}
