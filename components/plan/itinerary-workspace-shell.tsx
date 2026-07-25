import { ItineraryWorkspaceRuntime } from "@/components/plan/itinerary-workspace-runtime";
import type { PlanningSessionRecord } from "@/lib/planning-sessions/repository";

interface ItineraryWorkspaceShellProps {
  session: PlanningSessionRecord;
}

export function ItineraryWorkspaceShell({ session }: ItineraryWorkspaceShellProps) {
  return <ItineraryWorkspaceRuntime session={session} />;
}