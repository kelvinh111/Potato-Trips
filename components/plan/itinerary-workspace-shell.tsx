import { ItineraryWorkspacePanel } from "@/components/plan/itinerary-workspace-panel";
import { PlanningChatPanel } from "@/components/plan/planning-chat-panel";
import { ReservedMapSlot } from "@/components/plan/reserved-map-slot";
import type { PlanningSessionRecord } from "@/lib/planning-sessions/repository";

interface ItineraryWorkspaceShellProps {
  session: PlanningSessionRecord;
}

export function ItineraryWorkspaceShell({ session }: ItineraryWorkspaceShellProps) {
  return (
    <main className="flex min-h-0 flex-1 overflow-hidden">
      <div className="grid min-h-0 w-full flex-1 grid-cols-1 grid-rows-[minmax(18rem,1fr)_minmax(18rem,1fr)] gap-4 overflow-x-hidden overflow-y-auto p-4 sm:gap-5 sm:p-5 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)_minmax(16rem,22rem)] lg:grid-rows-1 lg:gap-6 lg:overflow-hidden lg:p-6">
        <PlanningChatPanel
          key={session.id}
          sessionId={session.id}
          initialPrompt={session.initialPrompt}
          status={session.status}
          clarificationMessages={session.clarificationMessages}
        />
        <ItineraryWorkspacePanel />
        <ReservedMapSlot />
      </div>
    </main>
  );
}