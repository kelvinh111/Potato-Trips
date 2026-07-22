# Progress Tracker

Update this file after each meaningful feature unit or architecture change, not after every small code edit.

## Current Phase
- Implementation

## Current Goal
- Prepare next implementation feature unit after AI provider foundation.

## Current Feature Unit
- Unit: AI provider foundation
- Related spec: `context/feature-specs/09-ai-provider-foundation.md`
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

### Feature 05: Planning Session Model
- Added `PlanningSessionStatus` enum with: `CLARIFYING`, `READY_TO_GENERATE`, `GENERATING`, `GENERATED`, `FAILED`
- Added `PlanningSession` model with required fields only: `id`, `initialPrompt`, `status`, `expiresAt`, `createdAt`, `updatedAt`
- Set `status` default to `CLARIFYING`
- Added index on `expiresAt`
- Created and applied first migration: `20260720221913_add_planning_session`
- Inspected generated SQL and confirmed it contains only enum, table, and required index
- Regenerated Prisma Client successfully
- Verified `npx prisma validate`, `npm run lint`, and `npm run build`

### Feature 06: Planning Session API
- Added `POST /api/planning-sessions` for anonymous session creation
- Added `GET /api/planning-sessions/[sessionId]` for anonymous session retrieval
- Added Zod runtime validation for request body and route parameters
- Added reusable planning-session modules under `lib/planning-sessions/`
- Added seven-day session lifetime constant used server-side
- Added browser storage helper for planning session ID using key `potato-trips:planning-session-id`
- Confirmed API response shapes and error codes match spec
- Confirmed no Prisma schema or migration changes in this unit
- Verified `npm run lint` and `npm run build`

### Feature 07: Itinerary Workspace Shell
- Added server route `app/plan/[sessionId]/page.tsx`
- Validated dynamic `sessionId` using existing planning-session validation helper
- Loaded planning session directly with repository and expiry helpers from server component
- Added unavailable and expired states that link back to Home
- Added reusable shared app header with logo image, brand link, and preserved Clerk account behavior
- Updated Home page to use shared header
- Added responsive workspace shell with dedicated chat panel, itinerary panel, and reserved map slot
- Kept map slot visually empty and omitted it on narrower layouts
- Added disabled planning chat composer and placeholder-only panel states
- Confirmed no Prisma schema or migration changes in this unit
- Verified `npm run lint` and `npm run build`

### Feature 08: Home Prompt Flow
- Converted Home prompt textarea to controlled input state
- Added submit state and temporary error-message state handling
- Reused planning-session Zod validation before API submission
- Enforced client-side trim, blank rejection, and max length rejection before POST
- Added POST submit flow to `/api/planning-sessions` with payload `{ initialPrompt }`
- Validated response shape includes non-empty `session.id`
- Saved session id via `savePlanningSessionId` before navigation
- Added router navigation to `/plan/[sessionId]` on success
- Added disabled submit/textarea and loading spinner icon while submitting
- Added user-friendly retryable error messaging for validation/API/network/malformed responses
- Added safe timed error dismissal with stale timer guard
- Confirmed no Prisma schema or migration changes in this unit
- Verified `npm run lint` and `npm run build`

### Feature 09: AI Provider Foundation
- Installed `ai` and `@ai-sdk/openai`
- Added provider-neutral AI contracts under `lib/ai/types.ts`
- Added application-owned `AiProviderError` and normalized error codes
- Added OpenAI adapter behind provider boundary with Zod-validated structured output
- Added server-only provider entrypoint and runtime provider factory for tooling
- Added normalized model and token usage metadata output
- Kept provider secrets server-side via runtime env configuration
- Added developer smoke script `scripts/ai-provider-smoke.ts`
- Verified live structured-output smoke test succeeds through provider interface
- Confirmed no Prisma schema or migration changes in this unit
- Verified `npm run lint` and `npm run build`

## In Progress
- None.

## Next Up
- `10-trigger-setup.md`.

## Blockers
- None.

## Open Questions
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
- `npx prisma migrate dev --name add_planning_session`: Pass
- API smoke checks: `POST 201`, `GET 200`, malformed/blank/too-long/wrong-type prompt `400`, invalid `sessionId` `400`, missing session `404`, expired session `410`
- Feature 07 route compile check: `/plan/[sessionId]` included in `next build` output
- Feature 08 compile check: Home prompt flow compiles and `/plan/[sessionId]` route remains in build output
- Feature 09 compile check: AI provider foundation compiles behind server-only boundary (`npm run lint` and `npm run build` pass)
- Feature 09 smoke test: `npm run ai:smoke` succeeded (`mood` object returned, model `gpt-5.6-terra`, normalized token usage present)

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