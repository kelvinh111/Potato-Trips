import type { ReactNode } from "react";

import { AppHeader } from "@/components/app/app-header";
import { ItineraryWorkspaceShell } from "@/components/plan/itinerary-workspace-shell";
import { PlanUnavailableState } from "@/components/plan/plan-unavailable-state";
import { isPlanningSessionExpired } from "@/lib/planning-sessions/expiry";
import { findPlanningSessionById } from "@/lib/planning-sessions/repository";
import { planningSessionIdSchema } from "@/lib/planning-sessions/validation";

interface PlanPageProps {
  params: Promise<{
    sessionId?: string;
  }>;
}

type PlanViewState = "workspace" | "unavailable" | "expired";

function PlanPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-bg-base">
      <AppHeader />
      {children}
    </div>
  );
}

export default async function PlanPage({ params }: PlanPageProps) {
  const resolvedParams = await params;
  const parsedSessionId = planningSessionIdSchema.safeParse(
    resolvedParams.sessionId,
  );

  if (!parsedSessionId.success) {
    return renderPlanState("unavailable");
  }

  let state: PlanViewState = "workspace";

  try {
    const session = await findPlanningSessionById(parsedSessionId.data);

    if (!session) {
      state = "unavailable";
    }

    if (session && isPlanningSessionExpired(session.expiresAt)) {
      state = "expired";
    }
  } catch {
    state = "unavailable";
  }

  return renderPlanState(state);
}

function renderPlanState(state: PlanViewState) {
  if (state === "workspace") {
    return (
      <PlanPageFrame>
        <ItineraryWorkspaceShell />
      </PlanPageFrame>
    );
  }

  if (state === "expired") {
    return (
      <PlanPageFrame>
        <PlanUnavailableState
          title="Plan Expired"
          description="This planning session has expired. Start a new plan from the home page."
        />
      </PlanPageFrame>
    );
  }

  return (
    <PlanPageFrame>
      <PlanUnavailableState
        title="Plan Unavailable"
        description="This planning session is unavailable. Start a new plan from the home page."
      />
    </PlanPageFrame>
  );
}