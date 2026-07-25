import {
  planningSessionErrorResponse,
  planningSessionPublicSuccessResponse,
} from "@/lib/planning-sessions/http";
import {
  createPlanningSession,
  type PlanningSessionRecord,
} from "@/lib/planning-sessions/repository";
import { getPlanningSessionExpiryFrom } from "@/lib/planning-sessions/expiry";
import { createPlanningSessionBodySchema } from "@/lib/planning-sessions/validation";

async function readJsonBody(
  request: Request,
): Promise<{ success: true; body: unknown } | { success: false }> {
  try {
    return {
      success: true,
      body: await request.json(),
    };
  } catch {
    return {
      success: false,
    };
  }
}

export async function POST(request: Request) {
  const bodyResult = await readJsonBody(request);

  if (!bodyResult.success) {
    return planningSessionErrorResponse({
      code: "INVALID_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }

  const parsedBody = createPlanningSessionBodySchema.safeParse(bodyResult.body);

  if (!parsedBody.success) {
    return planningSessionErrorResponse({
      code: "INVALID_REQUEST",
      message: "Invalid request body.",
      status: 400,
    });
  }

  try {
    const session: PlanningSessionRecord = await createPlanningSession({
      initialPrompt: parsedBody.data.initialPrompt,
      expiresAt: getPlanningSessionExpiryFrom(),
    });

    return planningSessionPublicSuccessResponse(session, 201);
  } catch {
    return planningSessionErrorResponse({
      code: "INTERNAL_ERROR",
      message: "Internal server error.",
      status: 500,
    });
  }
}
