## Why

Hone requires a transport-independent safety and verification layer so output correctness does not depend on which provider produced it. This is essential for strict-gate behavior and trustworthy recommendations.

## What Changes

- Define claim extraction and evidence-verification pipeline stages.
- Define freshness and confidence policies for verified outputs.
- Define abstain/escalate outcomes when verification cannot pass.
- Require strict-gate parity regardless of primary or fallback provider path.

## Capabilities

### New Capabilities
- `safety-verification-pipeline`: Claim/evidence verification pipeline with strict-gate enforcement and abstain controls.

### Modified Capabilities
- None.

## Impact

- Affects post-generation processing behavior and safety policy enforcement.
- Supports domain-agent guardrail features and retrieval governance.
