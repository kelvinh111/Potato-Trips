# 16C — Manual Visual Refinement Baseline

Read `AGENTS.md` before starting.

Create and switch to a new Git branch before making changes:

`feature/16c-manual-visual-refinement-baseline`

Do not implement this feature directly on `main`.

## Goal

Refine the implemented Home, shared header, and Planning Workspace into the approved visual baseline without changing existing product behaviour.

Spec 16B must be complete, manually verified, and merged first.

Inspect `Home page.png` and `Itinerary plan.png` when working on the corresponding screens. Use them for layout and hierarchy rather than as pixel-perfect final designs.

## Working Method

* This feature is an exploratory visual refinement pass led by the project owner.
* Changes may be made manually or through small, explicitly scoped Copilot requests.
* Each Copilot request should address one concrete visual adjustment rather than reimplementing this complete spec.
* Record the final accepted visual decisions in this spec after the visual work stabilizes.

## Editable Scope

* Shared application header
* Home page composition and trip prompt
* Planning Workspace layout
* Planning chat presentation and composer styling
* Trip plan status presentation
* Generated-state placeholder and reserved map area
* App-level JSX structure, Tailwind classes, and project-specific styling
* Semantic visual tokens in `app/globals.css` when an accepted design decision requires them

## Requirements

1. Review and refine the in-scope screens progressively until their layout, spacing, sizing, typography, surfaces, colors, and visual hierarchy form a coherent design.
2. Permit app-level JSX structure changes needed to support the accepted layout, while preserving all handlers, refs, state connections, landmarks, labels, and accessibility semantics.
3. Keep responsive and short-viewport behaviour intentional, with no accidental clipping, overlap, inaccessible content, or unwanted page overflow.
4. Treat the final approved implementation as the visual baseline that later features must extend unless an active feature spec explicitly replaces part of it.

## Behaviour to Preserve

* Authentication, account menu, and navigation
* Home validation, Enter submission, Shift+Enter newline, IME handling, duplicate protection, errors, session storage, and navigation
* Clarification auto-start, reply submission, temporary user and `Thinking...` bubbles, success reconciliation, failure rollback, retry, and draft restoration
* Generation, retry, polling, paused-polling recovery, and refresh restoration
* Desktop internal chat scrolling, scroll-to-latest behaviour, and responsive page scrolling
* Existing focus behaviour, live regions, accessible names, labels, and keyboard access

## Constraints

* Keep the application light-theme only.
* Use semantic design tokens; do not introduce raw Tailwind palette colors or component-level hex values.
* Keep product-specific styling in app-level components.
* Do not introduce new product behaviour while adjusting presentation.
* Wireframes remain low-fidelity references and do not override implemented behaviour or written requirements.

## Out of Scope

* My Trips, Add Location, and Location Detail visual implementation
* Itinerary Kanban, Google Maps, Places, saved trips, or collaboration
* API, controller, repository, Prisma, AI-provider, or Trigger.dev changes
* New navigation, panel controls, editing actions, or interaction flows
* Changes to `components/ui/*`

## Documentation and Verification

* After the visual design is accepted, update this spec with the final implemented visual decisions rather than every experimental CSS change.
* Update `ui-context.md` only with stable shared patterns that future features must preserve.
* Derive focused visual checks from the final diff and affected responsive states.
* Update `progress-tracker.md` only after the required automated and manual verification has actually passed.

## Check When Done

* The Home, shared header, and current Planning Workspace match the project owner’s approved visual direction.
* Relevant loading, disabled, error, pending, retry, and generated states remain visually usable.
* All preserved 16A and 16B behaviours pass focused regression testing.
* Desktop, short-desktop, tablet, and mobile layouts have been checked where affected.
* Targeted lint and type checks pass for changed files.
* The final spec accurately records the accepted visual decisions.
* `ui-context.md` records the new shared visual baseline without low-level class details.
* `context/progress-tracker.md` records actual automated and browser verification.
* `npm run build` passes once after the visual implementation is stable.
* Feature 17 is listed as next but is not implemented.
