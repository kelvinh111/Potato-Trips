# 05 — Planning Session Model

Read `AGENTS.md` before starting.

## Goal

Add the first application data model for anonymous trip planning.

This unit defines `PlanningSession`, its lifecycle status, expiry, and initial prompt. It also creates the first Prisma migration.

## PlanningSession

Add a `PlanningSession` model to `prisma/schema.prisma`.

Fields:

- `id` — string primary key with a generated non-sequential identifier
- `initialPrompt` — required text submitted by the user
- `status` — `PlanningSessionStatus`, defaulting to `CLARIFYING`
- `expiresAt` — required expiry timestamp
- `createdAt` — creation timestamp
- `updatedAt` — automatically updated timestamp

The `id` is both:

- the internal primary key
- the public session identifier stored by the browser in later features

Add an index on `expiresAt`.

Do not add a separate session token.

## Status Enum

Add `PlanningSessionStatus` with:

- `CLARIFYING`
- `READY_TO_GENERATE`
- `GENERATING`
- `GENERATED`
- `FAILED`

Do not add `EXPIRED`; expiry is determined from `expiresAt`.

Do not add `CLAIMED`; converting a session into a saved trip belongs to a later feature.

## Migration

Create and apply the first migration with a descriptive name such as:

`add_planning_session`

The migration should create only:

- the `PlanningSessionStatus` enum
- the `PlanningSession` table
- the required index

Inspect the generated SQL before completing the feature.

Regenerate Prisma Client after the migration.

## Out of Scope

Do not implement:

- planning-session API routes
- browser session storage
- clarification messages or answers
- generated itinerary data
- expiry cleanup jobs
- Clerk ownership
- `Trip` or other domain models
- UI changes
- Home prompt submission

## Check When Done

- `PlanningSession` contains only the specified fields
- `PlanningSessionStatus` contains the five specified values
- `id` is used as both the primary key and session identifier
- `status` defaults to `CLARIFYING`
- `expiresAt` is indexed
- the migration runs successfully
- the generated SQL contains no unrelated tables or fields
- Prisma Client generates successfully
- `npx prisma validate` passes
- `npm run lint` passes
- `npm run build` passes
- `context/progress-tracker.md` is updated
- `06-planning-session-api.md` is listed as next