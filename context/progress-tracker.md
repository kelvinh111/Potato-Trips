# Progress Tracker

Update this file after each meaningful feature unit or architecture change, not after every small code edit.

## Current Phase
- Implementation

## Current Goal
- Begin Feature 18 implementation planning.

## Current Feature Unit
- Unit: Feature 17 Itinerary Kanban
- Related spec: `context/feature-specs/17-itinerary-kanban.md`
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

### Feature 10: Trigger.dev Setup
- Migrated Trigger config and task imports to `@trigger.dev/sdk` (no `/v3` imports in source code)
- Kept existing Trigger project reference in `trigger.config.ts`
- Configured Trigger runtime to `node-22`
- Explicitly set Trigger task directory to `./trigger`
- Disabled automatic retries in development (`retries.enabledInDev: false`)
- Kept Trigger config minimal and added required `maxDuration` for SDK type validity
- Replaced generated hello-world task with `trigger/setup-smoke.ts`
- Added deterministic `schemaTask` with runtime-validated Zod payload `{ message: string }`
- Returned JSON-serializable smoke output `{ ok: true, message }` with no `any`
- Added reproducible script `trigger:dev` pinned to `trigger.dev@4.5.6`
- Pinned `@trigger.dev/sdk` and `@trigger.dev/build` to exact `4.5.6` to align package and CLI versions
- Confirmed Trigger MCP tooling remains dev-only via `.vscode/mcp.json`
- Confirmed `.trigger` remains ignored and `trigger.config.ts` remains included in TypeScript config
- Confirmed no API routes, AI workflow changes, or Prisma schema/migration changes were added

### Feature 11: Clarification Chat
- Extended `PlanningSession` with persisted clarification JSON fields: `clarificationMessages` and nullable `planningBrief`
- Added and applied migration `20260722202553_add_clarification_chat_state`
- Added application-owned Zod schemas for planning-session status, clarification messages, planning brief, and clarification AI output
- Added planning-brief readiness guard requiring destination plus duration or exact date range
- Added server-side clarification service using existing `AiProvider` structured-output boundary
- Added `POST /api/planning-sessions/[sessionId]/clarify` with `start` and `reply` actions
- Added request and route-parameter validation for clarify actions
- Enforced missing/expired session checks and clarification-stage restrictions in clarify endpoint
- Enforced server-side clarification usage limit before additional AI turns
- Ensured no partial turn persistence by only writing after successful AI response
- Enforced repeated start idempotency to avoid duplicate first assistant clarification message
- Persisted completed user/assistant turns and planning brief updates
- Updated status to `READY_TO_GENERATE` only when readiness conditions are satisfied
- Replaced placeholder planning chat with live conversation UI
- Rendered `initialPrompt` as first user message without duplicating it in persisted messages
- Added auto-start clarification behavior for new `CLARIFYING` sessions
- Added composer behaviors: trimmed non-empty submit, Enter send, Shift+Enter newline, loading guards, duplicate prevention, retryable error feedback, and scroll-to-latest
- Kept conversation visible and disabled composer once status becomes `READY_TO_GENERATE`
- Confirmed no itinerary generation, Trigger.dev generation tasks, kanban data, map data, place lookup, saved-trip, or collaboration work was added

### Feature 12: Initial Itinerary Generation
- Extended `PlanningSession` persistence for generation workflow state, attempts, failure state, and generated itinerary payload
- Implemented confirmation-aware clarification flow, including revised-confirmation handling when users change requirements at confirmation time
- Implemented durable Trigger.dev initial generation workflow with idempotent start semantics and guarded state transitions
- Added persisted generation status retrieval and restore-after-refresh workflow behavior
- Added structured AI-output validation and normalized persisted itinerary schemas before marking generation complete
- Enforced exact itinerary day-count validation against trip length before persistence
- Enforced inclusive exact-date and trip-length consistency checks across generation validation
- Added Generate and Retry protection when persisted planning-session state is internally inconsistent
- Enforced per-session generation limits and retry behavior with attempt tracking
- Corrected user-facing `GENERATING` status messaging for active generation and recovery states
- Confirmed generated itinerary remains persisted and visible after refresh/reload
- Confirmed no Kanban rendering, map initialization, Places verification, collaboration, or saved-trip persistence was introduced in this unit

### Feature 13: Canonical Planning Brief Cleanup
- Deleted all existing development `PlanningSession` records before removing compatibility support
- Removed legacy planning-brief fields from schema and types: `dateRange`, `duration`, `travellerCount`, `pace`, `travelStyle`, `interests`, `preferences`, `constraints`
- Removed compatibility schema and legacy fallback/merge derivation paths from planning-brief parsing
- Preserved canonical timing normalization, readiness checks, practicality checks, and exact-date/trip-length consistency validation
- Added deterministic regression script `planning-brief:regression` that proves canonical briefs are accepted and legacy-shaped briefs are rejected without live AI or Trigger.dev calls
- Confirmed no Prisma schema or migration changes were added

