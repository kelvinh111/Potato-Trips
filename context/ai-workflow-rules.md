# AI Workflow Rules

## Approach

Build Potato Trips incrementally using a spec-driven workflow.

The context files define the stable product, architecture, visual system, code standards, and current progress. Feature specs define the detailed behaviour of individual implementation units.

Always implement against the relevant context files and feature spec. Do not infer or invent behaviour from scratch.

## Before Starting a Feature

1. Read the six context files.
2. Read the relevant feature spec.
3. For UI work, inspect the matching wireframes in `context/ui-design/`.
4. Confirm the scope, dependencies, and acceptance criteria.
5. Check `progress-tracker.md` for unresolved decisions.

Written requirements take precedence when a wireframe is ambiguous or conflicts with documented behaviour.

## Scoping Rules

- Work on one feature unit at a time.
- Prefer small, end-to-end, verifiable increments.
- Do not combine unrelated product or system boundaries.
- Do not implement future behaviour outside the current spec.
- Do not refactor unrelated code unless the task requires it.

## When to Split Work

Split a unit when it combines unrelated concerns such as:

- UI changes and long-running background tasks
- Real-time collaboration and durable persistence
- AI generation and unrelated account or billing behaviour
- Map/place integration and unrelated itinerary logic
- Multiple independent API routes or domain operations
- Behaviour not clearly defined in the context files or feature spec

If the change cannot be verified end to end within a focused implementation cycle, the scope is too broad.

## Handling Missing Requirements

- Do not invent missing product behaviour.
- Resolve ambiguity before implementation.
- Record unresolved decisions in `progress-tracker.md`.
- Update the relevant context file when a decision affects product, architecture, visual design, or code standards.
- If a wireframe conflicts with written requirements, follow the written requirements and flag the inconsistency.

## Protected Files

Do not modify generated third-party foundation code unless explicitly required.

This includes:

- `components/ui/*` shadcn/ui foundation components
- third-party library internals
- generated clients and framework files

Project-specific styling, layout, and behaviour belong in application components. Modify foundation components only for an explicit shared design-system change.

## Implementation Rules

- Preserve the invariants in `architecture.md`.
- Use the canonical trip state rather than parallel UI-only state.
- Keep manual edits, AI changes, collaboration updates, and persistence aligned with the same domain model.
- Keep long-running AI and export work out of normal request handlers.
- Enforce auth, access control, validation, usage limits, and third-party service boundaries on the server.

## Before Moving to the Next Unit

1. The feature acceptance criteria are satisfied.
2. The feature works end to end within its defined scope.
3. Relevant loading and error states are handled.
4. No invariant in `architecture.md` was violated.
5. `npm run build` passes.
6. Relevant tests pass, or missing tests are recorded.
7. `progress-tracker.md` reflects the actual implementation state.

## Keeping Docs in Sync

Update documentation only when implementation changes a documented decision:

- Product scope or behaviour → `project-overview.md`
- Architecture, storage, providers, or boundaries → `architecture.md`
- Code conventions or file structure → `code-standards.md`
- Visual tokens or shared UI patterns → `ui-context.md`
- Status, open questions, and completed work → `progress-tracker.md`

Documentation must describe the implemented state, not an intended future state.