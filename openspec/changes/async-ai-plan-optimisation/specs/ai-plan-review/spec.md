## ADDED Requirements

### Requirement: AI output lands in a pending mesocyclus
When the AI job completes successfully, the system SHALL create a new `Mesocyclus` row with `planSource=AI_GENERATED` and `status=PENDING`. The currently active mesocyclus SHALL have its `pending_ai_plan_id` set to the new pending mesocyclus ID. The active mesocyclus MUST NOT be mutated.

#### Scenario: Successful AI generation
- **WHEN** the AI job worker completes `provider.generate()` and output passes validation
- **THEN** a new `Mesocyclus` with `status=PENDING, planSource=AI_GENERATED` is created
- **THEN** the active mesocyclus's `pending_ai_plan_id` is updated to point at the new mesocyclus
- **THEN** `AiJob.status` is set to `DONE` and `completedAt` is set to the current timestamp

#### Scenario: AI generation output fails validation
- **WHEN** the AI job worker completes `provider.generate()` but output fails schema validation
- **THEN** no `Mesocyclus` row is created
- **THEN** `AiJob.status` is set to `DEAD` and `completedAt` is set to the current timestamp
- **THEN** the active mesocyclus is not modified

### Requirement: User reviews AI plan before application
The system SHALL present the user with three explicit choices when a pending AI plan is ready: "Apply now", "Apply at next cycle", and "Keep current plan". No choice SHALL be applied automatically without user action (except as covered by the deferred auto-fire requirement below).

#### Scenario: User applies AI plan immediately
- **WHEN** the user selects "Apply now"
- **THEN** the system executes an atomic transaction: active mesocyclus → `ARCHIVED`, pending mesocyclus → `ACTIVE`, `pending_ai_plan_id` cleared to null
- **THEN** the user's workout position resets to the first workout of the new plan (position 1)

#### Scenario: User defers AI plan to next cycle
- **WHEN** the user selects "Apply at next cycle"
- **THEN** the pending mesocyclus remains in `PENDING` status
- **THEN** a deferred-apply preference is recorded against the active mesocyclus

#### Scenario: User dismisses AI plan
- **WHEN** the user selects "Keep current plan"
- **THEN** the pending mesocyclus status is set to `DISCARDED`
- **THEN** `pending_ai_plan_id` on the active mesocyclus is cleared to null

#### Scenario: Apply now is idempotent
- **WHEN** the user submits "Apply now" twice (double-tap or retry)
- **THEN** the second request detects that `pending_ai_plan_id` is already null (cleared by first request)
- **THEN** the second request returns 409 without modifying any state

### Requirement: Deferred AI plan auto-fires at cycle completion
When the user has chosen "Apply at next cycle" and the active mesocyclus completes its final session, the system SHALL automatically apply the pending AI plan.

#### Scenario: Deferred plan fires on cycle end
- **WHEN** the active mesocyclus completes its last session and a deferred-apply preference is recorded
- **THEN** the system applies the pending plan atomically (same transaction as "Apply now")
- **THEN** on the user's next app open, a notification SHALL be shown: "Your AI-optimised plan is now active"

### Requirement: Pending plan expiry
A pending AI plan that has not been reviewed by the user SHALL be automatically discarded after 14 days. A nightly background job SHALL discard expired pending plans.

#### Scenario: Nightly expiry job runs
- **WHEN** the nightly job runs and finds a `Mesocyclus` with `status=PENDING, planSource=AI_GENERATED` older than 14 days
- **THEN** the pending mesocyclus status is set to `DISCARDED`
- **THEN** `pending_ai_plan_id` on the parent active mesocyclus is cleared to null

### Requirement: Pending plan is discarded when active plan is regenerated
If the user creates a new plan (regenerate) while a pending AI plan exists, the existing pending plan SHALL be discarded before the new rule-based plan is created.

#### Scenario: Regenerate while pending plan exists
- **WHEN** the user calls `POST /plans` and the current active mesocyclus has a non-null `pending_ai_plan_id`
- **THEN** the pending mesocyclus is set to `DISCARDED` and the FK is cleared before proceeding

### Requirement: New generation is blocked when an unreviewed AI plan is ready
If a DONE (unreviewed) pending AI plan already exists for the user, the system SHALL NOT queue a new AI job. The route SHALL return 201 with `{ jobId: null, pendingPlanReviewRequired: true }`.

#### Scenario: User attempts to queue AI job with pending plan ready
- **WHEN** `POST /plans` is called and a `Mesocyclus` with `status=PENDING` is already linked via `pending_ai_plan_id`
- **THEN** the rule-based plan is created normally
- **THEN** no new AI job is queued
- **THEN** the response includes `pendingPlanReviewRequired: true`