### Feature 14: Server Planning Workflow Refactor
- Extracted server-side clarification sequencing and policy from the clarify route into one application-owned workflow entrypoint at `lib/planning-sessions/clarification-workflow.ts`
- Kept the clarify route thin: route/body validation, workflow invocation, and HTTP response mapping only
- Preserved existing clarify request bodies, success payload shape, error payload shape, status codes, and user-facing messages
- Preserved repeated `start` idempotency and no duplicate first assistant message behavior
- Preserved assistant-turn and confirmation/revision limits and their existing outcomes
- Preserved confirmation-with-revisions behavior (`READY_TO_GENERATE` confirmation path without generation start)
- Preserved plain confirmation path using the existing idempotent generation-start operation
- Preserved concurrency/provider/usage/invalid-state handling and no-partial-turn behavior when AI generation fails
- Added deterministic focused workflow regression coverage using controlled dependencies in `scripts/clarification-workflow-regression.ts` (no live AI, Trigger.dev, or paid providers)
- Confirmed no Prisma schema or migration changes and no client/UI/generation-worker changes

### Feature 15A: Client API Extraction
- Added one application-owned browser planning-session API boundary at `lib/planning-sessions/client-api.ts`
- Moved clarification and generation endpoint fetch/response parsing out of UI components into the client API boundary
- Added runtime validation for success payloads and safe parsing for error payloads while keeping untrusted response data as `unknown` until validated
- Returned typed client session data and normalized client errors so components no longer parse raw JSON
- Updated planning chat and workspace runtime components to use the new boundary without changing state ownership, timers, polling policy, or rendering behavior
- Preserved endpoint paths, methods, request bodies, user-facing error messages, retry paths, clarification auto-start/reply timing, and generation start/status polling behavior
- Added deterministic focused regression coverage in `scripts/planning-session-client-api-regression.ts` with mocked fetch (no live network/provider usage)
- Confirmed no server route, Prisma, AI, Trigger.dev, dependency, or UI-system changes

### Feature 15B: Generation State and Polling Refactor
- Added one focused client generation controller at `lib/planning-sessions/generation-controller.ts` to own generation request state, server-state reconciliation, polling timers, backoff, pause, and recovery actions
- Moved polling timer scheduling and cleanup, failure counting, backoff calculation, pause threshold, pause notice, and manual refresh reset behavior out of `components/plan/itinerary-workspace-runtime.tsx`
- Preserved server-authoritative reconciliation for `GENERATING`, `GENERATED`, and `FAILED` generation responses without creating a competing itinerary state
- Kept the workspace runtime responsible for composition/rendering while consuming one typed generation controller interface
- Updated `components/plan/trip-plan-status-panel.tsx` to execute generation start/manual refresh through controller actions without changing visible behavior
- Added deterministic focused regression coverage in `scripts/generation-controller-regression.ts` for successful progression, transient poll failure/backoff, pause threshold, manual recovery reset, completion, failure, and polling stop conditions
- Preserved existing generation start/retry behavior, polling cadence/backoff values, paused polling notice and manual recovery path, refresh restoration from persisted state, and generated/failure display outcomes
- Confirmed no server endpoint, persistence schema, generation-attempt policy, or Trigger.dev behavior changes

### Feature 15C: Planning Chat State Refactor
- Added one focused client chat controller at `lib/planning-sessions/planning-chat-controller.ts` to own auto-start, draft state, submission state, request errors, and chat actions
- Moved clarification start and reply API orchestration, auto-start sequencing, duplicate-submission guard, start-request lock, and request-state transitions out of `components/plan/planning-chat-panel.tsx`
- Preserved composer availability for `CLARIFYING` and `READY_TO_GENERATE`, with existing disabled behavior for `GENERATING`, `GENERATED`, `FAILED`, and in-flight requests
- Preserved message order and typed view-model derivation from initial prompt plus persisted clarification messages
- Preserved existing Enter, Shift+Enter, and IME submission handling in the planning workspace presentation component
- Preserved existing error and start-retry behavior and draft clear-on-success-only behavior
- Added deterministic focused regression coverage in `scripts/planning-chat-controller-regression.ts` for auto-start scheduling/request behavior, start success/failure/retry, status-based disabling, and duplicate start/reply submission prevention without live network, AI, or Trigger.dev
- Confirmed no server endpoint, repository, Prisma schema, provider, generation controller, or UI visual-system changes

