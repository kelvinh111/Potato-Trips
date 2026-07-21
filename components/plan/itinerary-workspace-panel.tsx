export function ItineraryWorkspacePanel() {
  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-3xl border border-border-default bg-bg-surface shadow-sm">
      <header className="border-b border-border-subtle px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold text-text-primary">Itinerary Plan</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex h-full min-h-48 items-center justify-center rounded-3xl border border-dashed border-border-default bg-bg-subtle/50 p-8 text-center">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-text-primary">
              No itinerary yet
            </h2>
            <p className="max-w-md text-sm text-text-secondary">
              Your itinerary will appear here after planning is complete.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}