import assert from "node:assert/strict";

import {
  requestPlanningSessionClarificationReply,
  requestPlanningSessionClarificationStart,
  requestPlanningSessionGenerationStart,
  requestPlanningSessionGenerationState,
  PlanningSessionClientApiError,
} from "@/lib/planning-sessions/client-api";

function createMockFetch(
  responder: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await responder(input, init);
    return response;
  }) as typeof fetch;
}

function createClarificationSuccessPayload() {
  return {
    session: {
      status: "CLARIFYING",
      clarificationMessages: [
        {
          role: "assistant",
          content: "Where would you like to go?",
        },
      ],
      planningBrief: {
        destinations: ["Tokyo"],
        startingLocation: {
          city: "Seoul",
          preferredDepartureAirport: "ICN",
        },
        travelTiming: {
          month: 10,
          year: 2030,
          monthWindow: "MID",
          exactDateRange: {
            startDate: "2030-10-04",
            endDate: "2030-10-09",
          },
        },
        tripLengthDays: 6,
        travellers: {
          adults: 2,
          children: 0,
        },
        budget: "mid-range",
        interestsAndStyle: ["food", "culture"],
        practicality: {
          isPractical: true,
          notes: ["Direct flights available"],
        },
        finalSummary: "Six-day Tokyo plan",
      },
      generationPhase: null,
      generatedItinerary: null,
      generationAttempts: 1,
      generationError: null,
    },
  };
}

function createGenerationSuccessPayload() {
  return {
    session: {
      status: "GENERATING",
      planningBrief: {
        destinations: ["Kyoto"],
        startingLocation: {
          city: "Singapore",
          preferredDepartureAirport: "SIN",
        },
        travelTiming: {
          month: 11,
          year: 2030,
          monthWindow: "MID",
          exactDateRange: {
            startDate: "2030-11-10",
            endDate: "2030-11-14",
          },
        },
        tripLengthDays: 5,
        travellers: {
          adults: 2,
          children: 0,
        },
        budget: "mid-range",
        interestsAndStyle: ["temples", "food"],
        practicality: {
          isPractical: true,
          notes: ["Good rail coverage"],
        },
        finalSummary: "Kyoto in November",
      },
      generationPhase: "GENERATING_ITINERARY",
      generatedItinerary: null,
      generationAttempts: 2,
      generationError: null,
    },
  };
}

async function validPayloadsAreParsedAndRequestsAreShaped() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const mockFetch = createMockFetch((input, init) => {
    const url = String(input);
    calls.push({ url, init });

    if (url.endsWith("/clarify")) {
      return new Response(JSON.stringify(createClarificationSuccessPayload()), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return new Response(JSON.stringify(createGenerationSuccessPayload()), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  });

  const clarificationStart = await requestPlanningSessionClarificationStart(
    "session-a",
    { fetchImpl: mockFetch },
  );
  const clarificationReply = await requestPlanningSessionClarificationReply(
    "session-a",
    "October works",
    { fetchImpl: mockFetch },
  );
  const generationStart = await requestPlanningSessionGenerationStart("session-a", {
    fetchImpl: mockFetch,
  });
  const generationState = await requestPlanningSessionGenerationState("session-a", {
    fetchImpl: mockFetch,
  });

  assert.equal(clarificationStart.status, "CLARIFYING");
  assert.equal(clarificationReply.clarificationMessages.length, 1);
  assert.equal(generationStart.status, "GENERATING");
  assert.equal(generationState.generationAttempts, 2);

  assert.equal(calls.length, 4);
  assert.equal(calls[0]?.url, "/api/planning-sessions/session-a/clarify");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[1]?.url, "/api/planning-sessions/session-a/clarify");
  assert.equal(calls[1]?.init?.method, "POST");
  assert.equal(calls[2]?.url, "/api/planning-sessions/session-a/generate");
  assert.equal(calls[2]?.init?.method, "POST");
  assert.equal(calls[3]?.url, "/api/planning-sessions/session-a/generation");
  assert.equal(calls[3]?.init?.method, "GET");
}

async function malformedSuccessPayloadFailsSafely() {
  const mockFetch = createMockFetch(() =>
    new Response(JSON.stringify({ session: { status: 12345 } }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    }),
  );

  await assert.rejects(
    requestPlanningSessionGenerationState("session-b", { fetchImpl: mockFetch }),
    (error: unknown) =>
      error instanceof PlanningSessionClientApiError &&
      error.message === "Invalid generation response.",
  );
}

async function nonJsonFailureUsesSafeFallbackMessage() {
  const mockFetch = createMockFetch(
    () => new Response("upstream failure", { status: 503 }),
  );

  await assert.rejects(
    requestPlanningSessionClarificationStart("session-c", {
      fetchImpl: mockFetch,
    }),
    (error: unknown) =>
      error instanceof PlanningSessionClientApiError &&
      error.message === "Unable to complete that request. Please try again.",
  );
}

async function serverErrorMessageIsPreserved() {
  const mockFetch = createMockFetch(
    () =>
      new Response(
        JSON.stringify({
          error: {
            code: "USAGE_LIMIT_EXCEEDED",
            message:
              "Clarification turn limit reached for this session. Start a new session to continue.",
          },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
  );

  await assert.rejects(
    requestPlanningSessionClarificationReply("session-d", "reply", {
      fetchImpl: mockFetch,
    }),
    (error: unknown) =>
      error instanceof PlanningSessionClientApiError &&
      error.message ===
        "Clarification turn limit reached for this session. Start a new session to continue.",
  );
}

async function run() {
  await validPayloadsAreParsedAndRequestsAreShaped();
  await malformedSuccessPayloadFailsSafely();
  await nonJsonFailureUsesSafeFallbackMessage();
  await serverErrorMessageIsPreserved();

  console.log("planning-session-client-api-regression: pass");
}

run();
