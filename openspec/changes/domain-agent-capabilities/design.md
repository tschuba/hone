## Context

As more agent roles are introduced, role ambiguity can create unsafe outputs and policy drift. This design defines domain boundaries and handoff behavior to keep responses aligned with risk levels.

## Goals / Non-Goals

**Goals:**
- Define capability boundaries for each agent domain.
- Define escalation and handoff policy between domains.
- Reduce ambiguity in high-risk prompts.

**Non-Goals:**
- Implementing UI persona presentation details.
- Expanding into diagnostic or treatment-prescriptive medical behavior.

## Decisions

1. Fitness and diet agents must defer high-risk medical contexts to sport medic policy path.
2. Sport medic remains supportive safety coach, not diagnostic authority.
3. Prohibited output classes are explicitly defined per agent.

## Risks / Trade-offs

- [Overly conservative handoff reduces direct answers] -> Mitigation: tune triggers with clear examples.
- [Insufficiently strict boundaries create liability risk] -> Mitigation: explicit prohibited classes and tests.
