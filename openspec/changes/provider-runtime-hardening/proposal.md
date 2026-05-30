## Why

After the BYOM prototype gate, Hone needs a stable and hardened provider runtime contract before broader feature rollout. Without this hardening layer, adapter behavior, fallback policy, and reliability controls will remain inconsistent across providers.

## What Changes

- Define a stable transport-agnostic provider runtime interface for CLI and API adapters.
- Standardize error taxonomy and fallback eligibility mapping.
- Add single-hop fallback orchestration and circuit-breaker rules.
- Define runtime reliability and observability expectations for provider execution.

## Capabilities

### New Capabilities
- `provider-runtime-hardening`: Stable runtime contract, fallback orchestration, and reliability controls for BYOM providers.

### Modified Capabilities
- None.

## Impact

- Affects provider integration service boundaries and worker execution flow.
- Establishes required runtime behavior for downstream safety and retrieval features.
- No managed-mode user experience changes.
