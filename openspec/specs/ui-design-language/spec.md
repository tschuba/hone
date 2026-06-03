## ADDED Requirements

### Requirement: Design tokens

The app SHALL define two new CSS custom properties in `app.css` alongside the existing token set:
- `--font-weight-display: 800` — used for all display-weight text (titles, exercise names, CTAs)
- `--letter-spacing-caps: 0.08em` — used for all uppercase label text

#### Scenario: Tokens available globally
- **WHEN** any page component renders
- **THEN** `var(--font-weight-display)` and `var(--letter-spacing-caps)` SHALL resolve to their defined values

---

### Requirement: Display typography for titles and headings

Screen titles and workout names SHALL use `font-weight: var(--font-weight-display)`, `text-transform: uppercase`, and `letter-spacing: -0.03em`.

#### Scenario: Workout title on dashboard
- **WHEN** the dashboard renders a workout plan name
- **THEN** the title SHALL appear in uppercase with font-weight 800 and tight letter-spacing

#### Scenario: Current exercise name in active workout
- **WHEN** the active workout screen shows the current exercise
- **THEN** the exercise heading SHALL appear in uppercase with font-weight 800

---

### Requirement: Uppercase label style for metadata and data rows

All small metadata labels (session type, duration, sets/reps/weight data, section headers) SHALL use `text-transform: uppercase`, `font-weight: 600–700`, `letter-spacing: var(--letter-spacing-caps)`, and a font size of 10–11px.

Active item data labels (sets/reps/weight on the highlighted exercise row) SHALL use `--color-accent` (gold). Inactive item data labels SHALL use `--color-text-muted`.

#### Scenario: Active exercise data label color
- **WHEN** an exercise row is in the active state
- **THEN** the sets/reps/weight line SHALL render in `--color-accent`

#### Scenario: Inactive exercise data label color
- **WHEN** an exercise row is in the default (inactive) state
- **THEN** the sets/reps/weight line SHALL render in `--color-text-muted`

---

### Requirement: Gold gradient CTA buttons

All primary call-to-action buttons SHALL use:
- `background: linear-gradient(135deg, #fcd34d, #f59e0b)`
- `color: #111`
- `box-shadow: 0 4px 20px rgba(252, 211, 77, 0.25)`
- `font-weight: var(--font-weight-display)`
- `text-transform: uppercase`
- `letter-spacing: 0.12em`
- `border-radius: var(--radius-lg)`

#### Scenario: Start Workout button
- **WHEN** the dashboard renders the start workout CTA
- **THEN** the button SHALL display with the gold gradient background, uppercase label, and drop shadow

#### Scenario: Log Set button
- **WHEN** the active workout screen renders the log set CTA
- **THEN** the button SHALL display with the gold gradient background

---

### Requirement: Card and screen container depth

All screen cards and workout containers SHALL use a subtle dark gradient background and a faint border:
- `background: linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 100%)`
- `border: 1px solid rgba(255, 255, 255, 0.07)`

#### Scenario: Dashboard card appearance
- **WHEN** the dashboard workout card renders
- **THEN** the card SHALL show a gradient background from near-black to navy with a faint white border

---

### Requirement: Exercise row visual states

Exercise rows SHALL support two visual states — active and default — using a left-border highlight pattern.

**Active state:**
- `border-left: 3px solid var(--color-accent)`
- `background: rgba(252, 211, 77, 0.07)`
- `border-radius: 0 8px 8px 0`
- Icon badge: `background: rgba(252, 211, 77, 0.15)`, `border: 1px solid rgba(252, 211, 77, 0.2)`
- Exercise name: `--color-text-primary`

**Default state:**
- `border-left: 3px solid rgba(255, 255, 255, 0.08)`
- `background: rgba(255, 255, 255, 0.03)`
- `border-radius: 0 8px 8px 0`
- Icon badge: `background: rgba(255, 255, 255, 0.06)`
- Exercise name: `--color-text-secondary`

#### Scenario: First exercise highlighted on dashboard
- **WHEN** the dashboard renders today's workout plan
- **THEN** the first exercise row SHALL render in the active state (gold border + tint)
- **THEN** all subsequent exercise rows SHALL render in the default state

#### Scenario: Current exercise highlighted in active workout
- **WHEN** the workout is in progress
- **THEN** the current exercise row SHALL render in the active state
