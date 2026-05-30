## Why

Hone needs a reliable BYOM-first integration path for CLI and API providers, but key assumptions are still unverified (non-interactive CLI behavior, parse reliability, failover safety, and strict-gate parity). A prototype-first change reduces launch risk and prevents architecture lock-in based on untested behavior.

## What Changes

- Add a prototype-first decision gate before enabling CLI-backed BYOM in launch scope.
- Define a transport-agnostic provider runtime contract usable by CLI and API adapters.
- Define reason-aware single-hop fallback (primary to secondary) with explicit fallback-allowed and fallback-blocking error classes.
- Enforce CLI safety controls (allowlist, fixed binary paths, no shell interpolation, env scrubbing, timeout/kill).
- Lock launch scope to BYOM-only, with managed capability deferred but architecture-enabled.
- Standardize execution placement: tenant-hosted backend worker default; browser-side CLI unsupported; local daemon optional future mode.

## Capabilities

### New Capabilities
- `byom-cli-prototype`: Prototype and decision-gate framework for CLI/API BYOM provider integration, including safety, failover, and reliability acceptance criteria.

### Modified Capabilities
- None.

## Impact

- Affected architecture and planning artifacts in OpenSpec for BYOM integration decisions.
- Affected implementation surfaces after approval: provider abstraction, worker execution/failover logic, and safety verification pipeline.
- No managed billing/entitlement UX changes in launch scope.
