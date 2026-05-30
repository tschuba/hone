## Context

Verification quality depends on evidence quality. Without governance, open-web retrieval can introduce noisy or stale sources that undermine strict-gate and trust guarantees.

## Goals / Non-Goals

**Goals:**
- Define trust ranking model and acceptance thresholds.
- Define freshness policies by evidence category.
- Define contradiction and tie-break behavior.

**Non-Goals:**
- Building full editorial curation workflows.
- Replacing verification pipeline policies.

## Decisions

1. Open web remains enabled, but evidence is admitted only if trust thresholds pass.
2. Freshness windows are policy-defined and enforced at verification time.
3. Conflicting sources trigger contradiction handling and possible abstain.

## Risks / Trade-offs

- [Stricter thresholds reduce answer rate] -> Mitigation: calibrate thresholds per domain risk level.
- [Looser thresholds degrade trust] -> Mitigation: policy-backed minimum source quality floor.
