<script lang="ts">
import { goto } from "$app/navigation";
import { onMount, tick } from "svelte";

import {
  type ActiveWorkout,
  type ExerciseSubstitutionCandidate,
  api,
} from "$lib/api";
import ErrorBoundary from "$lib/components/ErrorBoundary.svelte";
import { useTimerState } from "$lib/context/timer-state.svelte.ts";
import { useWorkoutSession } from "$lib/context/workout-session.svelte.ts";
import { offlineStore } from "$lib/db/offline-store";
import { DeviceServices } from "$lib/services/device-services";
import {
  completeWorkoutWithOfflineFallback,
  getTodayWorkout,
  isOfflineError,
  logSetWithOfflineFallback,
} from "$lib/sync";

const timerState = useTimerState();
const workoutSession = useWorkoutSession();
const deviceServices = new DeviceServices(
  () => todayWorkout !== null && workoutSession.phase === "exercise",
);

let announcement = $state("Workout screen ready.");
let currentIndex = $state(0);
let errorMessage = $state<string | null>(null);
let isBusy = $state(false);
let isLoadingSubstitutions = $state(false);
let isSubstituting = $state(false);
let restInterval: ReturnType<typeof setInterval> | null = null;
let restDeadlineMs = $state<number | null>(null);
let restSecondsRemaining = $state(0);
let showSubstitutions = $state(false);
let substitutions = $state<ExerciseSubstitutionCandidate[]>([]);
let todayWorkout = $state<Extract<
  ActiveWorkout,
  { status: "active_session" }
> | null>(null);

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "title" in error) {
    return typeof error.title === "string" ? error.title : fallback;
  }

  return fallback;
}

function clearRestInterval() {
  if (restInterval) {
    clearInterval(restInterval);
    restInterval = null;
  }

  restDeadlineMs = null;
}

async function focusHeading() {
  await tick();
  const heading = document.getElementById(`heading-${workoutSession.phase}`);
  heading?.focus();
}

const currentExercise = $derived(todayWorkout?.exercises[currentIndex] ?? null);
const currentSetNumber = $derived((currentExercise?.completedSets ?? 0) + 1);

function syncRestTimer() {
  if (!restDeadlineMs) {
    return;
  }

  const remainingMs = Math.max(restDeadlineMs - Date.now(), 0);
  timerState.elapsedMs = timerState.totalMs - remainingMs;
  restSecondsRemaining = Math.ceil(remainingMs / 1000);

  if (remainingMs === 0) {
    clearRestInterval();
    void moveToNextExercise();
  }
}

async function moveToNextExercise() {
  clearRestInterval();
  currentIndex += 1;
  substitutions = [];
  showSubstitutions = false;

  if (!todayWorkout || currentIndex >= todayWorkout.exercises.length) {
    workoutSession.phase = "summary";
    announcement = "Training abgeschlossen. Gut gemacht!";
    await goto("/workout/summary");
  } else {
    workoutSession.phase = "exercise";
    workoutSession.currentExerciseIndex = currentIndex;
    announcement = `Exercise ${todayWorkout.exercises[currentIndex]?.name ?? ""}. Set ${todayWorkout.exercises[currentIndex]?.completedSets ?? 0 + 1} of ${todayWorkout.exercises[currentIndex]?.sets ?? 0}.`;
  }

  await focusHeading();
}

async function loadWorkout() {
  errorMessage = null;

  try {
    const workout = await getTodayWorkout();

    if (workout.status !== "active_session") {
      workoutSession.reset();
      await goto("/");
      return;
    }

    todayWorkout = workout;
    substitutions = [];
    showSubstitutions = false;
    currentIndex = workout.exercises.findIndex(
      (exercise) => exercise.completedSets < exercise.sets,
    );

    if (currentIndex === -1) {
      currentIndex = Math.max(workout.exercises.length - 1, 0);
      workoutSession.phase = "summary";
      announcement = "Training abgeschlossen. Gut gemacht!";
      await goto("/workout/summary");
      return;
    }

    workoutSession.start(workout.exercises.length);
    workoutSession.currentExerciseIndex = currentIndex;
    announcement = `Exercise ${workout.exercises[currentIndex]?.name ?? ""}. Set ${(workout.exercises[currentIndex]?.completedSets ?? 0) + 1} of ${workout.exercises[currentIndex]?.sets ?? 0}.`;
    await focusHeading();
  } catch (error) {
    errorMessage = getErrorMessage(error, "Unable to load workout.");
  }
}

