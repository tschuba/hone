## Context

The prototype change validates feasibility; this change turns findings into a hardened runtime contract. Downstream changes depend on deterministic provider behavior and a consistent fallback model.

## Goals / Non-Goals

**Goals:**
- Standardize provider invocation contract and lifecycle.
- Enforce classified single-hop fallback behavior.
- Define breaker and retry boundaries for launch reliability.

**Non-Goals:**
- Expanding to managed runtime activation.
- Building operator UI controls (handled separately).

## Decisions

1. Keep transport-agnostic interface for all adapters.
2. Use single-hop fallback at launch for operability.
3. Treat unknown errors as fallback-blocking until mapped.
4. Enforce breaker thresholds from prototype outcomes.

## Risks / Trade-offs

- [Overly strict taxonomy blocks recoverable requests] -> Mitigation: controlled taxonomy expansion process.
- [Breaker thresholds too lenient] -> Mitigation: tune from observed SLOs and incident reviews.
