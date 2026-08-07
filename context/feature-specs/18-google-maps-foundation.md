# 18 — Google Maps Foundation

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/18-google-maps-foundation`

Do not implement this feature directly on `main`.

## Goal

Replace the generated desktop workspace's reserved map slot with one lazily loaded interactive Google Map and establish the reusable client-side Maps loading boundary for later place features.

Feature 17 must be complete, verified, and merged first.

Inspect `context/ui-design/Itinerary plan.png` for map-panel placement. Preserve the accepted workspace and kanban visual baseline rather than copying the wireframe pixel for pixel.

## Primary Boundary

This unit establishes Maps JavaScript API configuration, loading, lifecycle, and base-map presentation only. The existing itinerary has no verified provider identity or coordinates, so this feature must not infer locations or present itinerary items as mapped places.

## Requirements

1. Install and use the official `@googlemaps/js-api-loader` package behind a focused application-owned Maps client boundary. Load only the Maps library required for the base map; do not load Places, marker, routes, geometry, or other optional libraries.
2. Replace the generated-state `ReservedMapSlot` with a real map panel on layouts where the right map area is displayed. Keep the map absent before generation and on narrower layouts where the established workspace omits that area.
3. Lazily load and initialize Google Maps only when the session is `GENERATED`, the map panel is actually displayed, and required public configuration is present. CSS-hidden content must not trigger the SDK request or create a map instance; ordinary React rerenders must reuse one stable loader and map instance rather than duplicating scripts or affecting kanban state.
4. Fill the existing map surface with an interactive neutral world overview until verified place coordinates are introduced by a later feature. Preserve Google attribution and essential map controls; do not geocode itinerary text, request browser location, or invent a trip centre.
5. Provide intentional loading, missing-configuration, and SDK-load-failure states inside the map panel. Failures must not crash or replace the chat/kanban workspace, expose internal details, or repeatedly retry without a new user/page action.

## Configuration and Security Decisions

- Use explicit public environment variables for the browser Maps API key and map ID, and document their required local/deployment setup without committing credential values.
- Treat the browser key as public configuration: require HTTP-referrer restrictions and an API restriction limited to Maps JavaScript API in the Google Cloud project.
- Use the configured map ID for the base map so later Advanced Marker work can build on the same map without changing the foundation.
- Missing configuration must produce the defined unavailable state and no Google Maps network request.
- Keep server credentials, Places web-service calls, usage records, and provider response handling out of this client boundary.

## Responsive and Accessibility Decisions

- Preserve the current desktop three-area layout and the existing narrow stacked layout; do not add a mobile map tab, drawer, or extra vertical panel.
- Keep the map clipped to the accepted rounded map surface without page-level overflow or overlap with the kanban.
- Give loading and unavailable states an accessible name/status while leaving the interactive map's native keyboard and control behaviour intact.
- Do not cover or remove required Google attribution, legal notices, or controls with custom UI.

## Out of Scope

- Itinerary markers, marker clustering, selected-marker state, info windows, or map/kanban focus synchronization
- Place search, text search, geocoding, place matching, Place Details, photos, ratings, addresses, or opening hours
- Adding Google Place IDs, coordinates, `PlaceReference`, or provider metadata to the generated-itinerary contract
- Prisma changes, persistence, API routes, usage logging, quotas, background jobs, or server-side provider adapters
- Location Detail, Add Location, clickable kanban cards, itinerary operations, or drag-and-drop
- Routes, directions, local transport segments, travel-time calculations, Street View, or browser geolocation
- Changes to generation, clarification, chat, kanban content, or `components/ui/*`

## Focused Verification

- Add deterministic coverage for map eligibility/configuration decisions, including pre-generation, generated desktop, narrow layout, and missing-config cases.
- Confirm pre-generation and narrow-layout sessions make no Maps JavaScript API request and create no hidden map.
- Confirm a generated desktop session loads one live map with the configured map ID, neutral overview, attribution, and usable native controls.
- Confirm ordinary rerenders do not duplicate the loader script or map instance and do not change or duplicate kanban content.
- Confirm resizing from a narrow layout to the desktop map layout initializes the map on demand without page-level overflow.
- Verify missing and invalid configuration plus blocked/network SDK failure render stable accessible states while chat and kanban remain usable.
- Refresh a generated desktop session and confirm the kanban restores normally and the map initializes without another itinerary-generation request.

## Check When Done

- the generated desktop map slot contains one lazily initialized Google Map
- the SDK is not requested before generation or for an omitted narrow-layout panel
- loader, map lifecycle, configuration, loading, and failure behaviour match this spec
- the base map does not imply unverified itinerary locations or load future provider capabilities
- existing chat, generation, refresh, kanban scrolling, and responsive containment remain unchanged
- focused regression coverage, targeted lint and type checks, and `git diff --check` pass
- `npm run build` passes once after implementation is stable
- required desktop, narrow-layout, missing-config, and SDK-failure browser checks pass
- `context/progress-tracker.md` records actual verification before Feature 18 is marked complete
- Feature 19 remains next; any prerequisite place-resolution work must be designed separately rather than added to this unit
