# 12 — Initial Itinerary Generation

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/12-initial-itinerary-generation`

Do not implement this feature directly on `main`.

## Goal

Complete the anonymous planning flow from clarification through confirmed initial itinerary generation.

This feature replaces the previous minimal readiness rule from Feature 11.

The user must first provide enough practical trip information, review the completed planning brief, and explicitly confirm before the expensive generation workflow begins.

Long-running itinerary generation must run through Trigger.dev.

## Required Planning Information

A planning session is not ready until these areas are resolved:

- Destination
- Starting location
- Travel timing
- Trip length
- Travellers
- Budget
- Interests / travel style

Requirements:

- starting location must be known at least to city level
- a preferred departure airport may be stored when supplied, but must not be treated as verified flight availability
- destination scope may be a city, region, country, or multi-destination trip
- AI must judge whether the requested destination scope is practical for the available trip length
- do not hard-code country, region, or geographic feasibility rules
- travel timing must identify at least a month and year
- exact dates and early/mid/late-month timing are optional
- when exact dates are unknown, keep them flexible; never invent calendar dates such as the first day of the month
- trip length must be between 1 and 14 days inclusive
- traveller information must distinguish travellers aged 12+ from children under 12
- exact ages, senior status, mobility needs, relationships, and similar details are optional unless volunteered
- budget may be qualitative or quantitative but must communicate the intended spending level
- interests / travel style must provide enough direction to meaningfully shape the itinerary

Unknown facts must remain unknown rather than being silently invented.

## AI Clarification and Readiness

Continue using natural-language chat rather than questionnaire-style controls.

The AI should:

- extract multiple planning details from one user reply when possible
- ask related missing information together instead of one question per turn
- clearly tell the user what information is still needed
- avoid repeating questions already answered
- identify requirements that are materially unrealistic or internally inconsistent
- ask the user to adjust an impractical plan rather than generating an unusable itinerary
- stop asking questions once the required information is sufficient and practical
- present a concise final planning summary before generation

Update the structured clarification result so it can distinguish:

- more clarification is required
- the trip is ready for final confirmation
- the user has explicitly confirmed generation

Do not detect confirmation using a fixed list or regex only. Natural replies such as `yes`, `looks good`, or `go for it` must be understood in conversation context.

If the user changes any trip requirement while confirming, update the brief and present confirmation again instead of starting generation immediately.

## Final Confirmation

When all required information is resolved:

- keep the chat composer enabled
- set the session to `READY_TO_GENERATE`
- have the assistant present the final planning summary
- show a `Generate my trip` button in the planning-status panel

Generation may start through either:

1. explicit natural-language confirmation in chat
2. the `Generate my trip` button

Both paths must call the same server-side generation operation and have identical behaviour.

## Planning Status Panel

Before generation, use a two-area workspace:

`Planning Chat | Trip Plan Status`

Do not show the map before generation.

The status panel must remain visible throughout clarification and generation.

Show the actual captured values, for example:

- `Destination: Romania`
- `Starting from: Manchester`
- `When: September 2026`
- `Trip length: 7 days`
- `Travellers: 1 traveller`
- `Budget: Mid-range`
- `Interests: Local culture, food, historic towns`

Use completed and incomplete states so the user can see what remains.

Do not add wizard-style month selectors, traveller forms, or other special clarification controls. Chat remains the primary input method.

## Generation Progress

After confirmation, keep the confirmed trip information visible and append generation progress below it.

Disable the chat composer while generation is running.

Do not provide a Stop / Cancel generation action in V1.

Use real application phases rather than fake percentages:

- Preparing your trip
- Generating your itinerary
- Checking the plan
- Saving your itinerary

Persist enough generation state for refresh to restore the correct phase.

When generation completes, stop showing the planning-status panel and return the workspace to the generated-trip layout.

Do not implement the Kanban or Google Map contents in this feature.

## Generation Workflow

Add an idempotent server-side initial-generation operation.

The first valid confirmation must:

1. atomically move the session from `READY_TO_GENERATE` to `GENERATING`
2. start one Trigger.dev initial-itinerary-generation task
3. use the persisted planning brief as the canonical generation input
4. generate structured itinerary data through the existing `AiProvider`
5. validate and normalize the AI output
6. persist the completed itinerary
7. move the session to `GENERATED`

Repeated button clicks, duplicate requests, multiple tabs, or simultaneous chat/button confirmation must not start duplicate generation runs.

If generation fails, move the session to `FAILED`, keep the confirmed planning information visible, and provide a retry action.

A failed attempt must not persist a partial itinerary.

## Generated Itinerary

Persist the anonymous generated itinerary on `PlanningSession` as application-owned validated JSON.

Define separate schemas for AI output and persisted normalized itinerary data.

The itinerary must contain:

- trip title and short summary
- ordered trip days
- ordered itinerary items for each day
- item type, title, description, and useful planning text
- optional suggested time or duration where appropriate
- major transport items where useful

Application code, not the AI, must create stable day/item identifiers.

Do not generate or pretend to verify:

- Google Place IDs
- coordinates
- addresses
- opening hours
- ratings
- photos
- flight numbers
- fares
- live transport availability

Place suggestions remain unverified until later Google Maps / Places features.

## Generation API

Add dedicated generation endpoints for:

- starting/retrying initial generation
- retrieving generation status and generated itinerary state

Keep the existing Feature 06 public planning-session API contract unchanged.

The generation start operation must be server-side, idempotent, and protected by a small per-session attempt limit.

Do not expose Trigger.dev identifiers, provider errors, or internal failure details to the browser.

## Out of Scope

Do not implement:

- Kanban rendering
- drag and drop
- Google Maps or Places lookup
- verified routing or local transport segments
- live flights, hotels, fares, or booking inventory
- saved `Trip`, `TripDay`, or `ItineraryItem` database models
- collaboration
- AI itinerary refinement
- generation cancellation
- fake percentage progress
- streaming AI output

## Check When Done

- required planning information replaces the old Feature 11 minimal readiness rule
- month + year is sufficient timing without inventing exact dates
- trips longer than 14 days are rejected and the user is asked to shorten them
- AI can identify clearly impractical destination/duration combinations and request adjustment
- final planning summary appears before generation
- chat remains usable while awaiting confirmation
- chat confirmation and `Generate my trip` start the same operation
- simultaneous confirmation paths cannot create duplicate Trigger.dev runs
- pre-generation workspace shows Chat + Trip Plan Status without the map
- checklist values update from the persisted planning brief
- generation keeps confirmed information visible
- generation progress reflects real workflow phases
- composer is disabled while `GENERATING`
- generated itinerary is structured, validated, persisted, and survives refresh
- failed generation leaves no partial itinerary and can be retried
- no Kanban, Maps, Places, booking, collaboration, or saved-trip implementation is added
- `npx prisma validate` passes
- `npm run prisma:generate` passes
- `npm run lint` passes
- `npm run build` passes
- live end-to-end generation succeeds through Trigger.dev
- `context/project-overview.md` is updated for the confirmation-before-generation flow
- `context/progress-tracker.md` is updated
- `13-itinerary-kanban.md` is listed as next