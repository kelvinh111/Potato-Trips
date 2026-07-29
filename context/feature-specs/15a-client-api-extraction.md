# 15A — Client API Extraction

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/15a-client-api-extraction`

Do not implement this feature directly on `main`.

## Goal

Move planning-session browser requests and response parsing out of React components into one typed client API boundary without changing visible behaviour.

Spec 14 must be complete and verified first.

## Primary Boundary

This unit covers browser-side calls to the existing clarification, generation-start, and generation-status endpoints.

## Requirements

1. Create an application-owned client API layer for clarification start/reply, generation start, and generation status retrieval.
2. Move runtime validation of success payloads and safe parsing of error payloads into that boundary; untrusted responses must remain `unknown` until validated.
3. Return typed application data or normalized client errors so React components do not inspect raw JSON or duplicate fetch/error logic.
4. Update the existing workspace and chat components to use the new boundary while preserving their current state ownership and rendering.
5. Add focused regression coverage for valid payloads, malformed success payloads, non-JSON failures, and server error messages without network or provider calls.

## Behaviour to Preserve

- Endpoint paths, methods, request bodies, and server contracts
- Existing user-facing error messages and retry paths
- Clarification auto-start and reply timing
- Generation start, polling cadence, backoff, pause, and manual refresh
- Current composer, loading, pending, layout, and rendering behaviour

## Structural Limits

- Do not move React state, effects, timers, polling policy, or view-model construction in this unit.
- Do not create a second domain model for API data.
- Reuse existing application schemas where they correctly represent the client boundary.
- The client API layer must not import server-only modules or provider code.

## Out of Scope

- Server routes, repositories, Prisma, AI, or Trigger.dev changes
- Generation controller or polling refactor
- Planning-chat state refactor
- Optimistic chat messages or `Thinking...`
- Home composer keyboard behaviour
- Layout, colors, or visual changes

## Check When Done

- React components contain no direct planning-session fetch or raw response parsing covered by this unit
- all covered responses are runtime-validated before use
- malformed or non-JSON responses produce the existing safe user-facing failure behaviour
- focused client API checks pass without real network calls
- the Feature 12 browser flow behaves unchanged
- targeted lint and type checks pass
- `npm run build` passes once after focused checks are stable
- `context/progress-tracker.md` is updated
- Spec 15B is listed as next
