## 1. API — Active Plan Endpoint

- [x] 1.1 Add `GET /plans/active` route to `plan.routes.ts`: query the active mesocyclus for the authenticated user, fetch its workout templates with exercises, count completed `WorkoutSession` records, and return the response shape defined in `design.md`.
- [x] 1.2 Implement `isNext` detection: find the workout template that follows the most recently completed session in rotation order (position 1→2→3→1→…). Extract this logic into a shared helper so the dashboard "today" query and the plan screen use the same source.
- [x] 1.3 Add archive-on-regenerate to the `POST /plans` handler: before creating a new mesocyclus, set any existing ACTIVE mesocyclus to ARCHIVED for the same user.
- [x] 1.4 Rename `weeksCount` to `cycleCount` in the POST body parser. Pass through to the rule engine as-is (engine value unchanged).
- [x] 1.5 Add `getActivePlan()` and update `createPlan()` in `apps/web/src/lib/api.ts` to match the new contract.

## 2. Frontend — /plan Route

- [x] 2.1 Create `apps/web/src/routes/plan/+page.svelte` with the layout defined in `design.md`: fixed nav bar, scrollable body, sticky action bar.
- [x] 2.2 Implement the cycle progress dot grid: rows for each cycle, dots for each session (filled = done, outlined with badge = next, faint = upcoming), progress bar below.
- [x] 2.3 Implement the sessions-per-cycle list: one card per session template, exercises listed with sets × reps or duration, "UP NEXT" badge on the next session.
- [x] 2.4 Implement the sticky action bar: equipment pool dropdown (populated from `GET /equipment-pools`), cycles dropdown (options: 2, 3, 4, 6), session duration dropdown (options: 30, 45, 60, 90 min), "Regenerate →" button, subtext note.
- [x] 2.5 Handle empty state (no active mesocyclus): prompt in scrollable body, "Generate →" label on the button.
- [x] 2.6 Handle the regenerate action: call `createPlan()` with selected parameters, reload the plan data on success, show an inline error on failure.

## 3. Dashboard Integration

- [x] 3.1 Add a "View plan →" link to the authenticated header bar in `apps/web/src/routes/+page.svelte`.
- [x] 3.2 Update the dashboard "Generate plan" button to pass the user's first equipment pool (if any) and a default session duration, instead of hardcoded values.

## 4. Validation

- [x] 4.1 Test `GET /plans/active`: returns correct structure, `isNext` flag is accurate after varying numbers of completed sessions, returns 404 when no active plan.
- [x] 4.2 Test `POST /plans` archive-on-regenerate: existing ACTIVE mesocyclus is set to ARCHIVED; new one is created; history is preserved.
- [ ] 4.3 Manual check: generate a plan, open `/plan`, verify cycle grid and session templates display correctly; complete a session, reload, verify progress updates.