### Feature 16A: Current Layout and Visual Pass
- Fixed header logo rendering to keep intrinsic logo image proportions with no forced square/circle crop in `components/app/app-header.tsx`
- Removed visible outer border/shadow framing from planning workspace columns while preserving accessible region names in `components/plan/planning-chat-panel.tsx`, `components/plan/trip-plan-status-panel.tsx`, and `components/plan/reserved-map-slot.tsx`
- Removed redundant visible planning column headings while keeping screen-reader-only labels for chat/status/itinerary regions
- Reduced workspace grid gaps and outer padding for pre-generation and generated layouts in `components/plan/itinerary-workspace-runtime.tsx` without introducing horizontal overflow
- Removed Home prompt outer card border/shadow treatment while keeping centered layout hierarchy and clear textarea boundary in `components/home/trip-prompt.tsx`
- Applied selective secondary/warm palette accents through semantic tokens (yellow secondary action emphasis and small warm logo accent) while keeping teal as primary and warning/orange usage scoped
- Preserved Home and planning behavior (validation, submission, clarification/generation/retry/polling flows, responsive stacking, and map visibility rules)

### Feature 16B: Current Chat Interaction Pass
- Added temporary optimistic clarification reply rendering in `lib/planning-sessions/planning-chat-controller.ts` by appending a pending user bubble and assistant `Thinking...` bubble immediately after valid submit
- Preserved server-authoritative reconciliation by clearing pending bubbles and replacing view state with persisted server messages on successful clarification reply
- Added failure rollback behavior in `lib/planning-sessions/planning-chat-controller.ts` to remove temporary bubbles, restore submitted draft text, and retain existing error reporting behavior
- Added explicit conversation builder support for pending reply view state in `buildPlanningChatConversationMessages()` and covered it in deterministic regression
- Constrained desktop planning-page overflow in `app/plan/[sessionId]/page.tsx` so the planning workspace columns can maintain internal panel scrolling
- Preserved planning chat panel internal scrolling and ensured full-height desktop containment in `components/plan/planning-chat-panel.tsx`
- Added Home prompt keyboard behavior in `components/home/trip-prompt.tsx`: Enter submits valid prompt, Shift+Enter keeps newline, IME composition does not accidentally submit
- Extended deterministic checks in `scripts/planning-chat-controller-regression.ts` for pending bubble composition and reply lifecycle callbacks (start/success/error draft behavior)
- Project owner confirmed manual browser verification for Feature 16B acceptance criteria
- Feature 16B merged to `main`

### Feature 16C: Manual Visual Refinement Baseline
- Final accepted visual baseline documented in `context/feature-specs/16c-manual-visual-refinement-baseline.md`
- Stable shared visual rules recorded in `context/ui-context.md`
- Global semantic background behavior restored while scoping white canvas treatment to Home and Plan frames
- Project owner confirmed manual browser verification for Feature 16C accepted visual baseline
- Feature 16C merged to `main`

### Feature 17: Itinerary Kanban
- Replaced generated-state placeholder with read-only itinerary kanban rendering in the center workspace.
- Added deterministic kanban view-model derivation for persisted itinerary ordering, counts, type labels, and duration formatting.
- Added generated-without-itinerary accessible fallback state.
- Matched generated-state kanban scrollbar spacing and low-chrome treatment to accepted chat scrollbar baseline (inset from panel edges, white thumb, transparent track).
- Added panel-wide middle-mouse horizontal panning so left/right board panning can start from header/title/summary area and day-column area.
- Removed duplicated day-header label so each day card shows only one visible day heading.
- Project owner confirmed complete Feature 17 manual browser verification pass with no unexpected regressions.

## In Progress
- None.

## Next Up
- Feature 18

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
- Feature 10 compile check: Trigger setup compiles (`npm run lint` and `npm run build` pass)
- Feature 10 diff check: `git diff --check` pass
- Feature 10 worker check: `npm run trigger:dev` local worker starts and registers `setup-smoke` task (`version 20260722.1`)
- Feature 10 live smoke run: `run_cmrwbqf1y7c5b0poigt1shczv` completed with output `{ ok: true, message: "trigger setup smoke works" }`
- Feature 11 migration check: `npx prisma migrate dev --name add_clarification_chat_state` pass
- Feature 11 schema check: `npx prisma validate` pass
- Feature 11 compile check: `npm run lint` and `npm run build` pass
- Feature 11 live clarification smoke:
	- create session `201`
	- clarify `start` returns assistant turn
	- repeated clarify `start` does not duplicate first assistant message
	- clarify `reply` updates persisted chat and planning brief
	- status reached `READY_TO_GENERATE` with destination + exact date range
	- persisted planning brief contains destination/date range/traveller and optional fields remain nullable
