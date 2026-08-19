# 21A — Location Detail Core

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/21a-location-detail-core`

Do not implement this feature directly on `main`.

## Goal

Let a user open a read-only Location Detail view for a verified itinerary item, retrieve a small core set of current Google Place Details on demand, and return to the itinerary kanban without creating another itinerary state.

Feature 20 must be complete, verified, and merged first.

Inspect `context/ui-design/location detail.png` for centre-panel hierarchy and placement. The wireframe is a reference for the complete Location Detail experience; this unit intentionally implements only the core text-detail subset defined below.

## Primary Boundary

This unit adds centre-panel navigation and an on-demand server-side Place Details read path for the existing anonymous `generatedItinerary`.

It must not add photos, ratings, review counts, opening hours, contact information, reviews, itinerary mutations, or another copy of itinerary data. Those enriched provider fields belong to Feature 21B.

## Requirements

1. A kanban item with a valid Google `placeReference` can open Location Detail. Detail availability must not depend on the desktop map being visible or ready. Items without a usable Google Place ID remain non-interactive and must not trigger a text search or provider request.
2. Opening a detail replaces only the centre kanban area. Keep the existing planning chat and responsive workspace structure unchanged. On desktop, preserve Feature 20 selection and focus the corresponding marker when it is currently eligible; on narrow layouts or when the map is unavailable, open the detail without requiring map interaction.
3. Keep explicit ephemeral centre-panel state owned by the existing workspace runtime, equivalent to `ITINERARY` or `LOCATION_DETAIL` with the selected itinerary item ID. Continue rendering from the controller-reconciled canonical itinerary; do not copy the itinerary or selected item into a second editable state.
4. Add an application-owned, server-only Google Place Details (New) boundary. Retrieve details only after an explicit user open, use the stored `placeReference.placeId`, an explicit minimal field mask, `cache: "no-store"`, a bounded timeout, and runtime validation of the untrusted provider response.
5. Add a thin anonymous planning-session detail endpoint using `sessionId` and `itemId`. The server must validate both identifiers, load the unexpired session, require `GENERATED` status and a canonical itinerary, find the item in that itinerary, and derive the Place ID from its stored Google reference. The client must never supply an arbitrary Place ID.
6. Return an application-owned normalized response containing only the selected item ID and the Google detail fields allowed by this unit. Never return the API key, raw Google response, internal exception, or unrestricted provider URL to the client.
7. Render the selected item's day context, itinerary type label, current Google display name, optional primary type and formatted address, and an optional external `View on Google Maps` link. Render the persisted itinerary item's `description` as the About content. Do not use Google `editorialSummary`, AI-generate new copy, or substitute `planningText` for the chosen About source.
8. Provide intentional loading, unavailable, retry, and close behaviour within the centre panel. Abort or ignore stale client responses after close or a different item activation. Missing optional Google fields are omitted without empty labels, invented text, or failure of the entire detail.
9. Closing the detail returns to the kanban, retains the selected item, and restores keyboard focus to its activating card when possible. Map-marker activation keeps its Feature 20 behaviour of selecting and revealing the matching kanban item; it must not open Location Detail.
10. Keep the detail usable with keyboard and screen readers. Use a semantic heading structure, an accessible close label, visible focus states, an announced loading/error status, and safe external-link behaviour.

## Confirmed UX Addendum (Approved)

- Verified-card pointer hover and keyboard focus preview the corresponding map marker when map-linked interaction is currently available.
- Click, Enter, or equivalent explicit activation on a verified card opens Location Detail and keeps map focus behavior aligned with Feature 20 selection.
- Map marker activation still only selects/reveals the matching card and must not open Location Detail.
- Every itinerary card is openable in the centre panel. Unverified or generic items open an itinerary-only detail using canonical itinerary data (`title`, type label, `description`, and `planningText`).
- Itinerary-only detail must not issue Google requests, must not claim provider detail availability, must not show provider-only fields (address, provider link), must not create marker interactions, and must not increment provider usage counters.
- Hover/focus preview state is ephemeral and separate from persistent click/activation selection. Clearing hover/focus must not force map overview reset.
- Rapid interactions and stale asynchronous responses must not overwrite the active detail state for a newer activation.

## Google Place Details Contract

- Use Place Details (New): `GET https://places.googleapis.com/v1/places/{placeId}`.
- Use the existing server-only `GOOGLE_PLACES_API_KEY`; do not introduce a browser Places credential.
- Request only: `id`, `displayName`, `primaryTypeDisplayName`, `formattedAddress`, and `googleMapsUri`.
- Require the returned `id` and non-empty `displayName.text`; treat primary type, address, and Maps URI as optional.
- Confirm the returned provider ID matches the requested stored Place ID before returning a successful result.
- Normalize provider outcomes into application-owned success and failure results. Authentication/configuration, timeout/request, not-found, and malformed-response failures must produce safe, retryable UI behaviour where appropriate.
- Display Google Maps attribution in the detail experience so provider content remains attributed when the map is hidden on narrow layouts.

## Usage and Storage Decisions

