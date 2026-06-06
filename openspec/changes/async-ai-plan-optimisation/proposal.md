## Why

The rule engine produces a valid plan instantly, but it cannot reason about a user's history, progression, or goals the way a language model can. Users have no way to benefit from AI-driven plan improvements today because the AI job is a no-op (`UnconfiguredAiProvider`) and the system has no model for delivering the result without disrupting the user's active plan.

## What Changes

- AI job worker produces a NEW pending mesocyclus rather than writing in-place, protecting the active rule-based plan
- Active mesocyclus gains a `pending_ai_plan_id` self-referential FK pointing at the pending AI plan when one is ready
- Users review the AI plan before it takes effect, with three explicit choices: apply now, apply at next cycle, or keep current plan
- `GET /plans/active` is enriched with AI job status and `retryAfter` so the plan screen can show live optimisation state
- The 60-minute AI cooldown is replaced with a concurrency gate + short debounce + daily cap, and plan creation always succeeds regardless of AI gate outcome
- Rate limiting gains a BYOM vs managed-AI split: managed limits are admin-defined; BYOM limits are user-configurable

## Capabilities

### New Capabilities

- `ai-plan-review`: The pending mesocyclus model — AI output lands in a PENDING plan, user reviews and chooses apply/defer/dismiss. Covers lifecycle, expiry, and the "Apply at next cycle" auto-fire with notification.
- `ai-job-rate-limiting`: Three-gate route-level rate limiting (concurrency, debounce, daily cap) replacing the 60-minute cooldown, plus worker-level cost limiting. Covers BYOM vs managed-AI limit configuration and transparent 429 responses.
- `plan-ai-status`: The `GET /plans/active` enrichment contract — job status, `pendingMesocyclusId`, and `retryAfter` field; UI polling behaviour and transparency states.

### Modified Capabilities

(none — no existing specs have requirement changes)

## Impact

- **Schema**: `mesocyclus` — add `pending_ai_plan_id` (nullable self-referential FK, `ON DELETE SET NULL`); `ai_job` — add `completedAt`, composite index `(user_id, type, status)`
- **API**: `POST /plans` — no longer throws on AI gate; returns `jobId: null` when gate skips. `GET /plans/active` — new fields `aiJob`, `retryAfter`. New endpoint `POST /plans/active/ai-plan/:action` for review decisions.
- **Worker**: `ai-job-worker` — post-generate step creates pending mesocyclus in a transaction, validates output, updates `pending_ai_plan_id` on the active plan
- **Rate limiter**: `AiRateLimiter` refactored — 60-min cooldown removed, TOCTOU-safe with DB partial unique index, `completedAt`-anchored debounce