- Feature 11 browser flow:
  - automatic initial clarification starts successfully
  - clarification persists across refresh without duplication
  - sufficient initial prompt can complete immediately
  - multi-turn clarification continues until readiness conditions are met
  - READY_TO_GENERATE disables the composer
  - final ready message does not ask optional follow-up questions
- Feature 12 schema check: `npx prisma validate` pass
- Feature 12 Prisma client check: `npm run prisma:generate` pass
- Feature 12 compile check: `npm run lint` and `npm run build` pass
- Feature 12 manual verification:
	- clarification and revised-confirmation flow pass
	- durable Trigger.dev generation pass
	- validated and persisted itinerary output pass
	- exact itinerary day-count validation pass
	- inclusive exact-date and trip-length consistency pass
	- Generate and Retry protection for inconsistent persisted sessions pass
	- generation limits and retry behavior pass
	- correct `GENERATING` status messaging pass
	- generated itinerary persists after refresh pass
	- all six date-consistency manual tests passed
- Feature 13 checks:
  - deleted development `PlanningSession` records: `before 14`, `deleted 14`, `after 0`
  - `npm run planning-brief:regression`: pass
  - targeted `eslint` for changed planning-brief modules and regression script: pass
  - `npx tsc --noEmit`: pass
  - `npx prisma validate`: pass
  - `npm run build`: pass
- Feature 14 checks:
	- `npm run clarification-workflow:regression`: pass
	- targeted `eslint` for clarify route/workflow/regression script: pass
	- `npx tsc --noEmit`: pass
	- `git diff --check`: pass
	- `npm run lint`: pass
	- `npm run build`: pass
	- manual contract comparison of clarify route request/success/error mappings vs `main`: preserved
- Feature 15A checks:
	- `npm run planning-session-client-api:regression`: pass
	- targeted `eslint` for client API boundary and updated planning components: pass
	- `npx tsc --noEmit`: pass
	- `git diff --check`: pass
	- `npm run build`: pass
- Feature 16B checks:
	- `npm run planning-chat-controller:regression`: pass
	- `npm run lint`: pass
	- `npm run build`: pass
	- `git diff --check`: pass
	- manual browser verification: project owner confirmed pass for all Feature 16B acceptance checks
	- merge status: merged to `main`
- Feature 16C checks:
	- manual browser verification: project owner confirmed pass for accepted visual baseline across affected states
	- merge status: merged to `main`
- Feature 15B checks:
	- `npm run generation-controller:regression`: pass
	- targeted `eslint` for generation controller/runtime/status-panel/regression files: pass
	- `npx tsc --noEmit`: pass
	- `npm run lint`: pass
	- `git diff --check`: pass
	- `npm run build`: pass
	- manual browser verification: generation start produced exactly one `POST /api/planning-sessions/[sessionId]/generate` and exactly one Trigger.dev run
	- manual browser verification: refresh during `GENERATING` restored generation UI and resumed automatic `GET /api/planning-sessions/[sessionId]/generation` polling without another generation `POST` or additional Trigger.dev run
	- manual browser verification: automatic polling paused after six consecutive blocked generation-status requests and displayed the existing paused polling notice
	- manual browser verification: `Check status` recovered immediately after unblocking, reached `GENERATED`, and generated itinerary result persisted after refresh
- Feature 15C checks:
	- `npm run planning-chat-controller:regression`: pass
	- targeted `eslint` for planning chat controller/panel/regression files: pass
	- `npx tsc --noEmit`: pass
	- `npm run lint`: pass
	- `npm run build`: pass
	- manual browser verification: auto-start remained idempotent across refresh and did not create duplicate first-assistant clarification requests
	- manual browser verification: start failure surfaced existing error state and Retry successfully resumed clarification start behavior
	- manual browser verification: reply failure preserved draft text and successful retry cleared draft only after persisted reply success
	- manual browser verification: persisted messages restored in expected prompt-plus-history order across refresh
	- manual browser verification: composer availability/disabled states matched existing status and in-flight request behavior
- Feature 16A checks:
	- targeted `eslint` for changed layout/visual components: pass
	- `npx tsc --noEmit`: pass
	- `git diff --check`: pass
	- `npm run build`: pass
	- browser visual pass: Home prompt layout/outer-card treatment and pre-generation planning workspace framing/accessible regions verified
- Feature 17 checks:
	- `npm run itinerary-kanban:regression`: pass
	- targeted `eslint` for Feature 17 changed source files: pass
	- `npx tsc --noEmit`: pass
	- `git diff --check`: pass (non-blocking CRLF warning on pre-existing `context/feature-specs/17-itinerary-kanban.md` working-copy normalization)
	- `npm run build`: pass
	- manual browser verification: project owner confirmed full Feature 17 pass with no unexpected regressions

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