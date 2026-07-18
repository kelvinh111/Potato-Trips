# 02 — Home Page

Read `AGENTS.md` before starting.

We are adding the public Home page.

Inspect:

`context/ui-design/Home page.png`

The wireframe defines the page structure. Follow `context/ui-context.md` for visual styling.

### Home Navbar

Create `components/home/home-navbar.tsx`.

Requirements:

- full-width top navbar
- Potato Trips text logo on the left
- `Sign In` and `Sign Up` buttons on the right
- `Sign In` uses a lower-emphasis style
- `Sign Up` uses the primary action style
- buttons are UI-only for now
- do not implement Clerk or navigation
- responsive without a mobile menu

### Trip Prompt

Create `components/home/trip-prompt.tsx`.

Requirements:

- centered within the remaining viewport space
- heading: `What trip do you want?`
- supporting text:
  `Tell me what you have in mind and I’ll create an itinerary for you.`
- multi-line textarea
- placeholder:
  `A solo 7-day trip to Osaka in August...`
- compact submit button with Lucide `ArrowUp` icon
- textarea must have an accessible label
- submit button must have an accessible name
- user can type, but submitting does nothing yet

### Home Page

Update `app/page.tsx`.

Requirements:

- compose the navbar and trip prompt
- use a spacious, light-only layout
- use the semantic design tokens from `globals.css`
- use existing shadcn `Button`, `Card`, and `Textarea` components where appropriate
- do not hardcode colors
- do not modify `components/ui/*`
- support desktop and mobile widths
- avoid horizontal overflow

### Out of Scope

Do not implement:

- authentication
- AI requests
- planning sessions
- itinerary generation
- route navigation
- persistence
- loading or error states

### Check When Done

- `/` renders the Home page
- navbar matches the wireframe hierarchy
- prompt area is visually centered
- textarea is editable
- submit button has no side effects
- no dark styling appears
- no TypeScript or lint errors
- `npm run build` passes
- update `context/progress-tracker.md`