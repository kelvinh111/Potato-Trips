import {
  planningSessionErrorResponse,
} from "@/lib/planning-sessions/http";
import { getPlanningSessionLocationDetail } from "@/lib/planning-sessions/location-detail-operation";
import {
  itineraryItemIdSchema,
  planningSessionIdSchema,
} from "@/lib/planning-sessions/validation";

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ sessionId: string; itemId: string }> },
) {
  const resolvedParams = await params;
  const parsedSessionId = planningSessionIdSchema.safeParse(resolvedParams.sessionId);
  const parsedItemId = itineraryItemIdSchema.safeParse(resolvedParams.itemId);

  if (!parsedSessionId.success || !parsedItemId.success) {
    return planningSessionErrorResponse({
      code: "INVALID_REQUEST",
      message: "Invalid request parameters.",
      status: 400,
        retryable: false,
    });
  }

  try {
    const result = await getPlanningSessionLocationDetail({
      sessionId: parsedSessionId.data,
      itemId: parsedItemId.data,
    });

    if (result.kind === "NOT_FOUND") {
      return planningSessionErrorResponse({
        code: "PLANNING_SESSION_NOT_FOUND",
        message: "Planning session not found.",
        status: 404,
        retryable: false,
      });
    }

    if (result.kind === "EXPIRED") {
      return planningSessionErrorResponse({
        code: "PLANNING_SESSION_EXPIRED",
        message: "Planning session has expired.",
        status: 410,
        retryable: false,
      });
    }

    if (result.kind === "UNAVAILABLE") {
      const message =
        result.reason === "MISSING_ITEM"
          ? "Itinerary item not found."
          : result.reason === "MISSING_PLACE_REFERENCE"
            ? "Location detail is unavailable for this item."
            : "Planning session is not ready for location detail.";

      return planningSessionErrorResponse({
        code: "LOCATION_DETAIL_UNAVAILABLE",
        message,
        status: 404,
        retryable: false,
      });
    }

    if (result.kind === "LIMIT_EXCEEDED") {
      return planningSessionErrorResponse({
        code: "USAGE_LIMIT_EXCEEDED",
        message:
          "Location detail request limit reached for this session. Start a new session to continue.",
        status: 429,
        retryable: false,
      });
    }

    if (result.kind === "PROVIDER_FAILURE") {
      const message =
        result.reason === "AUTHENTICATION"
          ? "Location details are temporarily unavailable. Please try again."
          : result.reason === "CONFIGURATION"
            ? "Location details are currently unavailable."
            : result.reason === "NOT_FOUND"
              ? "Location details are unavailable for this place."
              : result.reason === "REQUEST"
                ? "Unable to load location details right now. Please retry."
                : "Received an unexpected location-details response. Please retry.";

      const status = result.reason === "CONFIGURATION" ? 503 : 502;

      return planningSessionErrorResponse({
        code: "LOCATION_DETAIL_UNAVAILABLE",
        message,
        status,
        retryable: result.retryable,
      });
    }

    return Response.json({ detail: result.detail }, { status: 200 });
  } catch {
    return planningSessionErrorResponse({
      code: "INTERNAL_ERROR",
      message: "Internal server error.",
      status: 500,
      retryable: true,
    });
  }
}