- Add a feature-specific persisted anonymous-session counter for actual Place Details provider attempts and enforce a hard server-side maximum of 60 attempts per planning session.
- Reserve an attempt atomically before issuing the provider request so concurrent requests cannot bypass the cap. Do not consume the counter for invalid, expired, non-generated, missing-item, unverified-item, or missing-provider-configuration requests that never reach Google.
- Return a stable application-owned limit error when the cap is exhausted and do not issue another provider call.
- Emit structured provider-attempt outcomes without logging the API key, item title, description, address, full provider response, or raw Place ID.
- Do not prefetch Place Details. Prevent duplicate concurrent requests for the same open action.
- Hold the normalized response only for the currently open detail. Discard it on close and do not persist it in `PlanningSession`, browser storage, a service worker, or another cache.
- The existing persisted `placeReference` remains the only provider identity stored by this feature. Do not extend its stored content.

## Display Decisions

- Follow the Location Detail wireframe's breadcrumb/header hierarchy, close placement, content ordering, and centre-panel replacement pattern without copying it pixel for pixel.
- Derive the breadcrumb/day label and itinerary type label from the selected canonical itinerary item and its containing day.
- Use the Google `displayName` as the visible place heading after a successful response.
- Use the selected itinerary item's persisted `description` for About exactly as stored.
- Omit the address, primary type, or Google Maps link independently when Google does not return that optional field.
- Do not show fake image areas, image placeholders, rating rows, empty Hours/Contact/Reviews sections, or controls reserved for later units.
- Use the existing light-only semantic tokens, rounded surfaces, restrained borders/shadows, and low-chrome centre-panel scrolling treatment.
- Keep provider attribution legible but visually secondary.

## State and Failure Decisions

- A valid Google Place ID is sufficient for detail eligibility. Coordinate freshness affects only whether the existing map marker can be focused; stale or unavailable coordinates must not cause a text lookup or change the stored reference.
- Opening a second eligible card replaces the active detail request and content with that item's state; late responses for the first item must not overwrite it.
- A provider failure leaves the canonical itinerary and map state unchanged. The user can retry or close the detail.
- If the selected item cannot be found in the canonical itinerary, close or show a stable unavailable state without issuing a provider request.
- Do not extend the planning-session expiry, refresh coordinates, re-resolve a place, or mutate generation status.

## Out of Scope

- Photos, photo media routes, galleries, thumbnails, image caching, or photo-author attribution
- Ratings, review counts, reviews, review ordering/translation, or review-author attribution
- Opening hours, phone numbers, websites, editorial summaries, amenities, accessibility attributes, or other enriched Place Details fields
- Add Location, search, candidate selection, place re-resolution, or changing the item's `placeReference`
- Editing, deleting, moving, reordering, or otherwise mutating itinerary items
- A shared itinerary operation layer, optimistic mutations, saved trips, claiming, collaboration, sharing, or export
- URL-based detail routing, a separate page, modal/dialog detail, or browser-history navigation
- Marker clustering, coordinate refresh, viewport-policy changes, directions, routes, or local transport
- Changes to clarification, generation, Trigger.dev workflows, AI prompts, or `components/ui/*`

## Focused Verification

- Add deterministic provider-boundary coverage for a valid complete response, valid response with optional fields absent, mismatched ID, not found, malformed response, timeout/request failure, authentication failure, and missing configuration without live calls.
- Cover endpoint validation for invalid identifiers, missing/expired session, wrong status, unavailable itinerary, missing item, item without a Google reference, exhausted request limit, and a successful normalized response.
- Prove only an explicit eligible-card activation requests Place Details, the server derives Place ID from the canonical item, concurrent duplicate activation is guarded, and no request occurs for an unverified item or marker activation.
- Verify the attempt counter is atomic, counts only actual provider attempts, rejects request 61, and logs safe structured outcomes without restricted content.
- Verify the detail renders day/type context, Google name, each optional core field when available, persisted `description` as About, attribution, and no 21B sections.
- Verify close, retry, rapid item switching, stale-response protection, keyboard focus restoration, and accessible status announcements.
- Verify desktop activation also preserves Feature 20 selection/map focus, while narrow layout and map-unavailable states still open and close details successfully.
- Refresh the planning page and confirm no Place Details content was persisted or automatically requested.
- Run one controlled live Place Details smoke request with the production field mask and inspect the rendered attribution and optional-field behaviour.

## Check When Done

- verified Google-backed itinerary cards can open the core Location Detail in the centre workspace
- unverified items remain non-interactive and cannot cause arbitrary or text-based provider lookups
- the detail uses current normalized Google core fields and the itinerary's persisted `description` for About
- desktop map focus remains synchronized when available, while detail access remains independent of map readiness
- close, retry, stale responses, partial data, accessibility, and responsive behaviour work as defined
- provider credentials, validation, attribution, request counting, the hard limit, logging, and storage restrictions remain server-controlled
- no Feature 21B enrichment, itinerary mutation, Add Location, operation-layer, or unrelated work is introduced
- focused regressions, controlled live smoke, Prisma validation/migration checks, targeted lint/type checks, and `git diff --check` pass
- `npm run build` passes once after the implementation is stable
- `context/progress-tracker.md` records actual automated and browser verification before Feature 21A is marked complete
- Feature 21B Location Detail Enrichment is listed as next
