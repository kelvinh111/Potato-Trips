# 19 — Generated Place Resolution

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/19-generated-place-resolution`

Do not implement this feature directly on `main`.

## Goal

Enrich newly generated anonymous itineraries with verified Google Place IDs and temporary marker coordinates before the existing generation task persists the itinerary.

Feature 18 must be complete, verified, and merged first.

## Primary Boundary

This unit extends the existing initial-generation worker and canonical `generatedItinerary`; it must not create a second resolution workflow, client-owned place state, or user-facing map behaviour.

## Requirements

1. Extend AI itinerary items with nullable `placeSearchQuery`. It is a concise provider query only when the item names one specific real-world place, venue, station, airport, restaurant, or lodging; generic activities, area-level meal suggestions, notes, and non-place transport keep it `null`.
2. Add a server-only Google Places provider boundary using Places API (New) Text Search. Use a separate server credential, `pageSize: 1`, and the smallest explicit field mask needed for ID, display-name validation, and coordinates. Validate all untrusted responses; never expose the credential or raw provider response to the client.
3. During the existing Trigger.dev initial-generation task, after itinerary validation and before its existing final persistence, resolve non-null queries with bounded concurrency and a hard maximum of 60 provider requests per generation attempt. Do not add another Trigger task, route, polling state, generation phase, or retry loop.
4. Persist successful results back into the same item as nullable `placeReference`; keep no-result, invalid, over-limit, or failed lookups unverified with `placeReference: null`. Place resolution is an enhancement: provider failure must not fail or discard an otherwise valid generated itinerary.
5. Keep provider usage server-controlled and observable. Emit one structured summary per generation attempt with attempted, verified, unverified, skipped, and failed counts; do not log secrets, raw responses, or full user queries, and stop issuing new calls after the configured cap or a provider-wide configuration/authentication failure.

## Canonical Data Decisions

- Persisted items add `placeSearchQuery: string | null` and `placeReference: GooglePlaceReference | null`.
- `GooglePlaceReference` contains only `provider: "GOOGLE"`, `placeId`, validated latitude/longitude, `coordinatesCachedAt`, and `coordinatesExpireAt`.
- `coordinatesExpireAt` must be no later than both 30 days after retrieval and the anonymous planning session's existing `expiresAt`.
- Do not persist Google display names, formatted addresses, photos, ratings, opening hours, types, or raw response fragments in this feature.
- Existing generated payloads without the two new fields must still parse and normalize them to `null`; do not backfill or re-resolve old `GENERATED` sessions automatically.
- Treat only a valid first result for an explicit exact-place query as provider-backed. Do not try alternate fuzzy queries, infer coordinates from prose, or manufacture a reference when Google returns no usable result.

## Generation and Failure Decisions

- Preserve current session status, attempt isolation, task idempotency, generation-phase UI, and one final itinerary write.
- Keep the AI warning that generated suggestions are not provider-verified; only the post-validation provider result creates `placeReference`.
- Preserve every original itinerary item and its order whether resolution succeeds or not.
- A missing server Places credential behaves as one provider-wide failure: record it safely, skip remaining calls, and complete generation with null references.
- Do not extend the planning-session expiry or treat temporary coordinates as durable saved-trip place content.

## Out of Scope

- Map markers, map viewport changes, clickable kanban cards, selection, or any visible verification badge
- Client-side Places calls, a place-resolution API route, separate resolution progress, or automatic backfill
- Place Details, photos, reviews, addresses, opening hours, search UI, or manual candidate selection
- New Prisma models, relational `PlaceReference` records, `UsageEvent`, saved trips, or claim-time refresh
- Location Detail, Add Location, itinerary operations, drag-and-drop, routes, or local transport
- Changes to clarification, generation limits, generation retry policy, or `components/ui/*`

## Focused Verification

- Add deterministic provider-boundary coverage for valid result, empty result, malformed response, rejected request, missing credential, and coordinate-range validation.
- Cover exact-place query generation versus null for generic/non-place items, request cap enforcement, bounded processing, and summary counts without live calls.
- Prove legacy persisted itineraries still parse with null fields and new itineraries preserve item IDs/order/content while adding only valid references.
- Prove partial and provider-wide Places failures still complete generation once with unresolved items and no duplicate provider loop or second persistence path.
- Run one controlled live Places smoke lookup with the production field mask, then generate a short itinerary and inspect the persisted payload for both verified and unverified outcomes.
- Refresh the generated session and confirm references restore from the persisted itinerary without new Places or generation requests.

## Check When Done

- exact place suggestions can become validated Google references inside the canonical persisted itinerary
- generic, failed, capped, and legacy items remain valid and explicitly unverified through null references
- temporary coordinates and provider content obey the defined storage boundary
- provider access, validation, limits, and summary logging remain server-side
- generation still completes through its existing task, state model, attempt guard, and single final write
- existing chat, kanban rendering, map foundation, refresh, and responsive behaviour remain unchanged
- focused regressions, controlled live smoke, targeted lint/type checks, and `git diff --check` pass
- `npm run build` passes once after implementation is stable
- `context/progress-tracker.md` records actual verification before Feature 19 is marked complete
- Feature 20 is listed as next
