## Context

The AI job pipeline exists (worker, queue, pg_notify) but produces no user-visible output today — `UnconfiguredAiProvider` is a no-op. The rule engine generates plans synchronously on `POST /plans`; users experience immediate feedback but get no AI benefit.

Key constraints discovered during design:
- AI generation can take 2–7 minutes (Ollama on NAS without GPU)
- The active plan must remain usable while AI optimises in the background
- BYOM and managed-AI deployments have different rate-limit ownership models
- The current `AiRateLimiter` has a TOCTOU race and the 60-minute cooldown is too coarse

Current schema is missing: `pending_ai_plan_id` on `mesocyclus`, `completedAt` on `ai_job`.

## Goals / Non-Goals

**Goals:**
- AI output lands in a new pending mesocyclus without disturbing the active plan
- User explicitly approves the AI plan before it takes effect (apply now / defer / dismiss)
- Plan creation always returns 201 — AI is best-effort, never a blocker
- Rate limiting is TOCTOU-safe and transparent (client gets `retryAfter`, not a mystery 400)
- Plan screen reflects AI job progress in real time without SSE

**Non-Goals:**
- Streaming AI output to the client during generation
- In-place mutation of the active mesocyclus by the AI
- Forcing users to wait for AI before seeing their plan
- Per-exercise AI coaching (scope: mesocyclus-level optimisation only)
- Worker cost limiting implementation (needs separate budget model design)

## Decisions

### D1 — AI output creates a new pending mesocyclus, not an in-place update

The active mesocyclus is the source of truth for the user's current training. Mutating it in-place while the user may be mid-session is unsafe and irreversible.

**Decision**: Worker creates a `Mesocyclus` row with `planSource=AI_GENERATED`, `status=PENDING`. The active mesocyclus holds a nullable FK `pending_ai_plan_id → mesocyclus(id) ON DELETE SET NULL`.

**Alternative considered**: Store AI output in `AiJob.output` and materialise on review. Rejected: the plan data structure is complex (nested workouts + exercises); materialising on-the-fly couples the review endpoint to parsing logic and makes the AI plan invisible to existing plan queries.

### D2 — Three-gate route-level rate limiting replaces the 60-minute cooldown

The 60-minute cooldown is opaque and disproportionate. A user who regenerates and immediately gets a different result (AI job completes quickly) is blocked for an hour. 

**Decision**:
1. **Concurrency gate**: if a PENDING/PROCESSING job exists for this user+type, skip the AI job and return `{ jobId: null }` in the 201 response.
2. **Debounce gate**: if a job reached a terminal state < 60s ago (anchored to `completedAt`), skip and return `{ jobId: null, retryAfter: <ISO> }`.
3. **Daily cap**: hard 429 with `{ retryAfter, limitType: 'daily', resetAt }` — admin-defined for managed AI, user-configured for BYOM.

Feedback jobs are exempt from the daily cap (per ARCHITECTURE.md).

**TOCTOU fix**: Add a DB-level unique partial index `UNIQUE (user_id, type) WHERE status IN ('PENDING', 'PROCESSING')` on `ai_job`. The app-level check is a fast-path optimisation; the index is the safety net.

### D3 — GET /plans/active is enriched with AI job state; client polls at ~2s

SSE adds operational complexity (connection management, reconnect logic) that isn't justified for MVP timescales. AI jobs run for 2–7 minutes — polling every 2 seconds produces ~60–210 requests per job, well within acceptable load at MVP scale.

**Decision**: Extend `GET /plans/active` response with an optional `aiJob` field:
```
aiJob: {
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'DEAD' | null
  pendingMesocyclusId: string | null   // populated when status=DONE
  retryAfter: ISO string | null        // populated when debounce active
} | null
```
Client polls while `status` is PENDING or PROCESSING; stops on any terminal state. The terminal-state poll response triggers the UI re-render (review prompt or unavailable badge).

**Implementation note**: `GET /plans/active` currently makes one multi-join query. The AI job lookup is an additional `findFirst` on `ai_job` where `(userId, type='MESOCYCLUS', status IN ('PENDING','PROCESSING'))`. This needs a composite index — see schema changes.

