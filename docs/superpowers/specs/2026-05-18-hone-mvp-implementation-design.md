# Hone MVP — Implementation Design

**Date:** 2026-05-18
**Status:** Approved → see [MVP_IMPLEMENTATION_PLAN.md](../../implementation/MVP_IMPLEMENTATION_PLAN.md)

---

## Why This Document Exists

The Hone architecture (`ARCHITECTURE.md`) captures *what* and *why*. This spec records the *how* decisions made during the planning session — specifically, the corrections and additions surfaced by 7 expert reviews before implementation began. Developers should read this alongside `ARCHITECTURE.md`.

---

## Decisions Made

### Sequencing (Layer-by-Layer)

Chosen over vertical slices or critical-path-first because:
- Each layer unblocks the whole team systematically
- Clear "done" gates per sprint
- Security and auth (Sprint 1) must precede all business logic

**Sprint order:** Foundation → Auth → Exercise DB → Profile → Plan Generation → Workout Session → Frontend → PWA/Offline → Hardening

### Multi-Agent Expert Review

Seven expert agents reviewed the sprint plan before writing began. Key corrections:

| Domain | Critical Corrections |
|--------|----------------------|
| **Backend Architect** | `plan-validation.ts` must exist in Sprint 0; `$queryRaw` CI guard in Sprint 0 not Sprint 8; `used_logout_tokens` table in Sprint 1 |
| **Database Optimizer** | `ai_jobs` index column order wrong (priority DESC first, not status); cursor pagination needs `(userId, createdAt, id)` not `(userId, id)`; `findUnique` bypasses soft-delete extension |
| **Security Engineer** | 5 Sprint 1 blockers (OIDC hardening, session fixation, CSRF pattern, canonical identity, backchannel logout); CSP required in Sprint 6 not Sprint 8; Gitleaks in Sprint 0 |
| **DevOps Automator** | Ollama optional via `--profile ai` flag; 3-stage Bun Dockerfile with ARM64 target; nginx for SvelteKit static; sentinel-based backup monitoring |
| **AI Engineer** | Rule-based fallback must be deterministic (slot-fill), not random; worker startup orphan recovery BEFORE LISTEN; thin AIProvider interface; output validation in 2 phases |
| **Frontend Developer** | No XState (bundle cost); discriminated union state machine; `generateSW` Workbox mode; no `skipWaiting`+`clientsClaim` mid-workout |
| **Accessibility Auditor** | Gray-400/500 fail WCAG AA on surface color; `aria-live="assertive"` state machine region; `image_alt_text` required field; timer milestone announcements only |

### Key Tradeoffs Confirmed

- **argon2 params:** `memoryCost: 32768, parallelism: 2, timeCost: 4` — above architecture's original 19MB, below OWASP 64MB. Documented as conscious Pi trade-off.
- **No XState:** Bundle cost (~20KB) unjustified for a linear state machine. Plain TypeScript discriminated union.
- **No `skipWaiting` on SW update:** Prevents breaking a user's active workout. Update applies after `summary` phase.
- **pgvector extension in Sprint 2:** Adding it to a live DB requires superuser + catalog lock. Avoid by including it in initial migrations.
- **OIDC `sub` not email as canonical identity:** Email is mutable; accounts must never auto-link by email.

---

## Non-Goals (MVP)

- Social features, push notifications, wearables, video guidance
- Light mode (Phase 6)
- Drag-drop exercise reordering (Phase 6)
- RAG / pgvector search (Phase 4)
- Body metrics charts (Phase 3)
- Admin panel UI (Phase 5)
- TTS / vibration (Phase 2)

---

## Related Documents

- `ARCHITECTURE.md` — full technical specification
- `docs/implementation/MVP_IMPLEMENTATION_PLAN.md` — executable implementation plan
