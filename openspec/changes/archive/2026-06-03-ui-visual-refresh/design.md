## Context

Hone is a SvelteKit PWA with four screens (dashboard, active workout, workout summary, onboarding). All UI is currently built with inline styles and CSS custom properties — no component library, no utility classes. The existing design is functional but visually flat: generic card borders, mixed font weights with no clear hierarchy, and CTAs that don't carry visual weight.

The design direction was chosen through a visual prototype session comparing three directions. The selected approach preserves the navy + gold brand identity while injecting athletic energy via bold uppercase typography, left-border exercise row highlights, and a gold gradient CTA style.

## Goals / Non-Goals

**Goals:**
- Establish a consistent typographic hierarchy applied uniformly across all four screens
- Create a reusable `ExerciseRow` component to replace duplicated markup and ensure visual consistency
- Polish all four screens to match the validated mockups

**Non-Goals:**
- Light mode or theming support
- Changes to layout structure or information architecture
- Changes to any backend or API behavior
- Replacing the inline-style pattern across the whole codebase (only touched in affected screens)

## Decisions

**Keep inline styles, don't introduce utility classes**
The codebase uses inline styles consistently. Introducing a utility layer (e.g., Tailwind) for a visual refresh would be a much larger change with risk of regressions. Instead, two new CSS custom properties encode the new typographic tokens and inline styles reference them. This matches the existing pattern exactly.

*Alternative considered:* Extract all design tokens to a CSS class system. Rejected — too much scope for a visual refresh; the component boundary on `ExerciseRow` already solves the duplication problem.

**Extract `ExerciseRow` as the only new component**
The exercise row is the most visually important and most duplicated pattern — it appears on the dashboard and the active workout screen. Extracting it once guarantees visual consistency and makes future iteration easy. Everything else stays inline.

*Alternative considered:* Extract more components (button, badge, label). Rejected — YAGNI. Buttons have enough variation in context that a component adds boilerplate without value at this stage.

**Use `text-transform: uppercase` via inline style, not a wrapper class**
Uppercase is applied at the element level to specific text nodes. A wrapper class would require adding a class attribute alongside the existing inline style, which is noisier than just adding the property inline.

## Risks / Trade-offs

Long exercise names may look cramped at 13px uppercase with tight letter-spacing on small screens → Use `overflow: hidden; text-overflow: ellipsis` on the exercise name element in `ExerciseRow`.

Emoji icons have inconsistent sizing and baseline across platforms → Constrain the icon badge to a fixed 34×34px flex container; emoji renders inside it will be clipped naturally.

526-line and 457-line page files make targeted edits error-prone → Update screens one at a time and verify each in the browser before moving to the next.

## Migration Plan

No data migration required. Visual-only change:
1. Create branch `feat/ui-redesign`
2. Apply CSS token additions → verify dev server starts cleanly
3. Create `ExerciseRow` component → no regressions yet (not used)
4. Integrate `ExerciseRow` into dashboard → verify in browser
5. Integrate `ExerciseRow` into active workout → verify in browser
6. Update workout summary → verify in browser
7. Update onboarding → verify in browser

Rollback: revert the branch. No database or API changes to undo.

## Mockups

Visual prototypes validated during the brainstorming session are included in `mockups/`:

- [`mockups/dashboard-and-workout.html`](mockups/dashboard-and-workout.html) — Dashboard workout card and active workout screen (final approved design)
- [`mockups/summary-and-onboarding.html`](mockups/summary-and-onboarding.html) — Workout summary and onboarding screens

Open either file directly in a browser to review the reference design.

## Open Questions

None — design fully validated through prototype review.
