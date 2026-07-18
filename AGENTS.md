<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version may contain breaking changes in APIs, conventions, and file structure. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code, and follow all deprecation notices.
<!-- END:nextjs-agent-rules -->

# Potato Trips Agent Instructions

## Required Context

Before implementing a feature or making an architectural decision, read these files in order:

1. `context/project-overview.md`
2. `context/architecture.md`
3. `context/ui-context.md`
4. `context/code-standards.md`
5. `context/ai-workflow-rules.md`
6. `context/progress-tracker.md`

Do not infer product behaviour that is not defined in the context files or the active feature spec.

## Feature Specs

Implementation work must be based on one feature spec at a time from:

`context/feature-specs/`

Before starting:

1. Read this file.
2. Read all six context files.
3. Read the active feature spec.
4. Confirm that the spec does not conflict with any architecture invariant or code standard.
5. Inspect relevant wireframes when the task affects UI.

If a feature spec conflicts with a global context file, stop and resolve the conflict before implementation.

## Wireframes

UI reference files are stored in:

`context/ui-design/`

Before implementing or changing a related screen, inspect the relevant wireframe.

Wireframes define layout, hierarchy, and panel placement. They are low-fidelity references, not final visual designs. Visual treatment is defined by `context/ui-context.md`.

When a wireframe is ambiguous, follow the written requirements. Do not invent missing behaviour from the image.

## Scope and Execution

- Work on only one feature unit at a time.
- Do not expand the scope beyond the active feature spec.
- Do not combine unrelated UI, persistence, collaboration, map, or background-task work.
- Keep changes small enough to verify end to end.
- Ask for clarification or record an open question when requirements are missing.

## Protected Files

Do not modify generated third-party foundation components unless the active feature spec explicitly requires it.

Protected files include:

- `components/ui/*`
- third-party library internals
- generated clients

Project-specific layout, styling, and behaviour belong in app-level components.

## Verification

Before marking a feature unit complete:

1. Verify every item in the feature spec's completion checklist.
2. Run `npm run build`.
3. Run relevant tests or manual checks.
4. Confirm that no architecture invariant was violated.
5. Update `context/progress-tracker.md`.

## Documentation Sync

Update the relevant context file before continuing if implementation changes:

- product scope
- architecture or system boundaries
- storage or state ownership
- code standards
- visual design rules

`context/progress-tracker.md` must describe the actual implementation state, not the intended state.