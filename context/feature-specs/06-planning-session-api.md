# 06 — Planning Session API

Read `AGENTS.md` before starting.

## Goal

Add the API and browser-storage foundation for creating and reading anonymous planning sessions.

This unit exposes the `PlanningSession` model created in Feature 05. It does not connect the Home page or workspace UI yet.

## Validation

Install and use Zod for runtime validation.

The initial prompt must:

- be a string
- be trimmed before storage
- contain at least 1 non-whitespace character
- contain no more than 2000 characters after trimming

Malformed JSON, invalid request bodies, and invalid route parameters must return a validation error without reaching Prisma.

## Create Planning Session

Add:

`POST /api/planning-sessions`

This endpoint is public and does not require Clerk authentication.

The request body is:

`{ "initialPrompt": "..." }`

On a valid request:

- create a new `PlanningSession`
- store the trimmed prompt
- use the database default status of `CLARIFYING`
- set `expiresAt` to seven days after creation
- return `201 Created`

Return only:

- `id`
- `initialPrompt`
- `status`
- `expiresAt`

Each valid request creates a new session. Do not add idempotency behaviour.

## Read Planning Session

Add:

`GET /api/planning-sessions/[sessionId]`

Validate `sessionId` as a non-empty bounded string before querying the database.

Responses:

- return `200 OK` with the session when it exists and has not expired
- return `404 Not Found` when no matching session exists
- return `410 Gone` when `expiresAt` is less than or equal to the current time

Do not return session data for expired sessions.

Return the same session fields as the create endpoint.

## Response Format

Successful responses use:

`{ "session": { ... } }`

Error responses use:

`{ "error": { "code": "...", "message": "..." } }`

Use these error codes:

- `INVALID_REQUEST`
- `PLANNING_SESSION_NOT_FOUND`
- `PLANNING_SESSION_EXPIRED`
- `INTERNAL_ERROR`

Do not expose Prisma errors, stack traces, environment values, or other internal details.

## Implementation Boundaries

Keep route handlers thin.

Place reusable validation, expiry rules, and Prisma operations under `lib/planning-sessions/`.

Define the seven-day session lifetime as one server-side constant rather than duplicating the value across route handlers.

Use the shared Prisma client from `lib/prisma.ts`.

Do not modify the Prisma schema or create a migration in this unit.

## Browser Session Storage

Add a small browser-storage helper for the active planning-session identifier.

Use:

`potato-trips:planning-session-id`

Provide functions to:

- save a session ID
- read the saved session ID
- clear the saved session ID

Use `localStorage`.

The helper must:

- avoid React dependencies
- be safe when browser storage is unavailable
- not access `window` during server rendering

Do not connect this helper to the Home page yet.

## Out of Scope

Do not implement:

- Home prompt submission
- workspace navigation or UI
- AI clarification
- chat messages
- itinerary generation
- session updates or deletion
- expiry cleanup jobs
- Clerk ownership
- saved trips
- rate limiting or billing
- new database models or migrations

## Check When Done

- valid POST requests return `201` and create a database record
- prompts are trimmed before storage
- new sessions default to `CLARIFYING`
- `expiresAt` is seven days after creation
- valid GET requests return the matching unexpired session
- missing sessions return `404`
- expired sessions return `410`
- blank, malformed, incorrectly typed, and overlong prompts return `400`
- responses use the documented success and error shapes
- Prisma and internal errors are not exposed
- the browser-storage helper can save, read, and clear the session ID
- no Prisma schema or migration changes were made
- `npm run lint` passes
- `npm run build` passes
- `context/progress-tracker.md` is updated
- `07-itinerary-workspace-shell.md` is listed as next