## Why

Hone's core training loop (auth, onboarding, plan generation, workout sessions, offline queuing) is largely built through Sprint 7. Before it can serve its intended purpose — tracking calisthenics workouts outdoors, solo — four gaps need to close: the plan is invisible and uncontrollable, the exercise library is too thin for a calisthenics setup, the rule engine always picks the same exercises so sessions never vary, and the app is not deployed anywhere a phone can reach it.

This change defines the MVP scope and tracks readiness across the three dedicated sub-changes required to close those gaps. It does not add new features beyond what is described in those sub-changes.

## MVP Definition

**The app is at MVP when a single user can:**
1. Complete onboarding (set goals, constraints, and an equipment pool for bodyweight + pull-up bar + rower).
2. Generate a mesocyclus from their equipment pool and inspect the full session structure before training.
3. Start a workout outdoors on a mobile phone, log sets, and have them sync when back home.
4. Track progress through cycles and regenerate a plan on demand.

**Explicitly out of MVP scope:**
- AI / BYOM integration (rule engine is sufficient)
- External exercise database import (extended fixtures are sufficient)
- Multi-user support
- Analytics or progress charts
- Manual session editing

## Sub-Changes

| Change | What it closes | Status |
|--------|---------------|--------|
| [plan-screen](../plan-screen/proposal.md) | Plan invisible, generation ignores equipment/duration | Not started |
| [calisthenics-fixtures](../calisthenics-fixtures/proposal.md) | Exercise library too thin for bodyweight training | Not started |
| [rule-engine-variety](../rule-engine-variety/proposal.md) | Sessions repeat the same exercises every cycle | Not started |
| [deployment-coolify](../deployment-coolify/proposal.md) | App not reachable outside home network | Not started |

## Capabilities

### New Capabilities
- None (this change tracks readiness; capabilities are defined in sub-changes).

### Modified Capabilities
- None.

## Impact

This change has no direct code impact. Completion is defined as all three sub-changes merged and the end-to-end MVP validation passing (see tasks).
