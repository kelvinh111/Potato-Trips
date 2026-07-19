# 03 — Authentication

Read `AGENTS.md` before starting.

Set up Clerk authentication for the existing Next.js 16 App Router project.

Do not create a new Next.js application.

### Clerk Setup

Requirements:

- use the Clerk CLI to connect the project to the existing Clerk application
- install `@clerk/nextjs`
- install `@clerk/ui` for the Clerk shadcn theme
- create root-level `proxy.ts` using `clerkMiddleware()`
- use `proxy.ts`, not `middleware.ts`
- keep all routes public for now
- place `ClerkProvider` inside `<body>` in `app/layout.tsx`
- preserve the existing fonts, body classes, layout, and design tokens
- do not create another global header
- do not read, print, or commit Clerk secret values

### Signed-Out Navbar

Update `components/home/home-navbar.tsx`.

Requirements:

- keep the existing Potato Trips navbar layout
- show `Sign In` and `Sign Up` when signed out
- both actions open Clerk modals
- use Clerk's prebuilt authentication UI
- support the enabled email and Google sign-in methods
- do not create separate sign-in or sign-up pages
- do not collect additional profile fields
- preserve the existing button hierarchy and styling

### Clerk Modal Theme

Requirements:

- use Clerk's light shadcn theme
- customize colors and border radius to match Potato Trips
- use the semantic colors defined in `globals.css`
- do not hardcode unrelated colors
- keep the modal fully light when the operating system prefers dark mode
- do not add dark mode support

### Signed-In Navbar

When signed in, replace the Sign In and Sign Up buttons with a custom avatar dropdown.

The dropdown contains:

- `My Trips`
- `Profile`
- `Sign Out`

Requirements:

- use the signed-in user's Clerk avatar
- provide an initials fallback when no avatar is available
- use a shadcn dropdown menu added through the CLI if it is not installed
- `Profile` opens Clerk's prebuilt user profile interface
- `Sign Out` signs the user out
- `My Trips` remains disabled until the My Trips route is implemented
- do not use Clerk's default `UserButton` menu as the final navbar UI
- preserve keyboard navigation, focus states, and accessible labels

### Out of Scope

Do not implement:

- protected routes
- Prisma user records
- My Trips page navigation
- organizations
- roles or permissions
- planning-session ownership
- saving anonymous trips
- database synchronization
- custom authentication forms
- additional profile fields

### Check When Done

- Clerk is connected to the existing application
- `proxy.ts` uses `clerkMiddleware()`
- all current routes remain public
- signed-out users see Sign In and Sign Up
- both actions open Clerk modals
- email and Google authentication are available
- signed-in users see the custom avatar dropdown
- Profile opens the Clerk profile interface
- Sign Out works
- My Trips is visible but disabled
- Clerk UI matches the Potato Trips light theme
- no duplicate navbar or header is created
- no secret values are committed
- no generated `components/ui/*` files are manually modified
- `clerk doctor` passes
- no TypeScript or lint errors
- `npm run build` passes
- update `context/progress-tracker.md`