### D4 — Review flow: three explicit choices

**Decision**: Present "Apply now", "Apply at next cycle", "Keep current plan" (dismiss).

- **Apply now** → atomic transaction: active→ARCHIVED, pending→ACTIVE, `pending_ai_plan_id = null`. UI warns: "Your current progress resets to Workout A."
- **Apply at next cycle** → record deferred preference; auto-fires when the active mesocyclus completes its last session. Sends a notification on next app open: "Your AI-optimised plan is now active."
- **Keep current plan** → discard the pending mesocyclus (`status=DISCARDED`), clear `pending_ai_plan_id`.

**Pending plan lifecycle**: a DONE-but-unreviewed pending mesocyclus expires after 14 days. A nightly job checks and sets `status=DISCARDED` with `pending_ai_plan_id = null` on the parent. (14 days TBD in spec — to be confirmed before implementation.)

**Second-generation guard**: if a pending AI plan already exists (status=DONE, unreviewed), `POST /plans` returns 201 with `jobId: null` and a `pendingPlanReviewRequired: true` flag. The client surfaces "You have a plan ready to review" rather than queuing a new job.

### D5 — Worker creates pending mesocyclus in a transaction post-generate

**Decision**: After `provider.generate()` returns:
1. Validate output against a Zod schema (structure, workout count, exercise fields)
2. Inside `prisma.$transaction`:
   - Create `Mesocyclus` with `status=PENDING, planSource=AI_GENERATED`
   - Set `active.pending_ai_plan_id = pendingMeso.id`
   - Set `AiJob.status = DONE, completedAt = now()`
3. If validation fails: `AiJob.status = DEAD, completedAt = now()`, no mesocyclus created.

The `apply-now` endpoint also runs inside a transaction and verifies `pending_ai_plan_id` is still set and the target is still `PENDING` before executing the swap (idempotency guard).

## Risks / Trade-offs

- **Orphaned pending plans**: if the active mesocyclus is archived (user hits Regenerate while a pending plan is waiting), the pending plan becomes orphaned. Mitigation: `archiveActiveMesocyclus` must also discard any pending plan pointed to by `pending_ai_plan_id`.

- **2s polling × concurrent users**: at 100 concurrent users with active jobs, ~3,000 req/min to `/plans/active`. The endpoint includes a nested template+exercise join today. Mitigation: count `workoutSessions` via `_count` aggregate (fix pre-existing issue); keep AI job lookup a simple indexed `findFirst`.

- **`pg_notify` delivery gap**: notifications dropped during worker restart leave jobs PENDING indefinitely. Mitigation: `pollPendingJobs()` on worker start (already exists) + a periodic 30s sweep for PENDING jobs older than 60s.

- **TOCTOU on Apply now**: user double-taps review decision. Mitigation: transaction verifies preconditions before acting; second request hits the guard and returns a 409.

- **Worker cost limiting**: not implemented in this change. The worker will call `provider.generate()` without a budget check for BYOM providers. Acceptable at MVP — BYOM users accept the cost. Managed AI should not be enabled until the budget model is designed.

## Migration Plan

1. Add Prisma migration: `pending_ai_plan_id` (nullable FK), `completedAt` on `ai_job`, composite index on `ai_job(user_id, type, status)`, DB partial unique index on `ai_job(user_id, type) WHERE status IN ('PENDING','PROCESSING')`.
2. Deploy worker changes before route changes (worker is additive; new mesocyclus rows are hidden until the route exposes `aiJob` in responses).
3. Deploy route changes: `GET /plans/active` enrichment, `POST /plans` gate refactor, new review endpoints.
4. Rollback: disabling the worker (env var `AI_WORKER_ENABLED=false`) reverts to rule-engine-only behaviour without a schema rollback.

## Open Questions

- Pending plan expiry: 14 days proposed — confirm before tasks are written.
- First AI plan after onboarding: auto-apply (no active training to disrupt) or same review flow? Current proposal: same review flow for simplicity; revisit in UX spec.
- Worker cost limiting: needs a separate budget-model design before managed AI is enabled.
