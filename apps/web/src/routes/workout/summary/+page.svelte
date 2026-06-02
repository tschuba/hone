<script lang="ts">
import { goto } from "$app/navigation";
import { onMount, tick } from "svelte";

import { type ActiveWorkout, api } from "$lib/api";
import ErrorBoundary from "$lib/components/ErrorBoundary.svelte";
import { useWorkoutSession } from "$lib/context/workout-session.svelte.ts";
import {
  completeWorkoutWithOfflineFallback,
  getTodayWorkout,
} from "$lib/sync";

const workoutSession = useWorkoutSession();

let announcement = $state("Workout summary ready.");
let errorMessage = $state<string | null>(null);
let isBusy = $state(false);
let completionQueued = $state(false);
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
      completionQueued = true;
      announcement =
        "Workout completion queued. Reconnect to finish syncing this session.";
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

<main style="display: grid; gap: var(--space-4);">
  {#if errorMessage}
    <ErrorBoundary details={errorMessage} />
  {/if}

  {#if !workout}
    <section style="display: grid; gap: var(--space-4); padding: var(--space-6); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: rgba(255,255,255,0.03);">
      <h1 id="heading-summary" tabindex="-1" style="margin: 0;">Loading summary…</h1>
      <p style="margin: 0; color: var(--color-text-secondary);">
        Preparing your finished workout.
      </p>
    </section>
  {:else}
    <section style="display: grid; gap: var(--space-4); padding: var(--space-6); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: rgba(255,255,255,0.03);">
      <h1 id="heading-summary" tabindex="-1" style="margin: 0;">Workout summary</h1>
      <p style="margin: 0; color: var(--color-text-secondary);">
        All planned exercises for this active session are logged. Complete the session to advance your rotation.
      </p>
      <ul style="display: grid; gap: var(--space-3); margin: 0; padding: 0; list-style: none;">
        {#each workout.exercises as exercise}
          <li style="display: grid; gap: 0.25rem; padding: var(--space-3); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md); background: rgba(255,255,255,0.02);">
            <strong>{exercise.name}</strong>
            <span style="color: var(--color-text-secondary);">
              {exercise.completedSets} / {exercise.sets} sets completed
            </span>
          </li>
        {/each}
      </ul>
      <button
        type="button"
        onclick={handleCompleteWorkout}
        disabled={isBusy || completionQueued}
        style="width: fit-content; padding: 0.95rem 1.2rem; border: 0; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-accent-text); font-weight: 700; cursor: pointer;"
      >
        {completionQueued
          ? "Completion queued"
          : isBusy
            ? "Completing…"
            : "Finish workout"}
      </button>
    </section>
  {/if}
</main>
