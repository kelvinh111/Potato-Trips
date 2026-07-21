# 07 — Itinerary Workspace Shell

Read `AGENTS.md` before starting.

## Goal

Add the responsive Itinerary Plan workspace shell for an anonymous planning session.

This unit establishes the page route, shared header, session loading states, three-area desktop layout, and placeholder panels required by later workspace features.

Do not connect the Home prompt or implement planning behaviour yet.

## Route and Session Loading

Add:

`/plan/[sessionId]`

Keep the page as a Server Component.

Validate `sessionId` using the existing planning-session validation.

Load the session directly through the existing repository and expiry helpers. Do not call the project’s own planning-session API from the Server Component.

For a valid unexpired session, render the workspace shell.

Handle these states:

- invalid or missing session — show an unavailable state
- expired session — show a distinct expired state
- unexpected server failure — show a generic unavailable state without internal details

Unavailable states must include an action linking back to the Home page to start a new plan.

Do not display raw errors, stack traces, database details, or the session identifier.

## Shared App Header

Extract the existing Home header into a reusable shared app header.

The header must preserve the current Clerk behaviour:

- signed-out users see Sign In and Sign Up
- signed-in users see the existing avatar menu
- Profile and Sign Out continue to work
- My Trips remains disabled

Update both the Home page and workspace to use the shared header without changing the Home page behaviour.

On the left side of the header:

- display the logo from `/public/img/logo.png`
- keep the text `Potato Trips` beside the logo
- make the combined brand area link to `/`
- use `next/image`
- treat the image as decorative when the adjacent text already provides the accessible brand name

Keep the header full width. Do not constrain the workspace content to the Home page’s centred maximum width.

## Workspace Layout

Below the header, create a full-height workspace that fills the remaining viewport.

On desktop, render three persistent areas:

1. left — planning chat panel
2. centre — itinerary workspace panel
3. right — reserved map slot

Use clear component boundaries rather than placing the entire layout in the route page.

Each area must manage its own overflow so the page does not develop unnecessary nested or horizontal scrollbars.

## Planning Chat Panel

Add a visual shell containing:

- panel heading
- scrollable conversation area
- initial empty or placeholder state
- message composer area

The composer must be visibly disabled.

Do not:

- send messages
- render the initial prompt as a chat message
- display fake AI replies
- implement clarification logic
- add chat persistence

## Itinerary Workspace Panel

Add a centre-panel shell containing:

- `Itinerary Plan` heading
- a clear pre-generation empty state
- brief text explaining that the itinerary will appear after planning is complete

Do not add mock trip data, day columns, itinerary cards, Add Location controls, or drag-and-drop behaviour.

## Reserved Map Slot

Render the right-side map slot as part of the desktop shell.

The slot must:

- reserve the space intended for the future map
- remain visually empty
- use layout boundaries consistent with the other workspace areas
- contain no placeholder label such as `Google Map Area`
- render no map component, markers, route, controls, or fake map content
- load no Google Maps dependency or SDK

The map itself remains hidden until initial itinerary generation. This feature reserves only its layout position.

On narrower tablet and mobile layouts, the empty map slot may be omitted to avoid wasting vertical space.

## Responsive Behaviour

- desktop — chat, workspace, and reserved map slot appear side by side
- smaller screens — chat and workspace stack vertically
- do not introduce complex mobile tabs, drawers, or panel switching
- prevent horizontal page overflow
- preserve usable panel spacing and minimum heights

Use the Itinerary Plan wireframe for layout hierarchy and `ui-context.md` for visual treatment.

Use existing semantic design tokens and shadcn/ui components where appropriate.

## Out of Scope

Do not implement:

- Home prompt submission
- planning-session creation or browser storage integration
- workspace navigation from Home
- AI clarification or chat behaviour
- itinerary generation
- kanban columns or itinerary items
- Google Maps integration
- Add Location or Location Detail
- drag and drop
- session mutation endpoints
- Prisma schema changes or migrations
- trip saving or Clerk ownership
- mock itinerary data

## Check When Done

- `/plan/[sessionId]` renders for a valid unexpired session
- invalid and missing sessions show the unavailable state
- expired sessions show the expired state
- unavailable states link back to Home
- the page loads the session directly through existing server helpers
- Home and workspace use the shared app header
- `/img/logo.png` appears beside the `Potato Trips` text
- existing Clerk header behaviour remains unchanged
- desktop layout shows chat, workspace, and an empty reserved map slot
- the reserved map slot contains no map or placeholder content
- chat composer is disabled
- no fake chat or itinerary data is rendered
- responsive layouts do not produce horizontal overflow
- no Prisma schema or migration changes were made
- `npm run lint` passes
- `npm run build` passes
- `context/progress-tracker.md` is updated
- `08-home-planning-flow.md` is listed as next