## Why

The app is functional but visually flat — it lacks the energy and polish expected of a fitness app. A full visual refresh across all four screens will give Hone the premium, athletic feel that motivates users, while keeping the existing navy + gold brand identity intact.

## What Changes

- Add two new CSS design tokens (`--font-weight-display`, `--letter-spacing-caps`) to establish a consistent typographic system
- Introduce a new `ExerciseRow` shared component that replaces duplicated exercise markup on the dashboard and active workout screen
- Redesign all four screens — dashboard, active workout, workout summary, and onboarding — with the new design language: uppercase labels, bold display typography, left-border exercise row highlights, and gold gradient CTAs
- Card backgrounds gain a subtle dark gradient and a faint border for depth

## Capabilities

### New Capabilities

- `ui-design-language`: Design token system and typographic hierarchy that applies consistently across all screens — covers CSS tokens, uppercase labelling patterns, exercise row visual states (active/default), and the gold gradient CTA style
- `exercise-row-component`: Reusable `ExerciseRow.svelte` component with active/default visual states, used on the dashboard and active workout screen

### Modified Capabilities

<!-- No existing spec-level behavior changes — this is a purely visual refresh -->

## Impact

- `apps/web/src/app.css` — two new CSS custom properties
- `apps/web/src/lib/components/ExerciseRow.svelte` — new file
- `apps/web/src/routes/+page.svelte` — dashboard redesign
- `apps/web/src/routes/workout/+page.svelte` — active workout redesign
- `apps/web/src/routes/workout/summary/+page.svelte` — summary redesign
- `apps/web/src/routes/onboarding/+page.svelte` — onboarding redesign
- No API changes, no data model changes, no breaking changes
