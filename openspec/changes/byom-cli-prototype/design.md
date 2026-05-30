## Context

Hone is launching with BYOM as the default AI model strategy and deferring managed models. The team prefers a primary CLI provider path with fallback to a secondary provider, but reliability and safety assumptions are currently unproven. The design must preserve strict safety behavior (especially Sport Medic strict-gate), avoid browser-side CLI execution, and keep managed-mode seams available for future activation.

## Goals / Non-Goals

**Goals:**
- Validate CLI/API provider behavior through a prototype before architecture lock.
- Keep a transport-agnostic runtime contract for adapters.
- Enforce reason-aware fallback with single-hop depth at launch.
- Enforce CLI execution safety controls and measurable reliability gates.
- Produce an unambiguous go/no-go outcome for CLI launch support.

**Non-Goals:**
- Implementing managed-model billing, entitlement UX, or runtime activation.
- Expanding strict-gate policy beyond agreed launch scope.
- Making local companion daemon the launch default.

## Decisions

1. Prototype-first gate before launch architecture lock.
- Rationale: reduces risk from unknown CLI runtime behavior.
- Alternative considered: direct implementation first; rejected due to safety and reliability uncertainty.

2. Transport-agnostic contract.
- Contract: `invoke(input) -> structured_output | classified_error`.
- Rationale: keeps caller logic stable across adapter types.
- Alternative considered: adapter-specific call paths; rejected due to coupling and test complexity.

3. Capability handshake required for each provider path.
- Required fields: `non_interactive_supported`, `supports_structured_output`, `max_timeout_ms`, `auth_mode`, `health_status`.
- Rationale: prevents hidden assumptions in failover policy.

4. Single-hop fallback at launch.
- Policy: primary -> secondary only.
- Fallback allowed for `quota_exceeded`, `rate_limited`, `temporary_unavailable`.
- Fallback blocked for `auth_invalid`, `misconfigured`, `policy_blocked`, and unmapped errors.
- Rationale: limits complexity and improves debuggability during launch.

5. Execution placement policy.
- Browser-side CLI: unsupported.
- Tenant-hosted backend worker: launch default.
- Local companion daemon: optional future profile.
- Rationale: security, observability, and operational consistency.

6. CLI safety controls are hard gates.
- Must enforce command allowlist, fixed binary path, no shell interpolation, env scrubbing, and timeout/kill behavior.
- Rationale: CLI invocation is high-risk and must be constrained.

7. Prototype acceptance thresholds.
- Parse reliability: >=95% overall and >=90% per provider with one retry max.
- Primary CLI p95 latency: <=12s.
- Timeout rate: <=5%.
- Success rate: >=95%.
- Rationale: balanced quality bar aligned with launch velocity.

8. Prototype artifact format.
- Deliverable: harness spec plus evidence report.
- Rationale: captures both executable contract and decision evidence.

## Risks / Trade-offs

- [CLI behavior differs by environment] -> Mitigation: capability handshake and matrix across target runtime.
- [Fallback misclassification could bypass safety intent] -> Mitigation: strict taxonomy mapping and hard blocker on unknown critical classes.
- [Latency variability from CLI provider] -> Mitigation: p95 threshold and breaker policy in prototype report.
- [Operational complexity from optional local daemon profile] -> Mitigation: keep tenant worker container as launch baseline and defer daemon default.
