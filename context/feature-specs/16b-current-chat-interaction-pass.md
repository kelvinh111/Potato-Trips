# 16B — Current Chat Interaction Pass

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/16b-current-chat-interaction-pass`

Do not implement this feature directly on `main`.

## Goal

Improve chat scrolling, submission feedback, and Home keyboard submission in the already implemented planning flow.

Spec 16A must be complete and verified first.

Inspect `Home page.png` and `Itinerary plan.png` before editing. Written interaction requirements take precedence over low-fidelity wireframe details.

## Requirements

1. On desktop, keep the planning workspace within the available viewport height and make the conversation region scroll vertically inside the chat panel instead of extending the page; responsive stacked layouts may continue to use normal page scrolling where necessary.
2. After a valid planning-chat reply is submitted, immediately show a temporary user bubble containing that message and a temporary assistant bubble labelled `Thinking...`, while disabling duplicate submission.
3. On success, reconcile to the server-returned persisted messages and remove temporary bubbles without duplicating the user message or assistant reply.
4. On failure, remove `Thinking...` and the unpersisted user bubble, restore the submitted text to the composer, preserve the existing error/retry behaviour, and keep scrolling and live-region announcements intentional.
5. On the Home textarea, Enter submits a valid prompt, Shift+Enter inserts a newline, and IME composition or candidate confirmation never submits accidentally.

## Interaction Decisions

- Temporary chat bubbles are presentation state only and must not become a second persisted conversation.
- The server response remains authoritative after each request.
- `Thinking...` is visible text, not a fake generated answer or progress percentage.
- The composer remains disabled while a reply request is in flight.
- Auto-scroll should reveal new temporary and persisted messages without stealing focus from the composer.

## Behaviour to Preserve

- Existing clarification/confirmation API requests and server persistence
- Current status-based composer availability
- Existing initial auto-start and retry behaviour
- Home validation, error handling, session storage, and navigation
- Generation, polling, retry, and refresh restoration

## Out of Scope

- Streaming responses, cancellation, editing, or deleting messages
- Server, repository, Prisma, provider, or Trigger.dev changes
- New chat persistence or global state
- Further visual redesign beyond interaction states needed here
- Kanban, Maps, Places, saved trips, or collaboration
- Changes to `components/ui/*`

## Check When Done

- a long desktop conversation scrolls inside the chat panel without increasing page height
- the submitted user bubble and `Thinking...` appear before the API response
- success replaces temporary bubbles with exactly one persisted user/assistant pair
- failure removes temporary bubbles, restores the draft, and shows the existing retryable error
- duplicate submission is blocked while the request is pending
- Home Enter submits, Shift+Enter creates a newline, and IME input does not submit accidentally
- keyboard focus and live-region behaviour remain accessible
- targeted interaction and lint checks pass
- `npm run build` passes once after focused browser checks are stable
- `context/progress-tracker.md` is updated
- Spec 17 is listed as next but is not implemented
