# Tasks

## Sub-Change Completion

- [ ] 1.1 `plan-screen` — all tasks in [plan-screen/tasks.md](../plan-screen/tasks.md) complete and merged.
- [ ] 1.2 `calisthenics-fixtures` — all tasks in [calisthenics-fixtures/tasks.md](../calisthenics-fixtures/tasks.md) complete and merged.
- [ ] 1.3 `rule-engine-variety` — all tasks in [rule-engine-variety/tasks.md](../rule-engine-variety/tasks.md) complete and merged.
- [ ] 1.4 `deployment-coolify` — all tasks in [deployment-coolify/tasks.md](../deployment-coolify/tasks.md) complete and merged.

## End-to-End MVP Validation

- [ ] 2.1 On a freshly provisioned instance (not localhost): register account, complete onboarding including equipment pool setup.
- [ ] 2.2 Navigate to `/plan`, confirm empty state, generate a mesocyclus with the calisthenics equipment pool and a chosen session duration. Confirm all 3 session templates show only bodyweight / pull-up bar / rower exercises, and no knee-loading exercises (jump squats, lunges, burpees, etc.) appear given the knee impact constraint set in onboarding.
- [ ] 2.3 Start a workout from the dashboard on a mobile phone over the public HTTPS URL. Log sets for each exercise. Complete the session.
- [ ] 2.4 Open `/plan`, confirm cycle progress reflects the completed session and the next session is marked UP NEXT.
- [ ] 2.5 Put the phone in airplane mode, start the next workout, log at least one set. Reconnect. Confirm the set syncs.
- [ ] 2.6 On `/plan`, adjust cycle count and session duration, hit Regenerate. Confirm the old mesocyclus is archived and a new one is generated with the updated parameters.
