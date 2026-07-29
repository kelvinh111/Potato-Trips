# 15B — Generation State and Polling Refactor

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/15b-generation-state-and-polling-refactor`

Do not implement this feature directly on `main`.

## Goal

Move client generation state transitions and polling policy out of the workspace renderer into one focused controller while preserving current behaviour.

Spec 15A must be complete and verified first.

## Primary Boundary

This unit covers client-side generation start, status refresh, polling, backoff, pause, and recovery state.

## Requirements

1. Introduce one focused generation controller or hook that owns generation request state, server-state reconciliation, and the actions exposed to the workspace UI.
2. Move polling timers, failure counting, exponential backoff, pause threshold, polling notice, and manual-refresh reset behaviour out of the workspace renderer.
3. Preserve server state as authoritative and reconcile `GENERATING`, `GENERATED`, and `FAILED` responses without creating a competing itinerary state.
4. Keep the workspace runtime responsible for composition and rendering through a small typed controller interface.
5. Add focused deterministic regression coverage for successful progression, transient poll failure/backoff, pause after the existing threshold, manual recovery, completion, and failure.

## Behaviour to Preserve

- Current generation start and retry actions
- Current base interval, maximum backoff, failure threshold, and polling notices
- No polling outside `GENERATING`
- Manual `Check status` resets paused polling and retries immediately
- Refresh restoration continues from persisted server state
- Completion shows the generated-trip placeholder; failure remains retryable

## Structural Limits

- Use the client API boundary from Spec 15A.
- Keep timer cleanup explicit so unmounts and state changes cannot leave stale polling work.
- Do not change server endpoints, persisted state, generation attempts, or Trigger.dev behaviour.
- Do not refactor planning-chat state in this unit.

## Out of Scope

- Client API parsing or request redesign
- Server, repository, Prisma, provider, or worker changes
- New generation phases, cancellation, streaming, or percentages
- Optimistic chat messages
- Layout, copy, color, or other UI/UX changes
- Kanban or Maps

## Check When Done

- the workspace renderer contains no polling timer or backoff policy
- generation actions and state are exposed through one typed client controller
- deterministic checks cover the required transitions without live server or Trigger.dev calls
- no stale timer continues after unmount, pause, completion, or failure
- generation, retry, refresh restoration, pause, and manual recovery behave unchanged in the browser
- targeted lint and type checks pass
- `npm run build` passes once after focused checks are stable
- `context/progress-tracker.md` is updated
- Spec 15C is listed as next
