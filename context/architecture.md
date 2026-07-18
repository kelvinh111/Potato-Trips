# Architecture Context

## Stack
| Layer | Technology | Role |
| --- | --- | --- |
| Framework | Next.js 16 + TypeScript | Full-stack application |
| UI | Tailwind CSS + shadcn/ui | Styling and reusable components |
| Drag and drop | dnd-kit | Reordering itinerary items |
| Auth | Clerk | Identity and protected access |
| Database | Prisma + PostgreSQL | Durable trip, collaboration, usage, and operation data |
| Real-time | Liveblocks | Shared edits and presence |
| Maps and places | Google Maps Platform | Maps, search, details, and photos |
| AI | Application-owned provider interface | Clarification, generation, and modification |
| Background tasks | Trigger.dev | Durable AI and export workflows |
| Artifact storage | Vercel Blob | Generated PDF files |

## System Boundaries
- `app` — routes, layouts, server components, and route handlers.
- `components` — UI composition and trip-workspace components.
- `lib` — domain logic, validation, access control, providers, and persistence.
- `prisma` — relational schema and generated client.
- `trigger` — long-running AI and export tasks.
- `context/ui-design` — wireframe references only.

Business rules must not live only inside presentation components.

## State and Storage

### Anonymous Preview
- Backend stores prompt, clarification state, generation status, and preview data.
- Browser stores the session identifier and may cache non-authoritative UI state.
- The session expires if unclaimed.
- After sign-in, it becomes a durable saved trip.

### Saved Trips
PostgreSQL is the durable source of truth for trip metadata, preferences, fixed days, ordered items, collaborators, place references, operations, usage records, sharing, and export metadata.

Liveblocks synchronizes active collaboration and presence but is not the sole durable store.

## Core Domain Concepts
- `PlanningSession` — temporary anonymous planning flow.
- `Trip` — saved trip workspace.
- `TripCollaborator` — authorized shared access.
- `TripPreference` — structured planning requirements.
- `TripDay` — one fixed kanban column.
- `ItineraryItem` — one ordered place, activity, meal, note, rest, or major transport event.
- `TransportSegment` — derived local travel between adjacent items.
- `PlaceReference` — provider-backed place identity.
- `ItineraryOperation` — structured manual or AI change.
- `UsageEvent` — cost-sensitive provider activity.
- `ExportArtifact` — generated export stored in Vercel Blob.

Detailed fields belong in feature specs and the Prisma implementation.

## AI Architecture
- Domain code depends on an application-owned provider interface.
- The first provider and model remain replaceable.
- AI asks clarification questions before initial generation.
- Initial generation returns validated structured itinerary data.
- Later AI requests return validated itinerary operations.
- Chat text is explanatory and is not a second itinerary state.
- Long-running AI work runs through Trigger.dev.
- Revert uses recorded operations or snapshots.

## Kanban and Transport
- dnd-kit handles item drag and drop.
- Each column is one fixed `TripDay` and cannot be reordered.
- Items can move within or across days.
- Local transport is derived between adjacent items and is not draggable.
- Major travel events may be explicit itinerary items.
- Reordering invalidates or refreshes affected transport segments.

## Maps and Place Data
- Google Maps Platform is the V1 map and place provider.
- The map initializes only after initial itinerary generation.
- Kanban, Add Location, and Location Detail interactions may focus the map.
- Place-backed items use stable provider references.
- Unmatched AI suggestions must not appear as complete verified places.
- Keys, quotas, attribution, and storage restrictions are enforced at appropriate boundaries.

## Collaboration and Persistence
All saved-trip changes use the same validated mutation path, including drag and drop, forms, Add Location, AI operations, collaboration updates, and revert actions.

The UI may update optimistically, but durable changes must be persisted to PostgreSQL and reconciled on failure.

## Export
- The workspace uses an Export modal.
- V1 supports a shareable read-only page and PDF download.
- PDF is generated from a dedicated HTML print layout.
- Trigger.dev handles long-running export work.
- Generated PDF files are stored in Vercel Blob.
- Exports render from the current saved itinerary.

## Auth and Usage Control
- Public users may use the anonymous preview flow within configured limits.
- Authentication is required to save a trip.
- Every saved trip has one owner and may have collaborators.
- Private reads, mutations, Liveblocks access, and exports require verified membership.
- Cost-sensitive provider calls pass through server-controlled limits and usage logging.

## Invariants
1. PostgreSQL is the durable source of truth for saved trips.
2. Chat, kanban, map, details, collaboration, and exports represent the same itinerary.
3. Initial itinerary and map initialization occur only after clarification is complete.
4. Day columns are fixed and cannot be manually reordered.
5. Manual and AI changes use the same validated operation layer.
6. Liveblocks does not replace durable persistence.
7. Anonymous previews are not saved trips until claimed after sign-in.
8. Long-running AI and export work does not run in ordinary request handlers.
9. Cost-sensitive provider calls are tracked and limited on the server.
10. AI-provider-specific code remains behind the provider interface.