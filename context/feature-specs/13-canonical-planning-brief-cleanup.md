# 13 — Canonical Planning Brief Cleanup

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/13-canonical-planning-brief-cleanup`

Do not implement this feature directly on `main`.

## Goal

Remove the legacy planning-brief contract and retain one strict canonical planning brief throughout the current anonymous planning flow.

All existing `PlanningSession` records are disposable testing data and may be deleted before the strict contract is applied.

## Canonical Contract

The only planning-brief fields are:

- `destinations`
- `startingLocation`
- `travelTiming`
- `tripLengthDays`
- `travellers`
- `budget`
- `interestsAndStyle`
- `practicality`
- `finalSummary`

Keep the existing nested canonical shapes and validation rules.

## Requirements

1. Delete all existing development `PlanningSession` records before removing compatibility support. Do not migrate, backfill, or preserve those records.
2. Remove `dateRange`, `duration`, `travellerCount`, `pace`, `travelStyle`, `interests`, `preferences`, and `constraints` from planning-brief schemas and types.
3. Remove the compatibility schema and every fallback, conversion, or merge path that derives canonical values from legacy fields.
4. Parse persisted and AI-produced planning briefs strictly against the canonical contract while preserving canonical timing normalization, readiness rules, practicality checks, and exact-date/trip-length consistency.
5. Remove remaining application references to the legacy fields and add focused regression coverage proving that canonical briefs are accepted and legacy-shaped briefs are rejected.

## Data Decision

- The cleanup is destructive only for current development `PlanningSession` testing records.
- Do not add a migration script, compatibility reader, dual-write path, or permanent cleanup endpoint.
- No Prisma model or migration change is expected because `planningBrief` remains JSON.
- After cleanup, a stale browser session ID may return an unavailable session; testing must start from Home with a new session.

## Behaviour to Preserve

- Required planning information and the 1–14 day limit remain unchanged.
- Month and year remain sufficient when exact dates are unknown.
- Exact dates remain normalized to their canonical month and year.
- Confirmation, generation, retry, persistence, API responses, and UI behaviour remain unchanged.

## Out of Scope

- Clarification route or repository restructuring
- Client API, state, polling, or component refactors
- New planning behaviour or AI prompt redesign
- Generated-itinerary schema changes
- UI or visual changes
- Kanban, Maps, Places, saved trips, or collaboration

## Check When Done

- development `PlanningSession` records were deleted and the result was reported
- no legacy planning-brief field or compatibility parser remains in application source
- new sessions persist and reload only the canonical planning brief
- focused canonical/legacy parsing and readiness checks pass without live AI or Trigger.dev
- no Prisma schema or migration change was added
- `npx prisma validate` passes
- targeted lint and type checks pass
- `npm run build` passes once after the focused checks are stable
- `context/progress-tracker.md` is updated
- Spec 14 is listed as next
