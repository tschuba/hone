<script lang="ts">
import { goto } from "$app/navigation";
import { onMount, tick } from "svelte";

import { type ActiveWorkout, api } from "$lib/api";
import ErrorBoundary from "$lib/components/ErrorBoundary.svelte";
import ExerciseRow from "$lib/components/ExerciseRow.svelte";
import { useWorkoutSession } from "$lib/context/workout-session.svelte.ts";
import { setDashboardFlash } from "$lib/dashboard-flash";
import { completeWorkoutWithOfflineFallback, getTodayWorkout } from "$lib/sync";

const workoutSession = useWorkoutSession();

let announcement = $state("Workout summary ready.");
let errorMessage = $state<string | null>(null);
let isBusy = $state(false);
let workout = $state<Extract<
  ActiveWorkout,
  { status: "active_session" }
> | null>(null);

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "title" in error) {
    return typeof error.title === "string" ? error.title : fallback;
  }

  return fallback;
}

async function focusHeading() {
  await tick();
  document.getElementById("heading-summary")?.focus();
}

async function loadSummary() {
  errorMessage = null;

  try {
    const activeWorkout = await getTodayWorkout();

    if (activeWorkout.status !== "active_session") {
      workoutSession.reset();
      await goto("/");
      return;
    }

    const hasIncompleteExercise = activeWorkout.exercises.some(
      (exercise) => exercise.completedSets < exercise.sets,
    );

    if (hasIncompleteExercise) {
      await goto("/workout");
      return;
    }

    workout = activeWorkout;
    workoutSession.phase = "summary";
    announcement = "Training abgeschlossen. Gut gemacht!";
    await focusHeading();
  } catch (error) {
    errorMessage = getErrorMessage(error, "Unable to load workout summary.");
  }
}

onMount(() => {
  loadSummary().catch((error) => {
    console.error("Failed to load workout summary", error);
  });
});

async function handleCompleteWorkout() {
  if (!workout?.sessionId) {
    return;
  }

  isBusy = true;
  errorMessage = null;

  try {
    const result = await completeWorkoutWithOfflineFallback(workout.sessionId);

    if (result.status === "queued") {
      setDashboardFlash({
        kind: "success",
        message:
          "Workout completion queued. Reconnect to finish syncing this session.",
      });
      workoutSession.reset();
      await goto("/");
      return;
    }

    workoutSession.reset();
    await goto("/");
  } catch (error) {
    errorMessage = getErrorMessage(error, "Unable to complete workout.");
  } finally {
    isBusy = false;
  }
}
</script>

<div role="status" aria-live="assertive" aria-atomic="true" class="sr-only">
  {announcement}
</div>

<main style="padding: calc(var(--safe-top) + var(--space-4)) var(--space-4) calc(var(--safe-bottom) + var(--space-4)); display: grid; gap: var(--space-4);">
  {#if errorMessage}
    <ErrorBoundary details={errorMessage} />
  {/if}

  {#if !workout}
    <section style="width: min(100%, 52rem); margin: 0 auto; display: grid; gap: var(--space-4); padding: var(--space-6); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg); background: linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 100%);">
      <h1 id="heading-summary" tabindex="-1" style="margin: 0; font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em;">Loading summary…</h1>
      <p style="margin: 0; color: var(--color-text-secondary);">
        Preparing your finished workout.
      </p>
    </section>
  {:else}
    <section style="width: min(100%, 52rem); margin: 0 auto; display: grid; gap: var(--space-4); padding: var(--space-6); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg); background: linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 100%);">
      <!-- Header: task 5.1 -->
      <div style="text-align: center; padding-bottom: var(--space-4); border-bottom: 1px solid rgba(255,255,255,0.07);">
        <div style="font-size: 36px; margin-bottom: 8px;">🏆</div>
        <p style="margin: 0 0 6px; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">Workout Complete</p>
        <h1 id="heading-summary" tabindex="-1" style="margin: 0 0 4px; font-size: 22px; font-weight: var(--font-weight-display); letter-spacing: -0.5px; text-transform: uppercase;">
          {workout.templateTitle ?? `Workout ${workout.templateLabel}`}
        </h1>
        <!-- Session metadata: task 5.2 -->
        <p style="margin: 0; color: var(--color-text-muted); font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;">
          {new Intl.DateTimeFormat("en", { weekday: "long" }).format(new Date())} · Session
        </p>
      </div>

      <!-- Stats row: task 5.3 -->
      <div style="display: flex; background: rgba(255,255,255,0.03); border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); overflow: hidden;">
        <div style="flex: 1; padding: 14px 10px; text-align: center; border-right: 1px solid rgba(255,255,255,0.06);">
          <div style="color: var(--color-text-primary); font-size: 22px; font-weight: var(--font-weight-display); letter-spacing: -0.5px;">{workout.exercises.length}</div>
          <div style="color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px;">Exercises</div>
        </div>
        <div style="flex: 1; padding: 14px 10px; text-align: center; border-right: 1px solid rgba(255,255,255,0.06);">
          <div style="color: var(--color-text-primary); font-size: 22px; font-weight: var(--font-weight-display); letter-spacing: -0.5px;">
            {workout.exercises.reduce((sum, ex) => sum + ex.completedSets, 0)}
          </div>
          <div style="color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px;">Sets</div>
        </div>
        <div style="flex: 1; padding: 14px 10px; text-align: center;">
          <div style="color: var(--color-text-primary); font-size: 22px; font-weight: var(--font-weight-display); letter-spacing: -0.5px;">
            {workout.exercises.reduce((sum, ex) => sum + ex.completedSets, 0) * workout.exercises.length}
          </div>
          <div style="color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 2px;">Volume</div>
        </div>
      </div>

      <!-- Exercise list: tasks 5.4 + 5.5 -->
      <div>
        <p style="margin: 0 0 10px; color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">Exercises</p>
        <div style="display: grid; gap: 6px;">
          {#each workout.exercises as exercise}
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <div style="flex: 1; min-width: 0;">
                <ExerciseRow
                  name={exercise.name}
                  sets={exercise.completedSets}
                  reps={exercise.reps ?? 0}
                  weight="Bodyweight"
                  icon="💪"
                  done={true}
                />
              </div>
              <span style="color: var(--color-success); font-size: 14px; flex-shrink: 0;">✓</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- CTA: task 5.6 -->
      <button
        type="button"
        onclick={handleCompleteWorkout}
        disabled={isBusy}
        style="width: 100%; padding: 14px; border: 0; border-radius: var(--radius-lg); background: linear-gradient(135deg, #fcd34d, #f59e0b); color: #111; font-weight: var(--font-weight-display); font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 20px rgba(252,211,77,0.25);"
      >
        {isBusy ? "Completing…" : "Back to Dashboard →"}
      </button>
    </section>
  {/if}
</main>