onMount(() => {
  loadWorkout().catch((error) => {
    console.error("Failed to load workout page", error);
  });

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      syncRestTimer();
    }
  };
  const handlePageShow = (event: PageTransitionEvent) => {
    if (event.persisted) {
      syncRestTimer();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pageshow", handlePageShow);

  return () => {
    clearRestInterval();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pageshow", handlePageShow);
    void deviceServices.releaseWakeLock();
  };
});

$effect(() => {
  if (
    todayWorkout &&
    (workoutSession.phase === "exercise" || workoutSession.phase === "rest")
  ) {
    void deviceServices.requestWakeLock();
  } else {
    void deviceServices.releaseWakeLock();
  }
});

async function handleSetDone() {
  if (!todayWorkout?.sessionId || !currentExercise?.exerciseLogId) {
    return;
  }

  isBusy = true;
  errorMessage = null;

  try {
    const result = await logSetWithOfflineFallback(todayWorkout.sessionId, {
      exerciseLogId: currentExercise.exerciseLogId,
      reps: currentExercise.reps ?? undefined,
      setNr: currentSetNumber,
      uuid: crypto.randomUUID(),
    });

    currentExercise.completedSets += 1;

    if (currentExercise.completedSets >= currentExercise.sets) {
      if (currentIndex >= todayWorkout.exercises.length - 1) {
        workoutSession.phase = "summary";
        announcement = "Training abgeschlossen. Gut gemacht!";
        await goto("/workout/summary");
      } else {
        workoutSession.phase = "rest";
        timerState.configure(currentExercise.restSecs * 1000);
        clearRestInterval();
        restDeadlineMs = Date.now() + currentExercise.restSecs * 1000;
        restSecondsRemaining = currentExercise.restSecs;
        announcement = `Rest. ${restSecondsRemaining} seconds.`;
        restInterval = setInterval(() => {
          syncRestTimer();
        }, 250);
        syncRestTimer();
      }
    } else {
      announcement =
        result.status === "queued"
          ? `Set saved offline. It will sync when you're back online.`
          : `Exercise ${currentExercise.name}. Set ${currentSetNumber + 1} of ${currentExercise.sets}.`;
    }

    await focusHeading();
  } catch (error) {
    errorMessage = getErrorMessage(error, "Unable to log set.");
  } finally {
    isBusy = false;
  }
}

