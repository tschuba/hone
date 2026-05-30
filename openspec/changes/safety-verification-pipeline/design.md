## Context

Provider runtime hardening establishes invocation/fallback behavior, but output trustworthiness still requires a separate policy pipeline. This design keeps verification independent from transport and model vendor specifics.

## Goals / Non-Goals

**Goals:**
- Define a deterministic verification sequence (claims, evidence, freshness, outcome).
- Ensure strict-gate parity across provider paths.
- Standardize abstain/escalate behavior for unverified output.

**Non-Goals:**
- Provider runtime contract changes.
- New retrieval source ranking logic (covered separately).

## Decisions

1. Verification executes after generation and before user-visible response.
2. Unsafe or insufficiently verified content defaults to abstain/escalate.
3. Strict-gate policy outcome is authoritative over provider response confidence.

## Risks / Trade-offs

- [High abstain rate hurts UX] -> Mitigation: tune thresholds with policy guardrails, not provider shortcuts.
- [Verification latency increases response time] -> Mitigation: parallelizable checks and bounded evidence depth.
