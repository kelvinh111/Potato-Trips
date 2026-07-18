# Code Standards

## General

- Keep modules small, focused, and named after their responsibility.
- Fix root causes instead of layering workarounds.
- Do not mix presentation, domain logic, persistence, and provider integration in one module.
- Respect the boundaries and invariants defined in `architecture.md`.
- Prefer clear, maintainable code over premature abstraction.

## TypeScript

- TypeScript strict mode is required.
- Do not use `any`; use explicit types, generics, or `unknown` with validation.
- Use `interface` for object contracts and `type` for unions, aliases, and utility compositions.
- Validate all untrusted input at system boundaries before using it.
- Keep shared domain types in a clear shared location rather than redefining them across features.
- Use exhaustive checks for discriminated unions where practical.

## Next.js and React

- Default to React Server Components.
- Add `"use client"` only when browser APIs, hooks, drag and drop, maps, or real-time interaction require it.
- Keep client component boundaries as small as practical.
- Use Server Components for data loading where this keeps the implementation simpler and secure.
- Keep route handlers thin and focused on validation, authorization, orchestration, and response formatting.
- Long-running AI and export work belongs in Trigger.dev tasks, not ordinary request handlers.

## Components and State

- Components should focus on rendering and interaction, not business rules.
- Put reusable domain operations, validation, and provider logic in `lib/`.
- Do not create competing copies of itinerary state for chat, kanban, map, or details views.
- Prefer explicit props and typed callbacks over hidden cross-component coupling.
- Keep loading, empty, error, and disabled states intentional and visible.
- Preserve accessibility for keyboard, focus, labels, and interactive controls.

## Styling

- Use Tailwind CSS and the design tokens defined in `globals.css` and `ui-context.md`.
- Do not hardcode hex values or use arbitrary raw palette classes when a project token exists.
- Use shadcn/ui foundation components from `components/ui/` without modifying them unless the task explicitly requires a shared design-system change.
- Build product-specific layouts and variants in application components.
- Follow the documented typography, spacing, border, and radius conventions.
- Use the wireframes in `context/ui-design/` as layout references for matching screens.

## Validation and API Boundaries

- Validate request bodies, query parameters, route parameters, AI output, and third-party responses before use.
- Enforce authentication, trip membership, and usage limits before protected or cost-sensitive operations.
- Return consistent response shapes and meaningful error codes.
- Do not expose provider secrets, internal errors, or unrestricted third-party credentials to the client.
- Keep provider-specific code behind application-owned interfaces.

## Data and Persistence

- PostgreSQL through Prisma is the durable source of truth for saved trips.
- Use database transactions when one user action changes multiple related records.
- Preserve item ordering explicitly; do not rely on database return order.
- Record manual and AI itinerary changes through the shared operation model where required by the feature.
- Liveblocks provides real-time synchronization and presence, not the only durable store.
- Store generated file artifacts in Vercel Blob and keep their metadata or references in PostgreSQL.
- Do not persist third-party place content beyond the provider's permitted terms.

## File Organization

- `app/` — routes, layouts, Server Components, and route handlers.
- `components/` — shared and feature UI composition.
- `components/ui/` — generated shadcn/ui foundation components.
- `lib/` — domain logic, validation, providers, access control, and persistence helpers.
- `prisma/` — database schema, migrations, and generated client configuration.
- `trigger/` — durable AI and export tasks.
- Name files after the responsibility they contain, not the library used to implement them.

## Quality Checks

- Run formatting and linting before completing a feature.
- `npm run build` must pass before moving to the next implementation unit.
- Add or update tests for important domain behaviour and regressions.
- Do not silence TypeScript, lint, or runtime errors without resolving the underlying issue.