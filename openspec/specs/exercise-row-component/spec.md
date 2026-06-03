## ADDED Requirements

### Requirement: ExerciseRow component API

A reusable `ExerciseRow.svelte` component SHALL exist at `apps/web/src/lib/components/ExerciseRow.svelte` and accept the following props:

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | `string` | yes | — | Exercise name, rendered uppercase via CSS |
| `sets` | `number` | yes | — | Number of sets |
| `reps` | `number` | yes | — | Number of reps per set |
| `weight` | `string` | yes | — | Weight string, e.g. `"80 kg"` or `"Bodyweight"` |
| `icon` | `string` | yes | — | Emoji to render in the icon badge |
| `active` | `boolean` | no | `false` | When `true`, renders in the active (gold) visual state |

#### Scenario: Renders with required props
- **WHEN** `<ExerciseRow name="Bench Press" sets={4} reps={8} weight="80 kg" icon="🏋️" />` is mounted
- **THEN** the component SHALL render the exercise name, icon badge, and a data line reading `4 Sets · 8 Reps · 80 kg`

---

### Requirement: Data line format

The component SHALL render a data line below the exercise name in the format:
`{sets} Sets · {reps} Reps · {weight}`

The data line SHALL use `text-transform: uppercase`, `font-weight: 600`, `letter-spacing: var(--letter-spacing-caps)`, and a font size of 11px.

#### Scenario: Data line content
- **WHEN** the component renders with `sets={3}`, `reps={10}`, `weight="55 kg"`
- **THEN** the data line SHALL read `3 Sets · 10 Reps · 55 kg`

#### Scenario: Bodyweight exercise
- **WHEN** the component renders with `weight="Bodyweight"`
- **THEN** the data line SHALL read `{sets} Sets · {reps} Reps · Bodyweight`

---

### Requirement: Icon badge

The component SHALL render the `icon` prop inside a fixed 34×34px rounded square badge.

In the active state the badge SHALL use `background: rgba(252, 211, 77, 0.15)` with a `1px solid rgba(252, 211, 77, 0.2)` border.
In the default state the badge SHALL use `background: rgba(255, 255, 255, 0.06)` with no border.

#### Scenario: Icon badge active state
- **WHEN** `active={true}`
- **THEN** the icon badge SHALL render with a gold-tinted background

#### Scenario: Icon badge default state
- **WHEN** `active={false}` (or omitted)
- **THEN** the icon badge SHALL render with a neutral semi-transparent background

---

### Requirement: Active visual state

When `active={true}`, the row SHALL render with:
- `border-left: 3px solid var(--color-accent)`
- `background: rgba(252, 211, 77, 0.07)`
- `border-radius: 0 8px 8px 0`
- Exercise name color: `var(--color-text-primary)`
- Data line color: `var(--color-accent)`

#### Scenario: Active row gold border
- **WHEN** `active={true}`
- **THEN** the row SHALL have a 3px gold left border and a faint gold background tint

---

### Requirement: Default visual state

When `active={false}` (or the prop is omitted), the row SHALL render with:
- `border-left: 3px solid rgba(255, 255, 255, 0.08)`
- `background: rgba(255, 255, 255, 0.03)`
- `border-radius: 0 8px 8px 0`
- Exercise name color: `var(--color-text-secondary)`
- Data line color: `var(--color-text-muted)`

#### Scenario: Default row muted border
- **WHEN** `active={false}`
- **THEN** the row SHALL have a dim semi-transparent left border and near-transparent background

---

### Requirement: Long name overflow handling

Exercise names that exceed the available width SHALL be truncated with an ellipsis to prevent layout overflow.

#### Scenario: Long exercise name
- **WHEN** the exercise name exceeds the row width
- **THEN** the name SHALL be clipped with `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
