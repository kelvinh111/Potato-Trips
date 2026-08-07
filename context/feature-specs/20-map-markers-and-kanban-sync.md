# 20 — Map Markers and Kanban Sync

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/20-map-markers-kanban-sync`

Do not implement this feature directly on `main`.

## Goal

Render verified generated-itinerary places as Google Advanced Markers and add basic two-way selection between those markers and their kanban cards.

Feature 19 must be complete, verified, and merged first.

Inspect `context/ui-design/Itinerary plan.png` for board/map placement. Extend the accepted visual baseline; the wireframe does not define marker styling or selection behaviour.

## Primary Boundary

This unit is a client presentation layer over Feature 19's canonical persisted references and Feature 18's map instance. It must not perform Places lookup, change itinerary content, or create a parallel place store.

## Requirements

1. Derive a deterministic marker view model from the controller-reconciled itinerary. Include one marker per unique Google Place ID represented by a valid, non-expired `placeReference`, with ordered links to every matching itinerary item ID; items without a usable reference produce no marker.
2. Use Feature 18's shared Maps boundary to import only the `marker` library after the desktop map is ready and at least one marker is eligible. Create `AdvancedMarkerElement` instances, reconcile them by Place ID, and remove obsolete markers/listeners on payload change or unmount without duplicate scripts, markers, or handlers.
3. On initial marker render, fit all marker positions with appropriate padding; use a sensible place-level zoom for a single marker. With no verified markers, retain the neutral overview and show a small accessible no-verified-places status without obscuring Google controls or attribution.
4. Keep one ephemeral `selectedItemId` in the workspace presentation layer, not in the itinerary. Activating a verified kanban card selects and focuses its marker; activating a marker selects the corresponding card and scrolls its day/card into view. Selection changes styling only and must not open Location Detail in this feature.
5. Enable map-linked card interaction only while the desktop map is available. Preserve unverified cards as read-only articles, keyboard access for verified cards and markers, existing kanban scroll/middle-mouse panning, narrow-layout containment, and chat/generation behaviour.

## Selection and Viewport Decisions

- No marker is selected automatically on first render; initial viewport fitting is not selection.
- Selected marker and card use the existing semantic primary/selected tokens. Do not hardcode new palette values in components.
- Marker titles use the first linked itinerary item title and expose the linked-item count when a place occurs more than once; do not display Google-fetched names, addresses, or info windows.
- Selecting a card or marker may pan/zoom enough to make it clear, but must not discard the ability to return to the full marker extent through normal map controls.
- If the selected item disappears, becomes invalid/expired, or the map becomes unavailable after resize, clear selection safely.
- Multiple itinerary items at the same Place ID share one marker but remain separate kanban selection targets. Marker activation selects the first linked item by day/order; activating any linked card focuses the shared marker.

## State and Lifecycle Decisions

- Continue using the generation controller's reconciled `generatedItinerary` as the only itinerary source.
- Share the Feature 18 map instance through explicit typed props/callbacks or a focused controller; do not read `window.google` from unrelated components or query the map DOM.
- Keep marker and selection derivation independently testable without loading the live SDK.
- Do not persist selection or mutate `placeReference` during rendering.
- Do not modify `components/ui/*`.

## Out of Scope

- Places/Text Search/Place Details calls, provider retries, coordinate refresh, or persistence changes
- Location Detail, info windows, photos, ratings, address display, or opening hours
- Add Location, item editing/removal, itinerary operations, drag-and-drop, or AI refinement
- Marker clustering, route lines, directions, local transport, geolocation, Street View, or custom map style redesign
- Mobile map tab/drawer, selected day filters, numbered route order, or marker grouping
- Verification badges or claims that unresolved itinerary text is a Google place

## Focused Verification

- Add deterministic coverage for eligible marker derivation, ordering, expired/invalid/null references, duplicate Place IDs with distinct linked item IDs, and selection cleanup.
- Verify marker reconciliation creates, updates, and removes Place-ID-keyed markers/listeners without duplication across rerenders and itinerary replacement.
- Verify one-marker zoom, multi-marker bounds, empty verified set, and selected-item focus using test doubles rather than live billable calls.
- On desktop, verify card → marker and marker → card selection, scroll-to-card, keyboard operation, selected styling, and no Location Detail navigation.
- Verify unverified cards remain non-interactive and no marker is invented for them.
- Verify narrow layouts make no map/marker request, retain reachable kanban content, and safely reinitialize markers after resizing back to desktop.
- Refresh a generated session and confirm markers restore from persisted references without Places lookup, generation, duplication, or changed item order.

## Check When Done

- every usable persisted place reference is represented by one Place-ID-keyed Advanced Marker without duplicate markers for repeated places
- markers and verified kanban cards share one accessible, ephemeral selection state
- initial bounds, single-place focus, empty state, resize, cleanup, and rerender behaviour are stable
- no provider lookup, itinerary mutation, Location Detail, or future map behaviour is introduced
- existing chat, generation, refresh, kanban ordering/scrolling, and responsive containment remain unchanged
- focused regression coverage, targeted lint and type checks, and `git diff --check` pass
- `npm run build` passes once after implementation is stable
- required desktop, keyboard, resize, refresh, and empty/unverified browser checks pass
- `context/progress-tracker.md` records actual verification before Feature 20 is marked complete
- Feature 21 Location Detail is listed as next
