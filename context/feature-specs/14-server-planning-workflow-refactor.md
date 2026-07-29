# 14 — Server Planning Workflow Refactor

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/14-server-planning-workflow-refactor`

Do not implement this feature directly on `main`.

## Goal

Separate clarification workflow orchestration from HTTP and persistence concerns without changing any public API or product behaviour.

Spec 13 must be complete and verified first.

## Primary Boundary

This unit covers the server-side clarification workflow used by:

`POST /api/planning-sessions/[sessionId]/clarify`

## Requirements

1. Keep the route handler responsible only for route/body validation, invoking the clarification workflow, and mapping the workflow result to the existing HTTP response contract.
2. Move clarification sequencing and policy decisions into a focused application-owned workflow service, including start idempotency, stage checks, usage limits, confirmation/revision handling, and generation start after explicit confirmation.
3. Keep repository modules focused on data access and atomic persistence; clarification orchestration, AI calls, and HTTP response construction must not live in repository code.
4. Preserve optimistic-concurrency protection, AI-turn reservation, no-partial-turn persistence, and the existing idempotent generation operation.
5. Add focused regression coverage around the extracted workflow using controlled dependencies; do not call live AI, Trigger.dev, or other paid providers.

## Behaviour to Preserve

- Existing request bodies, success payloads, error payloads, status codes, and user-facing messages
- Repeated `start` requests do not create duplicate assistant messages
- Clarification and confirmation/revision limits use their current counters and thresholds
- A confirmation containing changed requirements returns to confirmation instead of generating
- Plain confirmation and the Generate button continue to use the same generation operation
- Expired, missing, invalid-stage, concurrent, provider-failure, and usage-limit outcomes remain unchanged

## Structural Limits

- Refactor only the clarification workflow and the persistence functions it directly uses.
- Generation worker, generation routes, generated-itinerary validation, and client code remain untouched.
- Preserve existing exported contracts where changing them is not required for the separation.
- Prefer focused modules named by responsibility; do not create a generic service or utility dumping ground.

## Out of Scope

- Planning-brief contract changes
- Product or API behaviour changes
- Generation state-machine redesign
- Client API or React refactors
- UI/UX changes
- New dependencies, providers, routes, or database fields

## Check When Done

- the clarify route is thin and contains no workflow sequencing
- the clarification workflow has one clear application-owned entry point
- repository code contains persistence and atomic transition logic rather than HTTP or AI orchestration
- focused tests cover start idempotency, reply persistence, confirmation/revision, limits, and a representative failure/concurrency path
- no test consumes live AI or Trigger.dev usage
- the existing Feature 12 clarification and confirmation manual flow is unchanged
- targeted lint and type checks pass
- `npm run build` passes once after focused checks are stable
- `context/progress-tracker.md` is updated
- Spec 15A is listed as next
