## 1. Branch & Design Tokens

- [ ] 1.1 Create git branch `feat/ui-redesign` from main
- [ ] 1.2 Add `--font-weight-display: 800` to `:root` in `apps/web/src/app.css`
- [ ] 1.3 Add `--letter-spacing-caps: 0.08em` to `:root` in `apps/web/src/app.css`
- [ ] 1.4 Verify dev server starts cleanly with no errors (`bun run dev` in `apps/web`)

## 2. ExerciseRow Component

- [ ] 2.1 Create `apps/web/src/lib/components/ExerciseRow.svelte` with props: `name`, `sets`, `reps`, `weight`, `icon`, `active`
- [ ] 2.2 Implement active visual state: gold left border (`3px solid var(--color-accent)`), gold tint background, gold-tinted icon badge, name in `--color-text-primary`, data line in `--color-accent`
- [ ] 2.3 Implement default visual state: muted left border, near-transparent background, neutral icon badge, name in `--color-text-secondary`, data line in `--color-text-muted`
- [ ] 2.4 Render data line as `{sets} Sets · {reps} Reps · {weight}` in uppercase small-caps style
- [ ] 2.5 Add `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` to exercise name element

## 3. Dashboard Screen

- [ ] 3.1 Apply display treatment to workout title in `apps/web/src/routes/+page.svelte` (uppercase, font-weight 800, letter-spacing -0.03em)
- [ ] 3.2 Apply small-caps label style to session type and metadata (day, duration, intensity)
- [ ] 3.3 Style exercise count badge with gold tint background and border
- [ ] 3.4 Replace inline exercise list markup with `<ExerciseRow>` components (first exercise `active={true}`, rest `active={false}`)
- [ ] 3.5 Apply gold gradient CTA style to "Start Workout" button
- [ ] 3.6 Apply card container gradient and border to the workout card
- [ ] 3.7 Verify dashboard in browser: title, rows, CTA all match the approved mockup

## 4. Active Workout Screen

- [ ] 4.1 Apply small-caps label style to "Exercise X of Y" progress indicator in `apps/web/src/routes/workout/+page.svelte`
- [ ] 4.2 Style progress bar: gold fill for completed steps, `rgba(255,255,255,0.1)` for remaining
- [ ] 4.3 Apply display treatment to current exercise name (uppercase, weight 800)
- [ ] 4.4 Style "Set X of Y" sub-label in gold small-caps
- [ ] 4.5 Apply large number display to target reps/weight (28px, weight 800) with small-caps unit labels beneath
- [ ] 4.6 Style completed sets log with left-border accent pattern (`rgba(252,211,77,0.3)` border)
- [ ] 4.7 Replace any exercise substitution list markup with `<ExerciseRow active={false}>`
- [ ] 4.8 Apply gold gradient CTA style to "Log Set" button
- [ ] 4.9 Verify active workout screen in browser: all states match the approved mockup

## 5. Workout Summary Screen

- [ ] 5.1 Apply small-caps label ("Workout Complete") and display treatment to workout name in `apps/web/src/routes/workout/summary/+page.svelte`
- [ ] 5.2 Style session metadata (date, duration) as small-caps muted label
- [ ] 5.3 Build stats row (exercises / sets / volume): three-column card with large bold numbers and small-caps labels beneath each
- [ ] 5.4 Add "Exercises" section heading in small-caps style
- [ ] 5.5 Replace exercise list markup with `<ExerciseRow>` (muted gold left border: `rgba(252,211,77,0.4)`) plus a green checkmark indicator
- [ ] 5.6 Apply gold gradient CTA style to "Back to Dashboard" button
- [ ] 5.7 Verify summary screen in browser

## 6. Onboarding Screen

- [ ] 6.1 Apply small-caps label ("Step X of Y") and segmented gold progress bar in `apps/web/src/routes/onboarding/+page.svelte`
- [ ] 6.2 Apply small-caps gold sub-label and display treatment to section heading
- [ ] 6.3 Style selection tiles: selected state uses `background: rgba(252,211,77,0.08)`, `border: 1px solid rgba(252,211,77,0.3)`; unselected uses `rgba(255,255,255,0.03)` background and `rgba(255,255,255,0.08)` border
- [ ] 6.4 Apply uppercase weight-800 style to tile labels (12px)
- [ ] 6.5 Apply gold gradient CTA style to "Continue" / "Finish" button
- [ ] 6.6 Verify onboarding screen in browser: step progress, tile selection states, CTA all match the approved mockup

## 7. Final Verification

- [ ] 7.1 Run full user flow in browser: dashboard → start workout → log a set → finish → summary
- [ ] 7.2 Open onboarding route directly and verify tile selection states (select + deselect)
- [ ] 7.3 Run `bun run check` in `apps/web` — zero TypeScript errors
- [ ] 7.4 Check that `ExerciseRow` renders correctly in both active and default states on both screens
