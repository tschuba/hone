## Why

Managed mode is intentionally deferred, but schema and contracts must be ready now to avoid future breaking changes. A managed-ready schema change ensures forward compatibility without exposing managed features in launch UX.

## What Changes

- Define dormant managed capability fields in schema and configuration contracts.
- Define compatibility constraints so managed activation can occur without API breaks.
- Explicitly prohibit managed references in launch user-facing settings and copy.

## Capabilities

### New Capabilities
- `managed-ready-schema`: Forward-compatible managed-mode contract fields and constraints with launch-time managed behavior disabled.

### Modified Capabilities
- None.

## Impact

- Affects schema and config contracts only.
- Preserves launch scope while reducing future migration risk.
