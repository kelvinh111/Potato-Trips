# Progress Tracker

Update this file after each meaningful feature unit or architecture change, not after every small code edit.

## Current Phase
- Implementation

## Current Goal
- Establish the shared design system foundation.

## Current Feature Unit
- Unit: 01-design-system
- Related spec: context/feature-specs/01-design-system.md
- Status: Completed

## Completed
- Rewritten `project-overview.md`
- Rewritten `architecture.md`
- Rewritten `ai-workflow-rules.md`
- Rewritten `code-standards.md`
- Rewritten `ui-context.md`
- Added wireframes under `context/ui-design/`
- Implemented `01-design-system`

## In Progress
- None.

## Next Up
- Define the next implementation feature unit and write its feature spec.

## Blockers
- None.

## Open Questions
- Initial AI provider and model
- Final database schema details
- Detailed export flow and PDF layout
- Exact AI usage limits and future pricing model
- Detailed flight, hotel, and transport data strategy

## Verification
- Context files reviewed for scope and responsibility
- Wireframe references confirmed
- Architecture decisions aligned across context files
- `npm run build`: Passed
- `npm run lint`: Passed
- Automated tests: Not applicable during this unit

## Architecture Decisions
- PostgreSQL is the durable source of truth for saved trips.
- Liveblocks handles real-time collaboration but does not replace persistence.
- `dnd-kit` handles itinerary drag-and-drop.
- Anonymous previews use a hybrid backend planning session and browser session identifier.
- Local transport is derived between itinerary items; major travel may be an itinerary item.
- Trigger.dev handles long-running AI and export tasks.
- Vercel Blob stores generated PDF artifacts.
- AI providers use an application-owned provider interface.

## Session Notes
- Keep the six global context files concise.
- Put detailed interactions, schemas, edge cases, and implementation steps in feature specs.
- Keep only the latest information needed to resume work.