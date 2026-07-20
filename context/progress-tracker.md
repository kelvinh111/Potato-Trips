# Progress Tracker

Update this file after each meaningful feature unit or architecture change, not after every small code edit.

## Current Phase
- Implementation

## Current Goal
- Prepare next implementation feature unit after Prisma foundation.

## Current Feature Unit
- Unit: Prisma foundation
- Related spec: `context/feature-specs/04-prisma-foundation.md`
- Status: Completed

## Completed

### Feature 01: Design System
- Rewritten `project-overview.md`
- Rewritten `architecture.md`
- Rewritten `ai-workflow-rules.md`
- Rewritten `code-standards.md`
- Rewritten `ui-context.md`
- Added wireframes under `context/ui-design/`
- Initialized `shadcn/ui` with project configuration
- Added foundation components: Button, Card, Dialog, Input, Tabs, Textarea, ScrollArea
- Installed `lucide-react`
- Confirmed `cn()` helper in `lib/utils.ts`
- Implemented light-only semantic theme tokens in `app/globals.css`
- Verified Geist Sans and Geist Mono setup through `next/font`
- Verified `npm run build` passes for feature unit 01

### Feature 02: Home Page
- Implemented Home navbar in `components/home/home-navbar.tsx`
- Implemented trip prompt card in `components/home/trip-prompt.tsx`
- Composed Home page in `app/page.tsx`
- Verified `npm run build` passes for feature unit 02

### Feature 03: Authentication Foundation
- Connected project to existing Clerk application
- Added `@clerk/nextjs` and `@clerk/ui`
- Added `proxy.ts` with `clerkMiddleware()` and kept routes public
- Kept fallback routes: `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx`
- Wrapped app content with `ClerkProvider` inside `app/layout.tsx` body while preserving fonts and body classes
- Configured Clerk with bundled `@clerk/ui` and light shadcn theme
- Updated Home navbar with Clerk modal Sign In/Sign Up for signed-out state
- Implemented custom signed-in avatar dropdown with My Trips (disabled), Profile, and Sign Out
- Verified `npx clerk@latest doctor`, `npm run lint`, and `npm run build`

### Feature 04: Prisma Foundation
- Confirmed Prisma PostgreSQL configuration in `prisma.config.ts` with `DATABASE_URL` from environment
- Kept `prisma/schema.prisma` free of models and enums
- Kept Prisma client generator output at `app/generated/prisma` using `prisma-client`
- Added shared server-side Prisma client in `lib/prisma.ts` using `@prisma/adapter-pg`
- Added npm scripts: `prisma:generate`, `prisma:migrate:dev`, `prisma:migrate:deploy`, `prisma:studio`
- Generated Prisma client successfully
- Verified read-only database check succeeds (`SELECT 1`)
- Confirmed no models or migrations were created in this unit
- Verified `npm run lint` and `npm run build`

## In Progress
- None.

## Next Up
- Start `05-planning-session-model.md`.

## Blockers
- None.

## Open Questions
- Initial AI provider and model
- Final database schema details
- Detailed export flow and PDF layout
- Exact AI usage limits and future pricing model
- Detailed flight, hotel, and transport data strategy

## Verification
- Context files reviewed for scope and responsibility
- Wireframe references confirmed
- Architecture decisions aligned across context files
- `npm run build`: Pass
- `npm run lint`: Pass
- `npx clerk@latest doctor`: Pass (with non-blocking notices)
- `npx prisma validate`: Pass
- `npm run prisma:generate`: Pass
- Read-only Prisma query (`SELECT 1`): Pass

## Architecture Decisions
- PostgreSQL is the durable source of truth for saved trips.
- Liveblocks handles real-time collaboration but does not replace persistence.
- `dnd-kit` handles itinerary drag-and-drop.
- Anonymous previews use a hybrid backend planning session and browser session identifier.
- Local transport is derived between itinerary items; major travel may be an itinerary item.
- Trigger.dev handles long-running AI and export tasks.
- Vercel Blob stores generated PDF artifacts.
- AI providers use an application-owned provider interface.

## Session Notes
- Keep the six global context files concise.
- Put detailed interactions, schemas, edge cases, and implementation steps in feature specs.
- Keep only the latest information needed to resume work.