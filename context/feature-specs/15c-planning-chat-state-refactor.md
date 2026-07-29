# 15C — Planning Chat State Refactor

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/15c-planning-chat-state-refactor`

Do not implement this feature directly on `main`.

## Goal

Move planning-chat interaction state out of its presentation component into one focused controller without changing current chat behaviour.

Specs 15A and 15B must be complete and verified first.

## Primary Boundary

This unit covers clarification auto-start, draft submission, request state, retry state, and composer availability.

## Requirements

1. Introduce one focused chat controller or hook that owns auto-start, draft state, submission state, request errors, and actions used by the presentation component.
2. Ensure auto-start remains idempotent in React development behaviour and never creates a second first assistant request when persisted assistant messages already exist.
3. Preserve composer availability for `CLARIFYING` and `READY_TO_GENERATE`, and its current disabled behaviour for generation, failure, and in-flight requests.
4. Keep message view-model construction and rendering simple, typed, and derived from persisted messages plus the initial prompt.
5. Add focused deterministic regression coverage for auto-start, reply success, reply failure, retry, status-based disabling, and duplicate-submission prevention.

## Behaviour to Preserve

- Current planning-chat message order and persisted-message rendering
- Current Enter, Shift+Enter, and IME handling in the planning workspace
- Draft clearing only after the existing successful reply path
- Existing errors and start-retry behaviour
- Existing scrolling and loading presentation
- No optimistic user bubble or assistant `Thinking...` bubble yet

## Structural Limits

- Use the client API boundary from Spec 15A.
- Do not move server state into a second client store.
- Keep browser interaction code on the client and keep presentation free of API details.
- Do not refactor the Home prompt in this unit.

## Out of Scope

- Server, repository, Prisma, provider, or worker changes
- Generation controller or polling changes
- Optimistic message behaviour
- Home Enter/Shift+Enter behaviour
- Chat layout, scrollbar, colors, borders, headings, or visual changes
- New chat features, streaming, cancellation, or history model

## Check When Done

- the presentation component contains no API request or auto-start orchestration
- one typed controller owns chat interaction state and actions
- focused checks pass without network, live AI, or Trigger.dev
- auto-start, reply, failure, retry, keyboard, IME, and disabled states behave unchanged
- no optimistic or new visible behaviour was introduced
- targeted lint and type checks pass
- `npm run build` passes once after focused checks are stable
- `context/progress-tracker.md` is updated
- Spec 16A is listed as next
