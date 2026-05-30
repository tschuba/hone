## Context

The product strategy is BYOM-first at launch. Managed mode will come later, but contract evolution must avoid disruptive migrations and public API breaks.

## Goals / Non-Goals

**Goals:**
- Define dormant managed fields that do not change launch behavior.
- Guarantee backward-compatible activation path for managed mode.
- Keep managed UX references out of launch surfaces.

**Non-Goals:**
- Enabling managed runtime, billing, or entitlement workflows.
- Introducing managed controls in launch UI.

## Decisions

1. Add managed-ready contract fields with disabled/default-off semantics.
2. Keep launch behavior strictly BYOM despite schema expansion.
3. Require no public API contract break for future managed activation.

## Risks / Trade-offs

- [Premature schema complexity] -> Mitigation: minimal dormant field set only.
- [Accidental managed exposure] -> Mitigation: explicit prohibition in launch UX/copy requirements.
