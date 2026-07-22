# 11 — Clarification Chat

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/11-clarification-chat`

Do not implement this feature directly on `main`.

## Goal

Turn the Planning Chat panel into a working AI clarification flow.

The AI should inspect the initial trip prompt, ask focused follow-up questions when needed, build a structured planning brief, and move the session to `READY_TO_GENERATE` once enough information is known.

Do not generate the itinerary in this feature.

## Planning Session State

Extend `PlanningSession` with:

- `clarificationMessages` JSON
- nullable `planningBrief` JSON

Create the required Prisma migration.

`initialPrompt` remains the first user message and must not be duplicated in `clarificationMessages`.

Validate persisted JSON through application-owned Zod schemas.

## Planning Brief

Track the available trip requirements, including:

- destinations
- dates or duration
- traveller count
- budget
- pace
- travel style
- interests
- preferences
- constraints

Unknown values must remain unknown rather than being invented.

A session is ready when:

- at least one destination is known
- and either trip duration or an exact start/end date range is known

Other preferences are optional and should only be asked when useful.

## AI Clarification

Use the existing `AiProvider` structured generation boundary.

Each AI response must return validated structured data containing:

- `assistantMessage`
- `readiness`: `NEEDS_CLARIFICATION` or `READY`
- updated `planningBrief`

AI behaviour must:

- use information already provided
- avoid repeating answered questions
- never invent missing trip facts
- ask at most 1–3 focused questions per turn
- stay concise
- not generate itinerary content yet

## Clarification API

Add:

`POST /api/planning-sessions/[sessionId]/clarify`

Support:

- `{ action: "start" }`
- `{ action: "reply", message: string }`

Validate session id and request body.

The server must:

- reject missing or expired sessions
- operate only on clarification-stage sessions
- call `AiProvider`
- persist the completed user/assistant turn and updated planning brief
- move status to `READY_TO_GENERATE` only when AI returns `READY`

Do not leave partial conversation state when the AI request fails.

Repeated initial-start requests must not create duplicate assistant messages.

## Chat UI

Replace the existing placeholder chat with the real conversation.

Show:

- `initialPrompt` as the first user message
- stored user replies
- stored assistant replies

Automatically start clarification when a new `CLARIFYING` session opens.

The composer must support:

- non-empty trimmed messages
- Enter to send
- Shift+Enter for newline
- loading and duplicate-submit prevention
- retryable error feedback
- scroll to the latest message

When status becomes `READY_TO_GENERATE`, keep the conversation visible and disable the composer.

Do not automatically generate the itinerary.

## Out of Scope

Do not implement:

- itinerary generation
- Trigger.dev generation tasks
- kanban or map data
- place lookup
- saved trips
- collaboration
- usage limits
- AI refinement
- streaming responses

## Check When Done

- clarification state persists in PlanningSession
- Prisma migration applies successfully
- initial prompt appears as the first chat message
- first AI clarification starts automatically without duplication
- AI uses the existing `AiProvider`
- structured AI output and persisted JSON are Zod validated
- clarification survives refresh
- failed AI calls do not create partial conversation turns
- destination plus duration/date range can move status to `READY_TO_GENERATE`
- optional preferences are not mandatory
- composer works during clarification and disables when ready
- no itinerary generation or Trigger.dev workflow is added
- `npx prisma validate` passes
- `npm run lint` passes
- `npm run build` passes
- live clarification flow succeeds
- `context/progress-tracker.md` is updated
- `12-initial-itinerary-generation.md` is listed as next