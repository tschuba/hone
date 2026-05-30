## Context

Prototype and runtime hardening establish behavior, but operations still need actionable visibility. This design defines minimal diagnostics and controls to support BYOM launch with low operational overhead.

## Goals / Non-Goals

**Goals:**
- Define operator-visible runtime health indicators.
- Define minimal operational controls for safe intervention.
- Standardize telemetry fields required for triage.

**Non-Goals:**
- Full-featured admin analytics suite.
- Managed billing and entitlement control UX.

## Decisions

1. Minimum diagnostics must include provider status, last error class, and last success timestamp.
2. Fallback and verification decision telemetry must be queryable for incident review.
3. Controls remain minimal and safety-focused for launch.

## Risks / Trade-offs

- [Too little telemetry increases MTTR] -> Mitigation: require minimum diagnostics fields before rollout.
- [Too many controls increase misuse risk] -> Mitigation: launch with minimal scoped controls only.
