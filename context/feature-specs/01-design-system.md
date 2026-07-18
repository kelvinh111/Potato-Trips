# 01 — Design System

Read `AGENTS.md` before starting.

## Goal

Set up the shared visual foundation and reusable UI primitives for Potato Trips.

This unit establishes the design system only. Do not implement product pages or feature-specific components.

## Requirements

### shadcn/ui

Install and configure `shadcn/ui` for the existing Next.js project.

Add these components:

- Button
- Card
- Dialog
- Input
- Tabs
- Textarea
- ScrollArea

Do not modify the generated files in `components/ui/*` after installation.

### Icons

Install `lucide-react`.

### Utility Helper

Create or confirm `lib/utils.ts` with a reusable `cn()` helper for merging Tailwind classes.

### Theme Tokens

Implement the light-only visual system defined in `context/ui-context.md`.

In `globals.css`:

- Define the semantic CSS custom properties from `ui-context.md`.
- Map the variables to Tailwind tokens through `@theme inline`.
- Use the documented light palette, text colors, borders, surfaces, accents, and state colors.
- Apply the documented border-radius scale.
- Do not add dark-mode tokens or a dark theme.
- Do not use raw Tailwind palette classes as substitutes for the semantic tokens.

### Typography

Keep the existing Geist Sans and Geist Mono setup.

Ensure:

- Both fonts are loaded through `next/font`.
- Their CSS variables are applied on the root HTML element.
- The body uses Geist Sans with antialiasing.

## Out of Scope

- Home page implementation
- My Trips implementation
- Itinerary workspace implementation
- Authentication
- AI integration
- Database or persistence
- Maps
- Collaboration
- Product-specific components

## Check When Done

- All requested shadcn/ui components are installed and import without errors.
- `lucide-react` is installed.
- `cn()` is available from `lib/utils.ts`.
- The semantic theme tokens match `context/ui-context.md`.
- The application is light-only.
- No generated `components/ui/*` file has been manually modified.
- `npm run build` passes.
- `context/progress-tracker.md` is updated.

### Generated component exception

`components/ui/tabs.tsx` may be patched to pass the extracted
`orientation` prop to `TabsPrimitive.Root`.

The current shadcn registry only applies it as a data attribute, which
causes vertical tabs to retain horizontal keyboard and ARIA behaviour.

No other generated `components/ui/*` modifications are permitted.