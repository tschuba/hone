## 1. Schema & Migration

- [ ] 1.1 Add `pendingAiPlanId String? @map("pending_ai_plan_id")` self-referential FK on `Mesocyclus` with `onDelete: SetNull` in schema.prisma
- [ ] 1.2 Add `completedAt DateTime?` field to `AiJob` model in schema.prisma
- [ ] 1.3 Add composite index `@@index([userId, type, status])` to `AiJob` model
- [ ] 1.4 Run `prisma migrate dev` to generate the migration file; verify columns and indexes are correct
- [ ] 1.5 Add DB-level partial unique index on `ai_job(user_id, type) WHERE status IN ('PENDING', 'PROCESSING')` via raw SQL in the migration file
- [ ] 1.6 Add `resultMesocyclusId` FK to `AiGenerationLog` model pointing at the created pending mesocyclus
- [ ] 1.7 Regenerate Prisma client after schema changes

## 2. Rate Limiter Refactor

- [ ] 2.1 Remove the 60-minute `recentJob` check from `AiRateLimiter.check()` in `apps/api/src/services/ai-rate-limiter.service.ts`
- [ ] 2.2 Replace with concurrency gate: `findActiveJob()` returns early with `{ skip: true }` if PENDING/PROCESSING job exists
- [ ] 2.3 Add debounce gate: `findRecentCompletedJob({ since: completedAt >= now - 60s })` returns `{ skip: true, retryAfter }` if within window — anchor to `completedAt`, not `createdAt`
- [ ] 2.4 Fix daily limit window to use UTC midnight: replace `startOfDay.setHours(0,0,0,0)` with UTC equivalent
- [ ] 2.5 Make `check()` return a result object `{ skip: boolean, retryAfter?: Date, reason?: string }` instead of throwing, so callers can handle gracefully
- [ ] 2.6 Update `checkAndRecord()` to call the new `check()` and skip job creation (not throw) when gated
- [ ] 2.7 Exclude `FEEDBACK` type jobs from the daily cap count query
- [ ] 2.8 Update `AiJobStore` interface and `defaultStore` implementations to support `completedAt` in `findRecentJob`
- [ ] 2.9 Update all mock `aiRateLimiter` objects in `plan.routes.test.ts` and any other test files to match the new return-based interface

## 3. POST /plans Route Refactor

- [ ] 3.1 Move the `aiRateLimiter.check()` call to AFTER `createMesocyclus()` — plan creation must succeed first
- [ ] 3.2 Handle the `{ skip: true, retryAfter }` result from `check()`: skip `checkAndRecord()` and `notifier.notify()`, set `jobId: null` in response
- [ ] 3.3 Add `pendingPlanReviewRequired` gate: before queuing a new AI job, check if the newly created active mesocyclus's predecessor had an unreviewed pending plan — if so, return `{ jobId: null, pendingPlanReviewRequired: true }` (note: new plan archives old one, so check old active before archive)
- [ ] 3.4 Ensure `archiveActiveMesocyclus()` also discards any pending AI plan linked via `pending_ai_plan_id` (set pending meso to `DISCARDED`, clear FK)
- [ ] 3.5 Add `planSource` and `jobId` (nullable) and `retryAfter` (nullable) to the 201 response shape; export the updated response type

## 4. Worker — Create Pending Mesocyclus

- [ ] 4.1 Add a Zod schema to validate AI-generated plan output structure (workouts array, exercise fields, durationWeeks, workoutsPerWeek)
- [ ] 4.2 After `provider.generate()` succeeds, validate output against the Zod schema; on failure set `AiJob.status=DEAD, completedAt=now()` and return
- [ ] 4.3 On successful validation, run a `prisma.$transaction` that: (a) creates `Mesocyclus` with `status=PENDING, planSource=AI_GENERATED`, (b) updates active mesocyclus's `pendingAiPlanId`, (c) sets `AiJob.status=DONE, completedAt=now()`
- [ ] 4.4 Update `completeJob()` in the worker to accept and write `completedAt`
- [ ] 4.5 Update `createGenerationLog()` call to include `resultMesocyclusId` (the pending mesocyclus ID)
- [ ] 4.6 Add a periodic fallback poll: every 30 seconds, scan for PENDING jobs older than 60 seconds and re-queue them via `pg_notify` (guards against missed notifications on worker restart)

## 5. GET /plans/active Enrichment

- [ ] 5.1 Extend `ActivePlanResponse` type with `aiJob: { status: string; pendingMesocyclusId: string | null; retryAfter: string | null } | null`
- [ ] 5.2 In the `GET /plans/active` route handler, after fetching the active plan, perform an indexed `findFirst` on `ai_job` for the user with `status IN ('PENDING','PROCESSING')` — or the most recent terminal job — to populate `aiJob`
- [ ] 5.3 Include `retryAfter` in the `aiJob` field when the debounce gate is active (compute from last job's `completedAt + 60s`)
- [ ] 5.4 Fix `workoutSessions` count in `getActivePlan()` to use `_count` aggregate instead of fetching all session IDs (performance fix before polling adds load)
- [ ] 5.5 Update `defaultStorage.getActivePlan()` in `plan.routes.ts` to include the `aiJob` enrichment
- [ ] 5.6 Update `plan.routes.test.ts` `ActivePlanResponse` fixtures and `getActivePlan` mocks to include `aiJob` field

## 6. Plan Review Endpoints

- [ ] 6.1 Add `POST /plans/active/ai-plan/apply-now` route: atomically swap pending→active, old active→ARCHIVED, clear `pendingAiPlanId`; return 409 if preconditions not met (idempotency guard)
- [ ] 6.2 Add `POST /plans/active/ai-plan/defer` route: record deferred-apply preference on the active mesocyclus
- [ ] 6.3 Add `POST /plans/active/ai-plan/dismiss` route: set pending mesocyclus to `DISCARDED`, clear `pendingAiPlanId`
- [ ] 6.4 Add deferred auto-fire logic: when the last session of the active mesocyclus is completed and a deferred preference is recorded, run the apply-now transaction automatically
- [ ] 6.5 Add storage methods and route wiring for all three review endpoints; add to `PlanStorage` interface and `defaultStorage`

## 7. Pending Plan Expiry Job

- [ ] 7.1 Add a nightly cron/scheduled task that queries for `Mesocyclus` rows with `status=PENDING, planSource=AI_GENERATED, createdAt < now() - 14 days`
- [ ] 7.2 For each expired pending plan: set `status=DISCARDED`, clear `pendingAiPlanId` on the parent active mesocyclus

## 8. Tests

- [ ] 8.1 Add unit tests for the refactored `AiRateLimiter`: concurrency gate, debounce gate (with `completedAt` anchor), daily cap (UTC midnight boundary), feedback job exemption
- [ ] 8.2 Add route tests for `POST /plans`: AI gate skipped returns `jobId: null`, daily cap returns 429 with `retryAfter`, `pendingPlanReviewRequired` flag when unreviewed plan exists
- [ ] 8.3 Add route tests for `GET /plans/active`: `aiJob` enrichment for each status (PENDING, DONE, DEAD, null), `retryAfter` presence during debounce
- [ ] 8.4 Add route tests for review endpoints: apply-now idempotency (409 on double-call), dismiss sets DISCARDED, defer records preference
- [ ] 8.5 Add worker tests: output validation failure → DEAD job, successful output → pending mesocyclus created with correct fields, transaction atomicity
