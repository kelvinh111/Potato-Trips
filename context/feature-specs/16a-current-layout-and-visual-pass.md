# 16A — Current Layout and Visual Pass

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/16a-current-layout-and-visual-pass`

Do not implement this feature directly on `main`.

## Goal

Improve the layout and visual treatment of the already implemented Home, header, and planning workspace without changing product behaviour.

Spec 15C must be complete and verified first.

Inspect `Home page.png` and `Itinerary plan.png` before editing. Use them for hierarchy and placement, while `ui-context.md` controls final visual treatment.

## Requirements

1. Fix the Potato Trips header logo so the source image keeps its intrinsic aspect ratio and is neither forced into a square/circle nor cropped by a prototype container.
2. Remove visible outer borders, outlines, and shadows from the planning workspace columns; remove visible column headings that only label the layout, while preserving accessible region names.
3. Reduce the gap and excess outer spacing between the two-column pre-generation and three-column generated layouts without causing overlap or horizontal overflow.
4. Remove the Home prompt's white outer card border, outline, and shadow while retaining a clear textarea boundary, readable hierarchy, and centered spacious layout.
5. Use existing semantic tokens to make the yellow/orange side of the approved palette meaningfully visible: teal remains primary, yellow supports secondary or awaiting-confirmation emphasis, and orange is limited to warning or small warm emphasis.

## Visual Constraints

- Light theme only.
- Do not hardcode hex values or raw Tailwind palette classes.
- Do not force all five palette colors to equal prominence.
- Keep rounded surfaces and comfortable spacing, but do not wrap every column in a card.
- Removing a visible heading must not remove the corresponding landmark, `aria-label`, or screen-reader-only label.

## Behaviour to Preserve

- Authentication and account-menu behaviour
- Home prompt validation, submission, errors, and navigation
- Clarification, confirmation, generation, retry, polling, and refresh restoration
- Existing responsive stacking and map visibility rules
- All current text except headings removed solely because they are redundant layout labels

## Out of Scope

- Chat scrolling or fixed-height conversation behaviour
- Optimistic user or assistant messages
- Home or planning composer keyboard changes
- Client/server refactors
- New UI screens, Kanban cards, Maps, Places, or itinerary behaviour
- Changes to `components/ui/*`

## Check When Done

- the header logo is uncropped and proportionally correct at supported sizes
- workspace columns have no visible outer card border/shadow or redundant heading
- accessible names remain available for chat, status/itinerary, and map regions
- column gaps are visibly smaller with no overflow at supported desktop widths
- the Home outer prompt card has no visible border/outline/shadow while the textarea remains clear
- yellow/orange accents are visibly but selectively used through semantic tokens
- the Home and planning flows remain behaviourally unchanged
- targeted lint and accessibility checks pass
- `npm run build` passes once after manual visual checks are stable
- `context/progress-tracker.md` is updated
- Spec 16B is listed as next
