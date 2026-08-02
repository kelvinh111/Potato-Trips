"use client";

import { Loader2 } from "lucide-react";

import { AssistantMarkdown } from "@/components/plan/assistant-markdown";
import { Button } from "@/components/ui/button";
import type { PlanningSessionGenerationController } from "@/lib/planning-sessions/generation-controller";
import type {
  PlanningBrief,
  PlanningSessionGenerationPhaseValue,
} from "@/lib/planning-sessions/types";

interface TripPlanStatusPanelProps {
  generationController: PlanningSessionGenerationController;
}

interface RequirementViewModel {
  label: string;
  value: string;
  complete: boolean;
}

const generationPhaseLabels: Record<PlanningSessionGenerationPhaseValue, string> = {
  PREPARING_TRIP: "Preparing your trip",
  GENERATING_ITINERARY: "Generating your itinerary",
  CHECKING_PLAN: "Checking the plan",
  SAVING_ITINERARY: "Saving your itinerary",
};

export function TripPlanStatusPanel({
  generationController,
}: TripPlanStatusPanelProps) {
  const {
    sessionState,
    generationError,
    generationPollingNotice,
    isRefreshingGenerationState,
    isStartingGeneration,
    startGeneration,
    refreshGenerationState,
  } = generationController;

  const status = sessionState.status;
  const planningBrief = sessionState.planningBrief;
  const generationPhase = sessionState.generationPhase;
  const generationAttempts = sessionState.generationAttempts;

  const requirements = buildRequirementRows(planningBrief);

  const canGenerate =
    status === "READY_TO_GENERATE" || status === "FAILED";

  const generateButtonClassName =
    status === "READY_TO_GENERATE"
      ? "w-full rounded-2xl bg-accent-secondary text-text-primary hover:bg-accent-secondary-hover"
      : "w-full rounded-2xl";

  return (
    <section
      aria-label="Trip plan status panel"
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl bg-bg-surface"
    >
      <h2 className="sr-only">Trip Plan Status</h2>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <ul className="space-y-3">
          {requirements.map((row) => (
            <li
              key={row.label}
              className={`rounded-2xl border px-3 py-3 ${
                row.complete
                  ? "border-state-success/35 bg-state-success/10"
                  : "border-border-subtle bg-bg-subtle"
              }`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {row.label}
              </p>
              <p className="mt-1 text-sm text-text-primary">{row.value}</p>
            </li>
          ))}
        </ul>

        {planningBrief?.finalSummary ? (
          <div className="mt-4 rounded-2xl border border-border-subtle bg-bg-subtle px-3 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Final planning summary
            </p>
            <AssistantMarkdown
              content={planningBrief.finalSummary}
              className="mt-1 text-sm text-text-primary"
            />
          </div>
        ) : null}

        {status === "GENERATING" ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 rounded-2xl border border-accent-primary/30 bg-accent-primary-dim px-3 py-3"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              Generation progress
            </p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {generationPhase ? generationPhaseLabels[generationPhase] : "Preparing your trip"}
            </p>
          </div>
        ) : null}

        {generationError ? (
          <div
            role="alert"
            aria-live="assertive"
            className="mt-4 rounded-2xl border border-state-error/30 bg-state-error/10 px-3 py-3 text-sm text-state-error"
          >
            {generationError}
          </div>
        ) : null}

        {generationPollingNotice ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-4 rounded-2xl border border-state-warning/30 bg-state-warning/10 px-3 py-3 text-sm text-text-primary"
          >
            <p>{generationPollingNotice}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void refreshGenerationState();
              }}
              disabled={isRefreshingGenerationState}
              className="mt-2 rounded-xl px-2"
            >
              {isRefreshingGenerationState ? "Checking status..." : "Check status"}
            </Button>
          </div>
        ) : null}

        {(status === "READY_TO_GENERATE" || status === "FAILED") && (
          <div className="mt-4">
            <Button
              type="button"
              onClick={() => {
                void startGeneration();
              }}
              disabled={!canGenerate || isStartingGeneration}
              className={generateButtonClassName}
            >
              {isStartingGeneration ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting generation...
                </span>
              ) : status === "FAILED" ? (
                "Retry generation"
              ) : (
                "Generate my trip"
              )}
            </Button>
            <p className="mt-2 text-xs text-text-faint">
              Generation attempts used: {generationAttempts}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function buildRequirementRows(brief: PlanningBrief | null): RequirementViewModel[] {
  const destinationValue =
    brief?.destinations && brief.destinations.length > 0
      ? brief.destinations.join(", ")
      : "Missing";

  const startingLocationValue = brief?.startingLocation?.city ?? "Missing";

  const whenValue = brief?.travelTiming
    ? formatWhen(brief.travelTiming)
    : "Missing";

  const tripLengthValue =
    brief?.tripLengthDays !== null && brief?.tripLengthDays !== undefined
      ? `${brief.tripLengthDays} days`
      : "Missing";

  const travellersValue = brief?.travellers
    ? `${brief.travellers.adults} adult${brief.travellers.adults === 1 ? "" : "s"}, ${brief.travellers.children} child${brief.travellers.children === 1 ? "" : "ren"}`
    : "Missing";

  const budgetValue = brief?.budget ?? "Missing";

  const interestsValue =
    brief?.interestsAndStyle && brief.interestsAndStyle.length > 0
      ? brief.interestsAndStyle.join(", ")
      : "Missing";

  return [
    {
      label: "Destination",
      value: destinationValue,
      complete: destinationValue !== "Missing",
    },
    {
      label: "Starting from",
      value: startingLocationValue,
      complete: startingLocationValue !== "Missing",
    },
    {
      label: "When",
      value: whenValue,
      complete: whenValue !== "Missing",
    },
    {
      label: "Trip length",
      value: tripLengthValue,
      complete: tripLengthValue !== "Missing",
    },
    {
      label: "Travellers",
      value: travellersValue,
      complete: travellersValue !== "Missing",
    },
    {
      label: "Budget",
      value: budgetValue,
      complete: budgetValue !== "Missing",
    },
    {
      label: "Interests / travel style",
      value: interestsValue,
      complete: interestsValue !== "Missing",
    },
  ];
}

function formatWhen(value: NonNullable<PlanningBrief["travelTiming"]>): string {
  const monthName = new Date(Date.UTC(value.year, value.month - 1, 1)).toLocaleString(
    "en-US",
    { month: "long" },
  );

  const windowLabel =
    value.monthWindow === "EARLY"
      ? "early"
      : value.monthWindow === "MID"
        ? "mid"
        : value.monthWindow === "LATE"
          ? "late"
          : null;

  const base = windowLabel
    ? `${windowLabel} ${monthName} ${value.year}`
    : `${monthName} ${value.year}`;

  if (!value.exactDateRange) {
    return base;
  }

  return `${base} (exact dates set)`;
}
