# 08 — Home Prompt Flow

Read `AGENTS.md` before starting.

## Goal

Connect the Home trip prompt to the anonymous planning-session flow:

Home prompt → create planning session → save session ID → open `/plan/[sessionId]`.

Do not implement AI clarification or itinerary generation yet.

## Home Form

Keep the existing Home design.

Convert the textarea to a controlled input and track:

- prompt value
- submitting state
- error message

Reuse the existing planning-session Zod validation.

Before calling the API:

- trim the prompt
- reject blank input
- reject prompts over 2000 characters

Invalid input must not call the API.

## Submit Flow

On valid submission:

1. immediately enter submitting state
2. disable further submission
3. call `POST /api/planning-sessions`
4. send `{ "initialPrompt": "..." }`
5. confirm the response contains a non-empty `session.id`
6. save it with `savePlanningSessionId(session.id)`
7. navigate with `useRouter()` to `/plan/[sessionId]`

Do not call Prisma directly from the client.

Do not call the planning-session GET endpoint before navigation.

Starting a new Home prompt always creates a new planning session.

## Loading State

While submitting:

- disable the submit button
- prevent duplicate submission
- replace the ArrowUp icon with an animated Lucide `LoaderCircle`
- optionally disable the textarea

The loading state must begin immediately after a valid submit.

## Error Handling

Handle:

- client validation failures
- API errors
- network failures
- malformed or unexpected successful responses

Show a user-friendly error prompt near the form.

Do not expose raw API errors, Prisma details, stack traces, or internal implementation details.

After an error:

- leave the prompt unchanged
- restore the normal submit state
- allow retry
- automatically hide the error after a few seconds

Clear any existing error when a new submission begins.

Ensure an older dismissal timer cannot clear a newer error message.

## Browser Storage

Use the existing planning-session storage helper.

Saving the session ID is best-effort.

A localStorage failure must not prevent navigation.

Do not:

- read the stored session ID on Home mount
- auto-resume an old session
- redirect from Home based on localStorage

## Out of Scope

Do not implement:

- AI clarification
- chat messages or chat submission
- rendering the initial prompt as a chat message
- itinerary generation
- kanban or map behaviour
- new planning-session endpoints
- Clerk ownership or saved-trip conversion
- Prisma schema changes or migrations
- usage limits or rate limiting

## Check When Done

- blank and overlong prompts are rejected before API submission
- valid submit creates one planning session
- duplicate clicks cannot create additional sessions
- ArrowUp changes to animated `LoaderCircle` while submitting
- successful responses save the session ID
- successful submission navigates to `/plan/[sessionId]`
- storage failure does not block navigation
- failures show a user-friendly temporary error prompt
- prompt content is preserved after failure
- retry works after an error
- Home does not auto-resume stored sessions
- no Prisma schema or migration changes were made
- `npm run lint` passes
- `npm run build` passes
- `context/progress-tracker.md` is updated