async function handleCompleteWorkout() {
  if (!todayWorkout?.sessionId) {
    return;
  }

  isBusy = true;
  errorMessage = null;

  try {
    const result = await completeWorkoutWithOfflineFallback(
      todayWorkout.sessionId,
    );

    if (result.status === "queued") {
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

async function handleToggleSubstitutions() {
  if (!todayWorkout?.sessionId || !currentExercise?.exerciseLogId) {
    return;
  }

  if (showSubstitutions) {
    showSubstitutions = false;
    return;
  }

  isLoadingSubstitutions = true;
  errorMessage = null;

  try {
    const response = await api.listExerciseSubstitutions(
      todayWorkout.sessionId,
      currentExercise.exerciseLogId,
    );
    substitutions = response.items;
    showSubstitutions = true;
  } catch (error) {
    errorMessage = getErrorMessage(error, "Unable to load substitutions.");
  } finally {
    isLoadingSubstitutions = false;
  }
}

async function handleAbandonWorkout() {
  if (!window.confirm("Abandon this workout? Any unsynced sets will be discarded.")) {
    return;
  }

  await offlineStore.resetCurrentUserWorkoutState();
  workoutSession.reset();
  await goto("/");
}

async function handleSubstituteExercise(exerciseId: string) {
  if (!todayWorkout?.sessionId || !currentExercise?.exerciseLogId) {
    return;
  }

  isSubstituting = true;
  errorMessage = null;

  try {
    const replacement = await api.substituteExercise(
      todayWorkout.sessionId,
      currentExercise.exerciseLogId,
      exerciseId,
    );
    announcement = `Exercise changed to ${replacement.name}.`;
    await loadWorkout();
  } catch (error) {
    if (isOfflineError(error)) {
      errorMessage =
        "Exercise substitutions are unavailable offline. Reconnect to change this exercise.";
      return;
    }

    errorMessage = getErrorMessage(error, "Unable to substitute exercise.");
  } finally {
    isSubstituting = false;
  }
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
</script>

<div role="status" aria-live="assertive" aria-atomic="true" class="sr-only">
  {announcement}
</div>

<main style="display: grid; gap: var(--space-4);">
  {#if errorMessage}
    <ErrorBoundary details={errorMessage} />
  {/if}

  {#if !todayWorkout}
    <section style="padding: var(--space-6); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: rgba(255,255,255,0.03);">
      <h1 id="heading-idle" tabindex="-1" style="margin: 0 0 var(--space-2);">Loading workout…</h1>
      <p style="margin: 0; color: var(--color-text-secondary);">Preparing your active session.</p>
    </section>
  {:else if workoutSession.phase === "exercise" && currentExercise}
    <section style="display: grid; gap: var(--space-4); padding: var(--space-6); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: rgba(255,255,255,0.03);">
      <h1 id="heading-exercise" tabindex="-1" style="margin: 0;">{currentExercise.name}</h1>
      {#if currentExercise.imageUrl}
        <img
          src={currentExercise.imageUrl}
          alt={currentExercise.imageAltText}
          style="width: 100%; max-width: 28rem; border-radius: var(--radius-lg); border: 1px solid rgba(255,255,255,0.08);"
        />
      {/if}
      <p style="margin: 0; color: var(--color-text-secondary);">
        Set {currentSetNumber} of {currentExercise.sets}{#if currentExercise.reps} · {currentExercise.reps} reps{/if}{#if currentExercise.durationSecs} · {currentExercise.durationSecs}s{/if}
      </p>
      <p style="margin: 0; color: var(--color-text-secondary);">Rest after this exercise: {currentExercise.restSecs}s</p>
      {#if currentExercise.substitutedForName}
        <p style="margin: 0; color: var(--color-text-muted);">
          Substituted for {currentExercise.substitutedForName}
        </p>
      {/if}
      <div style="display: flex; flex-wrap: wrap; gap: var(--space-3);">
        <button
          type="button"
          onclick={handleSetDone}
          disabled={isBusy}
          style="padding: 0.95rem 1.2rem; border: 0; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-accent-text); font-weight: 700; cursor: pointer;"
        >
          {isBusy ? "Saving…" : "Set completed"}
        </button>
        <button
          type="button"
          onclick={handleToggleSubstitutions}
          disabled={isLoadingSubstitutions || isSubstituting}
          style="padding: 0.95rem 1.2rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: transparent; color: inherit; font-weight: 700; cursor: pointer;"
        >
          {isLoadingSubstitutions
            ? "Loading…"
            : showSubstitutions
              ? "Hide alternatives"
              : "Swap exercise"}
        </button>
        <button
          type="button"
          onclick={handleAbandonWorkout}
          disabled={isBusy}
          style="padding: 0.95rem 1.2rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: transparent; color: var(--color-text-secondary); font-weight: 700; cursor: pointer;"
        >
          Abandon workout
        </button>
      </div>

      {#if showSubstitutions}
        <section style="display: grid; gap: var(--space-3); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);">
          <h2 style="margin: 0; font-size: 1rem;">Suggested alternatives</h2>
          {#if substitutions.length === 0}
            <p style="margin: 0; color: var(--color-text-secondary);">
              No close alternatives are available for this exercise.
            </p>
          {:else}
            <ul style="display: grid; gap: var(--space-3); margin: 0; padding: 0; list-style: none;">
              {#each substitutions as substitution}
                <li style="display: grid; gap: var(--space-2); padding: var(--space-3); border-radius: var(--radius-md); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                  <div style="display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; justify-content: space-between;">
                    <div style="display: grid; gap: 0.2rem;">
                      <strong>{substitution.name}</strong>
                      <span style="color: var(--color-text-muted); font-size: 0.95rem;">
                        {substitution.tags.join(" · ")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onclick={() => handleSubstituteExercise(substitution.id)}
                      disabled={isSubstituting}
                      style="padding: 0.8rem 1rem; border: 0; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-accent-text); font-weight: 700; cursor: pointer;"
                    >
                      {isSubstituting ? "Saving…" : "Use this"}
                    </button>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      {/if}
    </section>
  {:else if workoutSession.phase === "rest"}
    <section style="display: grid; gap: var(--space-4); padding: var(--space-6); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: rgba(255,255,255,0.03);">
      <h1 id="heading-rest" tabindex="-1" style="margin: 0;">Rest</h1>
      <time aria-label={`${restSecondsRemaining} seconds remaining`} style="font-size: clamp(2rem, 10vw, 4rem); font-weight: 800;">
        {formatTime(restSecondsRemaining)}
      </time>
      <div style="display: flex; flex-wrap: wrap; gap: var(--space-3);">
        <button
          type="button"
          onclick={moveToNextExercise}
          style="padding: 0.95rem 1.2rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: transparent; color: inherit; font-weight: 700; cursor: pointer;"
        >
          Skip rest
        </button>
        <button
          type="button"
          onclick={handleAbandonWorkout}
          style="padding: 0.95rem 1.2rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: transparent; color: var(--color-text-secondary); font-weight: 700; cursor: pointer;"
        >
          Abandon workout
        </button>
      </div>
    </section>
  {/if}
</main>