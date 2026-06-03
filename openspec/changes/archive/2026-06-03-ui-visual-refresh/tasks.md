## 1. Branch & Design Tokens

- [x] 1.1 Create git branch `feat/ui-redesign` from main
- [x] 1.2 Add `--font-weight-display: 800` to `:root` in `apps/web/src/app.css`
- [x] 1.3 Add `--letter-spacing-caps: 0.08em` to `:root` in `apps/web/src/app.css`
- [x] 1.4 Verify dev server starts cleanly with no errors (`bun run dev` in `apps/web`)

## 2. ExerciseRow Component

- [x] 2.1 Create `apps/web/src/lib/components/ExerciseRow.svelte` with props: `name`, `sets`, `reps`, `weight`, `icon`, `active`
- [x] 2.2 Implement active visual state: gold left border (`3px solid var(--color-accent)`), gold tint background, gold-tinted icon badge, name in `--color-text-primary`, data line in `--color-accent`
- [x] 2.3 Implement default visual state: muted left border, near-transparent background, neutral icon badge, name in `--color-text-secondary`, data line in `--color-text-muted`
- [x] 2.4 Render data line as `{sets} Sets · {reps} Reps · {weight}` in uppercase small-caps style
- [x] 2.5 Add `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` to exercise name element

## 3. Dashboard Screen

- [x] 3.1 Apply display treatment to workout title in `apps/web/src/routes/+page.svelte` (uppercase, font-weight 800, letter-spacing -0.03em)
- [x] 3.2 Apply small-caps label style to session type and metadata (day, duration, intensity)
- [x] 3.3 Style exercise count badge with gold tint background and border
- [x] 3.4 Replace inline exercise list markup with `<ExerciseRow>` components (first exercise `active={true}`, rest `active={false}`)
- [x] 3.5 Apply gold gradient CTA style to "Start Workout" button
- [x] 3.6 Apply card container gradient and border to the workout card
- [x] 3.7 Verify dashboard in browser: title, rows, CTA all match the approved mockup

## 4. Active Workout Screen

- [x] 4.1 Apply small-caps label style to "Exercise X of Y" progress indicator in `apps/web/src/routes/workout/+page.svelte`
- [x] 4.2 Style progress bar: gold fill for completed steps, `rgba(255,255,255,0.1)` for remaining
- [x] 4.3 Apply display treatment to current exercise name (uppercase, weight 800)
- [x] 4.4 Style "Set X of Y" sub-label in gold small-caps
- [x] 4.5 Apply large number display to target reps/weight (28px, weight 800) with small-caps unit labels beneath
- [x] 4.6 Style completed sets log with left-border accent pattern (`rgba(252,211,77,0.3)` border)
- [x] 4.7 Replace any exercise substitution list markup with `<ExerciseRow active={false}>`
- [x] 4.8 Apply gold gradient CTA style to "Log Set" button
- [x] 4.9 Verify active workout screen in browser: all states match the approved mockup

## 5. Workout Summary Screen

- [x] 5.1 Apply small-caps label ("Workout Complete") and display treatment to workout name in `apps/web/src/routes/workout/summary/+page.svelte`
- [x] 5.2 Style session metadata (date, duration) as small-caps muted label
- [x] 5.3 Build stats row (exercises / sets / volume): three-column card with large bold numbers and small-caps labels beneath each
- [x] 5.4 Add "Exercises" section heading in small-caps style
- [x] 5.5 Replace exercise list markup with `<ExerciseRow>` (muted gold left border: `rgba(252,211,77,0.4)`) plus a green checkmark indicator
- [x] 5.6 Apply gold gradient CTA style to "Back to Dashboard" button
- [x] 5.7 Verify summary screen in browser

## 6. Onboarding Screen

- [x] 6.1 Apply small-caps label ("Step X of Y") and segmented gold progress bar in `apps/web/src/routes/onboarding/+page.svelte`
- [x] 6.2 Apply small-caps gold sub-label and display treatment to section heading
- [x] 6.3 Style selection tiles: selected state uses `background: rgba(252,211,77,0.08)`, `border: 1px solid rgba(252,211,77,0.3)`; unselected uses `rgba(255,255,255,0.03)` background and `rgba(255,255,255,0.08)` border
- [x] 6.4 Apply uppercase weight-800 style to tile labels (12px)
- [x] 6.5 Apply gold gradient CTA style to "Continue" / "Finish" button
- [x] 6.6 Verify onboarding screen in browser: step progress, tile selection states, CTA all match the approved mockup

## 7. Final Verification

- [x] 7.1 Run full user flow in browser: dashboard → start workout → log a set → finish → summary
- [x] 7.2 Open onboarding route directly and verify tile selection states (select + deselect)
- [x] 7.3 Run `bun run check` in `apps/web` — zero TypeScript errors
- [x] 7.4 Check that `ExerciseRow` renders correctly in both active and default states on both screens

## 8. Spacing & Consistency Polish

- [x] 8.1 Add missing `--space-1`, `--space-3`, `--space-5`, `--space-8` tokens to `app.css`
- [x] 8.2 Strip outer card background/border from dashboard section — layout container only
- [x] 8.3 Wrap unauthenticated dashboard content (hero + login form) in narrow gradient card (`max-width: 32rem`)
- [x] 8.4 Conditionalize hero h1 block on `!authSession.isReady || !authSession.isAuthenticated`
- [x] 8.5 Simplify auth-status bar — remove card padding/background, minimal flex row
- [x] 8.6 Update history aside to subtle card: `rgba(255,255,255,0.05)` bg + `rgba(255,255,255,0.08)` border
- [x] 8.7 Fix dashboard 2-column grid to responsive auto-fit (collapses below ~576px)
- [x] 8.8 Add page padding to `apps/web/src/routes/workout/+page.svelte` `<main>`
- [x] 8.9 Split workout button row: LOG SET full-width row 1; Swap/Abandon row 2 (`min-height: 44px`, `radius-lg`)
- [x] 8.10 Fix rest phase buttons: `border-radius: var(--radius-lg)` + `min-height: 44px`
- [x] 8.11 Add `width: min(100%, 52rem); margin: 0 auto` to workout/rest/summary cards
- [x] 8.12 Add page padding to `apps/web/src/routes/workout/summary/+page.svelte` `<main>`
- [x] 8.13 Fix summary loading-state card to gradient style
- [x] 8.14 Update onboarding outer section to gradient card style (drop `box-shadow`)
- [x] 8.15 Add `min-height: 100dvh` + `place-items: start center` to onboarding `<main>`
- [x] 8.16 Update onboarding outer header to new design language
- [x] 8.17 Fix tile checkboxes: visually-hidden instead of `display:none` (accessibility)
- [x] 8.18 Fix tile unselected background to `rgba(255,255,255,0.08)`; add `min-height: 44px`; add `justify-content: space-between`
- [x] 8.19 Add 20px gold circle selection indicator to each tile (right-aligned)
- [x] 8.20 Fix ready-step review box background to `rgba(255,255,255,0.05)`
- [x] 8.21 Run `bun run typecheck` — zero errors
- [x] 8.22 Visual verification: all four screens consistent spacing, no double-card, tiles interactive, buttons accessible
