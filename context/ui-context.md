# UI Context

## Theme

Light only. No dark mode.

The visual language is bright, relaxed, friendly, and travel-oriented rather than corporate or technical. Use generous spacing, rounded surfaces, soft borders, and restrained shadows.

## Colors

The core palette is `#8ECAE6`, `#219EBC`, `#023047`, `#FFB703`, and `#FB8500`.

All colors must be defined as CSS custom properties in `globals.css` and mapped to Tailwind tokens via `@theme inline`. Components must use semantic tokens. Do not use hardcoded hex values or raw Tailwind color classes such as `blue-*`, `amber-*`, or `slate-*`.

| Role | CSS Variable | Value |
| --- | --- | --- |
| Page background | `--bg-base` | `#F7FBFD` |
| Surface | `--bg-surface` | `#FFFFFF` |
| Elevated surface | `--bg-elevated` | `#FFFFFF` |
| Subtle surface | `--bg-subtle` | `#EAF6FA` |
| Selected surface | `--bg-selected` | `#DDF1F8` |
| Default border | `--border-default` | `#C7DEE7` |
| Subtle border | `--border-subtle` | `#E1EDF2` |
| Primary text | `--text-primary` | `#023047` |
| Secondary text | `--text-secondary` | `#315A6A` |
| Muted text | `--text-muted` | `#607D89` |
| Faint text | `--text-faint` | `#8AA0AA` |
| Primary accent | `--accent-primary` | `#219EBC` |
| Primary accent hover | `--accent-primary-hover` | `#1887A2` |
| Primary accent dim | `--accent-primary-dim` | `rgba(33, 158, 188, 0.12)` |
| Secondary accent | `--accent-secondary` | `#FFB703` |
| Secondary accent hover | `--accent-secondary-hover` | `#E5A400` |
| Secondary accent dim | `--accent-secondary-dim` | `rgba(255, 183, 3, 0.16)` |
| Warm accent | `--accent-warm` | `#FB8500` |
| Warm accent dim | `--accent-warm-dim` | `rgba(251, 133, 0, 0.14)` |
| Error | `--state-error` | `#D94C4C` |
| Success | `--state-success` | `#2E9E6F` |
| Warning | `--state-warning` | `#FB8500` |
| Info | `--state-info` | `#219EBC` |

Use deep navy for primary text, teal blue for primary actions and active states, and yellow/orange selectively for highlights, warnings, and secondary actions. Do not give every accent color equal visual weight on the same screen.

## Typography

| Role | Font | Variable |
| --- | --- | --- |
| UI text | Geist Sans | `--font-geist-sans` |
| Code / mono | Geist Mono | `--font-geist-mono` |

Load both through `next/font/google`, apply them as CSS variables on `<html>`, and use Geist Sans with `antialiased` for the base body.

## Border Radius

| Context | Class |
| --- | --- |
| Compact controls and inline elements | `rounded-xl` |
| Buttons, inputs, cards, and small panels | `rounded-2xl` |
| Main panels, sheets, dialogs, and overlays | `rounded-3xl` |
| Tags, avatars, and pill controls | `rounded-full` |

## Surfaces

- Prefer white surfaces over the pale blue page background.
- Use subtle blue-grey borders and soft, low-contrast shadows.
- Avoid sharp corners, heavy black shadows, glossy effects, and dense enterprise-dashboard styling.
- Use color and spacing before adding extra borders or dividers.

## Component Library

Use shadcn/ui on top of Tailwind CSS.

- Foundation components live in `components/ui/`.
- Add new shadcn/ui components through the CLI.
- Keep foundation components reusable and close to their generated defaults.
- Apply Potato Trips styling and feature-specific composition in app-level components.

## Layout Patterns

- Public pages use spacious layouts with generous empty space and a clear central focus.
- The Home page centers the main AI trip input.
- My Trips uses a responsive card grid with three columns on wide desktop screens.
- The Itinerary Plan workspace uses a full-height three-area layout: left chat, center workspace, and right map.
- Refer to `context/ui-design/` for page structure and panel placement.

## Icons

Use Lucide React stroke icons.

- `h-4 w-4` for inline icons.
- `h-5 w-5` for standard buttons.
- Larger icons only for empty states or primary actions.

## Visual Consistency

- Use semantic design tokens throughout the application.
- Keep spacing, radius, typography, and interactive states consistent.
- Prioritize clarity and ease of use over decorative complexity.
- Wireframes define layout and hierarchy; this file defines visual treatment.