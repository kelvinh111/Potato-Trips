# 17 — Itinerary Kanban

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/17-itinerary-kanban`

Do not implement this feature directly on `main`.

## Goal

Replace the generated-state placeholder with a responsive, read-only kanban that renders the persisted anonymous itinerary in fixed day columns.

Feature 16C must be complete, verified, and merged first.

Inspect `context/ui-design/Itinerary plan.png` for board hierarchy and column placement. Extend the accepted 16C visual baseline rather than copying the wireframe pixel for pixel.

## Primary Boundary

This unit is limited to presentation of the existing controller-reconciled `generatedItinerary` in the centre workspace. It must not introduce another itinerary state, mutation path, or provider integration.

## Requirements

1. When session status is `GENERATED` and `generatedItinerary` is present, replace the placeholder with the itinerary title, summary, derived day and total-item counts, and one column for every persisted day.
2. Present days by ascending `dayNumber` and items within each day by ascending `order`. Keep day columns fixed and non-interactive; neither columns nor cards can be reordered in this feature.
3. Each day column must show the persisted `dayLabel` as the visible day heading, optional summary, and all of its items. Each item must show a user-friendly type label, title, description, planning text, and any available suggested time or duration.
4. Keep the board usable for 1–14 days by containing horizontal scrolling inside the centre panel. Preserve the existing desktop three-area layout and narrow stacked layout without page-level horizontal overflow, clipped content, or inaccessible columns.
5. Render directly from the current server-authoritative/controller-reconciled payload so the same itinerary returns after refresh. If status is `GENERATED` but no itinerary is available, show a stable accessible unavailable state without inventing content or changing session state.
6. Match the accepted planning chat scrollbar spacing treatment for centre-panel kanban scrolling surfaces: thin low-chrome scrollbar with transparent track, white thumb, and inset edge gap (not flush to panel edges).
7. Support panel-wide middle-mouse horizontal panning for the generated kanban board, including interactions started from header/title/summary regions above the day columns.

## Display Decisions

- Use the itinerary title and summary exactly as persisted.
- Derive only the number of days and total itinerary items for the summary counts.
- Use the persisted `dayLabel`; do not derive or invent calendar dates.
- Format `suggestedDurationMinutes` as compact hours/minutes and omit absent optional metadata without empty placeholders.
- Render `PLACE`, `ACTIVITY`, `FOOD`, `NOTE`, `TRANSPORT`, and `LODGING` with consistent cards and clear human-readable labels.
- Treat persisted `TRANSPORT` entries as major travel items; do not synthesize local transport connectors or segments.
- Use semantic headings, lists, and articles for the read-only board. Do not present cards as buttons, links, or draggable controls.
- Do not display fake thumbnails, provider badges, verification states, addresses, ratings, weather, city counts, or other unsupported data.
- Keep the existing chat panel and reserved blank map panel unchanged.
- Keep horizontal scrollbar placement inset from panel edges with the same edge-gap feel as the planning chat scrollbar treatment.

## State Ownership and Structure

- Continue using the generation controller as the client owner of reconciled planning-session state.
- Pass the current `generatedItinerary` into focused app-level kanban presentation components.
- Keep ordering, counts, type labels, and duration formatting deterministic and independently testable.
- Do not copy the itinerary into editable component state or persist a second representation.
- Do not modify `components/ui/*`.

## Out of Scope

- Drag-and-drop, `dnd-kit`, reordering, cross-day moves, optimistic updates, or itinerary mutations
- Google Maps initialization, markers, map focus, Places lookup, or provider calls
- Location Detail, clickable place cards, Add Location controls, or centre-panel navigation
- Local transport derivation, routing, travel-time calculation, or transport refresh
- New Prisma models, route handlers, repositories, operation APIs, AI changes, or Trigger.dev work
- Saved trips, preview claiming, collaboration, sharing, or export
- Changes to chat behaviour, generation, polling, retry, or refresh reconciliation

## Focused Verification

- Add deterministic coverage for day/item ordering, derived counts, all item-type labels, duration formatting, and absent optional metadata.
- Verify a generated session renders the persisted title, summary, every day, and every item exactly once.
- Verify a 14-day itinerary scrolls horizontally inside the centre panel while the chat and reserved map remain contained.
- Verify short-desktop and narrow stacked layouts have no page-level horizontal overflow and all columns remain reachable.
- Verify generated-state centre-panel scrollbar spacing remains inset from edges (matching accepted chat-panel edge-gap treatment).
- Verify middle-mouse horizontal panning works when initiated from the kanban header/title/summary area and the day-column area.
- Refresh a generated session and confirm the same itinerary returns without another generation request, Trigger.dev run, or duplicated content.
- Verify the `GENERATED`-without-itinerary fallback is stable and accessible.

## Check When Done

- the generated-state placeholder is replaced by the persisted itinerary kanban
- explicit persisted day and item ordering is respected
- title, summary, supported counts, day content, item content, and optional metadata render correctly
- the board is read-only, accessible, responsive, and contained within the centre workspace
- existing chat, generation, polling, refresh restoration, and reserved-map behaviour remains unchanged
- no Maps, Places, Location Detail, Add Location, operation-layer, or drag-and-drop work is introduced
- focused regression coverage, targeted lint and type checks, and `git diff --check` pass
- `npm run build` passes once after the implementation is stable
- `context/progress-tracker.md` records actual automated and browser verification before Feature 17 is marked complete
- Feature 18 is listed as next
