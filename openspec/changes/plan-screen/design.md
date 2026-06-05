# Design

The rule engine generates a mesocyclus of N cycles, each consisting of 3 sessions (templates A, B, C). The workouts do not change between cycles — the same 3 session templates repeat for the full duration. "Weeks" is a misleading concept here because the engine is session-based: a 4-cycle plan takes as long as the user takes to complete 12 sessions, regardless of calendar time.

The design uses "cycle" and "session" exclusively. A cycle is one full A→B→C rotation. A session is a single workout. A mesocyclus is a named collection of N cycles using a fixed set of session templates.

## Goals / Non-Goals

**Goals:**

- Show the full mesocyclus structure before the user starts training.
- Show cycle-by-cycle progress (which sessions are done, which is next).
- Allow the user to configure and regenerate a mesocyclus at any time.
- Pass equipment pool and session duration to the rule engine from the UI.

**Non-Goals:**

- Manual session editing (add/remove/swap exercises).
- Per-cycle exercise variation or progressive overload — the rule engine does not support this yet.
- Multi-mesocyclus history view.

## Decisions

### 1. Dedicated `/plan` route, not a dashboard section

The plan screen is a distinct concern from "today's workout." Keeping it separate avoids cluttering the dashboard and gives the plan its own scrollable surface. The dashboard gets a "View plan" link added to the header area.

### 2. Cycle progress shown as a dot grid, not a week calendar

Each row is one cycle (A→B→C). Filled gold dot = completed. Outlined gold dot with indicator = up next. Faint dot = not yet reached. This makes progress legible at a glance without implying calendar dates.

### 3. Session templates show exercises and sets directly — no category label

"Push", "Pull & Conditioning", "Back & Core" are not shown. The exercise list itself (Pull-up · 3×8, Bird Dog · 3×10 …) is more informative than a label derived from muscle-group buckets. The "UP NEXT" badge identifies the upcoming session within the current cycle.

### 4. Sticky action bar for regenerate controls

Equipment pool, cycle count, and session duration selectors sit in a fixed bottom bar. The session template list scrolls freely above. This ensures the regenerate action is always reachable without scrolling, on any screen height.

### 5. "Regenerate →" button

The CTA is "Regenerate →". It archives the current mesocyclus and creates a new one using the selected parameters. A subtext line below the button reads "Archives current · session history kept" to set expectations.

### 6. Archiving on regenerate

The POST `/plans` handler will check for an existing ACTIVE mesocyclus and set its status to ARCHIVED before creating the new one. This prevents orphaned active plans and matches the expected behavior when the user hits "Regenerate" mid-cycle.

### 7. `cycleCount` replaces `weeksCount`

The POST body and API client use `cycleCount`. The rule engine receives it as `weeksCount` internally — the engine value is unchanged, only the API surface and UI rename it. This avoids leaking implementation terminology into the user-facing contract.

## API Design

### GET /api/v1/plans/active

Returns the active mesocyclus with all workout templates and exercises.

```typescript
{
  mesocyclusId: string;
  name: string;               // equipment pool name or fallback label
  cycleCount: number;         // total planned cycles
  sessionsPerCycle: number;   // always 3 for current rule engine
  totalSessions: number;      // cycleCount × sessionsPerCycle
  completedSessions: number;  // count of COMPLETED WorkoutSessions for this mesocyclus
  equipmentPoolId: string | null;
  sessionMinutes: number;
  sessions: Array<{
    position: number;         // 1, 2, 3 within a cycle
    isNext: boolean;          // true for the session that follows the last completed one
    exercises: Array<{
      name: string;
      sets: number;
      reps: number | null;
      durationSecs: number | null;
    }>;
  }>;
}
```

Returns 404 when no active mesocyclus exists.

### POST /api/v1/plans (updated)

Accepts `cycleCount` instead of `weeksCount`. Before creating the new mesocyclus, sets any existing ACTIVE mesocyclus to ARCHIVED.

```typescript
// Request body
{
  equipmentPoolId?: string;
  cycleCount?: number;        // default 4
  sessionMinutes?: number;    // default 30
}
```

## Mockup

See [mockups/plan-screen.html](mockups/plan-screen.html) for the approved visual design. Open the file in a browser to interact with it.

## UI Structure

```text
/plan
├── Nav bar (fixed top)         ← Dashboard link
├── Scrollable body
│   ├── Header                  mesocyclus name + cycle/session count
│   ├── Cycle progress grid     dot matrix, completed/next/upcoming
│   └── Sessions per cycle      session cards with exercise + sets list, UP NEXT badge
└── Sticky action bar (fixed bottom)
    ├── Equipment pool selector  ← populated from user's equipment pools
    ├── Cycles selector          ← 2 / 3 / 4 / 6 options
    ├── Session duration          ← 30 / 45 / 60 / 90 min options
    ├── "Regenerate →" button
    └── "Archives current · session history kept" note
```

### Empty state (no active mesocyclus)

The scrollable body shows a short prompt. The sticky bar shows the same controls with "Generate →" instead of "Regenerate →".

## Risks / Trade-offs

- [Archiving mid-cycle erases progress context] → Mitigated by the note under the button and by keeping session history in `WorkoutSession` records.
- [Equipment pool selector requires pools to exist] → If the user has no pools, the selector shows "No equipment set" and falls back to the full exercise pool, same as today. Onboarding prompt shown.
- [`isNext` logic must match the dashboard "today" logic] → Both should use the same query: find the next uncompleted template in rotation order from the last completed session. Share or co-locate that logic to avoid drift.

## Open Questions

- Should the cycle count selector be a dropdown or a stepper (−/+)? A small fixed set (2/3/4/6) as a dropdown feels sufficient for MVP.
- Should session duration be stored on the mesocyclus record for display, or derived from the template exercises? Store it — the current schema has no `sessionMinutes` on `Mesocyclus`, so a migration is needed or we store it only client-side from the generation response.
