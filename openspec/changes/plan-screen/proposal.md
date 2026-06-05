## Why

The plan generation flow has three problems that block real use. First, the structure of the current mesocyclus is invisible — there is no way to see what Session 1, 2, and 3 contain before committing to them. Second, the "Generate plan" button on the dashboard passes no equipment pool and hardcodes 30 minutes and 4 weeks, so the rule engine cannot tailor the plan to the user's actual setup. Third, there is no way to regenerate a plan mid-cycle without knowing to delete and recreate one manually.

## What Changes

- Add a dedicated `/plan` route that shows the active mesocyclus: cycle progress, sessions per cycle with their exercises and sets, and controls to regenerate.
- Add a `GET /api/v1/plans/active` endpoint that returns the full mesocyclus structure including all workout templates, their exercises, and session counts.
- Replace hardcoded plan generation arguments with user-selectable equipment pool, cycle count, and session duration — surfaced both on the `/plan` screen and on the dashboard for first-time generation.
- Rename the `weeksCount` parameter to `cycleCount` in the plan API and UI to reflect the session-based reality. The backend engine value maps 1:1; this is a naming fix.
- Archive the current active mesocyclus automatically when a new one is generated, rather than leaving orphaned active plans.

## Capabilities

### New Capabilities
- `plan-visibility-and-control`: View the active mesocyclus structure (cycle progress, session templates with exercises), configure generation parameters (equipment pool, cycle count, session duration), and regenerate on demand.

### Modified Capabilities
- None.

## Impact

- Adds `apps/web/src/routes/plan/+page.svelte`.
- Adds `GET /plans/active` to `apps/api/src/routes/plan.routes.ts`.
- Modifies `apps/api/src/routes/plan.routes.ts` POST handler to accept `cycleCount` (replaces `weeksCount`) and archive any existing active mesocyclus before creating the new one.
- Modifies `apps/web/src/lib/api.ts` to add `getActivePlan()` and update `createPlan()` to accept equipment pool, cycle count, and session duration.
- Modifies `apps/web/src/routes/+page.svelte` to pass equipment pool and session duration when generating the first plan, and to link to `/plan`.
