## ADDED Requirements

### Requirement: GET /plans/active includes AI job status and pending plan information
The `GET /plans/active` response SHALL include an `aiJob` field that reflects the current AI optimisation state for the active mesocyclus.

#### Scenario: No AI job in flight
- **WHEN** `GET /plans/active` is called and no AI job is active or pending for the user
- **THEN** the response includes `aiJob: null`

#### Scenario: AI job is in progress
- **WHEN** `GET /plans/active` is called and an AI job with `status=PENDING` or `PROCESSING` exists
- **THEN** the response includes `aiJob: { status: 'PENDING' | 'PROCESSING', pendingMesocyclusId: null, retryAfter: null }`

#### Scenario: AI plan is ready for review
- **WHEN** `GET /plans/active` is called and the active mesocyclus has a non-null `pending_ai_plan_id` pointing to a DONE pending mesocyclus
- **THEN** the response includes `aiJob: { status: 'DONE', pendingMesocyclusId: '<id>', retryAfter: null }`

#### Scenario: AI job has failed
- **WHEN** `GET /plans/active` is called and the most recent AI job is `DEAD` or `FAILED`
- **THEN** the response includes `aiJob: { status: 'DEAD', pendingMesocyclusId: null, retryAfter: null }`

### Requirement: GET /plans/active includes retryAfter when debounce gate is active
When the debounce gate is active for the user, `GET /plans/active` SHALL include a `retryAfter` ISO timestamp in the `aiJob` field so the client can display a countdown.

#### Scenario: Debounce active after recent job completion
- **WHEN** `GET /plans/active` is called within the 60-second debounce window after a job's `completedAt`
- **THEN** the response includes `aiJob.retryAfter: <ISO timestamp of when the debounce window ends>`

### Requirement: Plan screen displays AI optimisation state
The plan screen SHALL render a state indicator based on the `aiJob` field in the `GET /plans/active` response.

#### Scenario: AI is optimising
- **WHEN** `aiJob.status` is `PENDING` or `PROCESSING`
- **THEN** the plan screen shows "AI is optimising… (this usually takes a few minutes)"

#### Scenario: AI plan is ready for review
- **WHEN** `aiJob.status` is `DONE` and `pendingMesocyclusId` is present
- **THEN** the plan screen shows "AI plan ready — review" with an action to open the review flow

#### Scenario: AI coaching unavailable
- **WHEN** `aiJob.status` is `DEAD` or `aiJob` is null and AI has previously failed
- **THEN** the plan screen shows "Your plan was created automatically" (inline, low-emphasis)

### Requirement: Plan screen polls while AI job is active and stops on terminal state
The plan screen SHALL poll `GET /plans/active` approximately every 2 seconds when `aiJob.status` is `PENDING` or `PROCESSING`. Polling SHALL stop when `aiJob.status` reaches a terminal state (`DONE`, `DEAD`, `FAILED`). The poll response that returns a terminal state SHALL trigger an immediate UI re-render.

#### Scenario: Polling starts on active job
- **WHEN** the plan screen loads and `aiJob.status` is `PENDING` or `PROCESSING`
- **THEN** the client begins polling `GET /plans/active` every ~2 seconds

#### Scenario: Polling stops on terminal state
- **WHEN** a poll response returns `aiJob.status` of `DONE`, `DEAD`, or `FAILED`
- **THEN** polling stops immediately
- **THEN** the UI re-renders to reflect the new state without requiring a manual refresh

### Requirement: Regenerate button shows countdown during debounce
When `aiJob.retryAfter` is present, the Regenerate button SHALL be disabled and SHALL display a countdown to when the debounce window ends.

#### Scenario: Countdown is displayed
- **WHEN** `aiJob.retryAfter` is a future ISO timestamp
- **THEN** the Regenerate button is disabled
- **THEN** the button shows a countdown: "New generation available in Xs"
- **THEN** when the countdown reaches zero, the button is re-enabled without requiring a page reload

### Requirement: Feedback cooldown message uses neutral copy
When a feedback submission is rate-limited, the message shown to the user SHALL be: "Processing complete — you can send more feedback shortly." The copy SHALL NOT imply the user did something that needs to cool down.

#### Scenario: Feedback debounce message
- **WHEN** a feedback submission is blocked by the debounce gate
- **THEN** the UI shows "Processing complete — you can send more feedback shortly"
