<script lang="ts">
import { goto } from "$app/navigation";
import { onMount, tick } from "svelte";

import {
  type ActiveWorkout,
  type ExerciseSubstitutionCandidate,
  api,
} from "$lib/api";
import ErrorBoundary from "$lib/components/ErrorBoundary.svelte";
import ExerciseRow from "$lib/components/ExerciseRow.svelte";
import { useTimerState } from "$lib/context/timer-state.svelte.ts";
import { useWorkoutSession } from "$lib/context/workout-session.svelte.ts";
import { offlineStore } from "$lib/db/offline-store";
import { DeviceServices } from "$lib/services/device-services";
import {
  completeWorkoutWithOfflineFallback,
  getTodayWorkout,
  isOfflineError,
  logSetWithOfflineFallback,
  substituteExerciseWithOfflineFallback,
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
  if (
    !window.confirm(
      "Abandon this workout? Any unsynced sets will be discarded.",
    )
  ) {
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
    const result = await substituteExerciseWithOfflineFallback(
      todayWorkout.sessionId,
      currentExercise.exerciseLogId,
      exerciseId,
    );

    if (result.status === "queued") {
      announcement =
        "Exercise substitution queued. It will sync when you reconnect.";
      showSubstitutions = false;
      return;
    }

    announcement = `Exercise changed to ${result.replacement.name}.`;
    await loadWorkout();
  } catch (error) {
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

<main style="padding: calc(var(--safe-top) + var(--space-4)) var(--space-4) calc(var(--safe-bottom) + var(--space-4)); display: grid; gap: var(--space-4);">
  {#if errorMessage}
    <ErrorBoundary details={errorMessage} />
  {/if}

  {#if !todayWorkout}
    <section style="width: min(100%, 52rem); margin: 0 auto; padding: var(--space-6); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg); background: linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 100%);">
      <h1 id="heading-idle" tabindex="-1" style="margin: 0 0 var(--space-2); font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em;">Loading workout…</h1>
      <p style="margin: 0; color: var(--color-text-secondary);">Preparing your active session.</p>
    </section>
  {:else if workoutSession.phase === "exercise" && currentExercise}
    <section style="width: min(100%, 52rem); margin: 0 auto; display: grid; gap: var(--space-4); padding: var(--space-6); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg); background: linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 100%);">
      <!-- Progress indicator: task 4.1 + 4.2 -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: var(--color-text-muted); font-size: 11px; font-weight: 600; letter-spacing: var(--letter-spacing-caps); text-transform: uppercase;">
          Exercise {currentIndex + 1} of {todayWorkout.exercises.length}
        </span>
        <div style="display: flex; gap: 4px;">
          {#each todayWorkout.exercises as _, i}
            <div style={`width: 24px; height: 4px; border-radius: 2px; background: ${i <= currentIndex ? "var(--color-accent)" : "rgba(255,255,255,0.1)"};`}></div>
          {/each}
        </div>
      </div>

      <!-- Exercise name header: task 4.3 + 4.4 -->
      <div style="display: flex; align-items: center; gap: 14px;">
        <div style="width: 44px; height: 44px; flex-shrink: 0; background: rgba(252,211,77,0.15); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; border: 1px solid rgba(252,211,77,0.2);">💪</div>
        <div>
          <h1 id="heading-exercise" tabindex="-1" style="margin: 0; font-size: 20px; font-weight: var(--font-weight-display); letter-spacing: 0.5px; text-transform: uppercase; color: var(--color-text-primary);">{currentExercise.name}</h1>
          <p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">Set {currentSetNumber} of {currentExercise.sets}</p>
        </div>
      </div>

      {#if currentExercise.imageUrl}
        <img
          src={currentExercise.imageUrl}
          alt={currentExercise.imageAltText}
          style="width: 100%; max-width: 28rem; border-radius: var(--radius-lg); border: 1px solid rgba(255,255,255,0.08);"
        />
      {/if}

      <!-- Target reps/weight: task 4.5 -->
      <div style="padding-left: 58px;">
        <p style="margin: 0 0 10px; color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Target</p>
        <div style="display: flex; gap: 16px; align-items: flex-start;">
          {#if currentExercise.reps}
            <div>
              <div style="color: var(--color-text-primary); font-size: 28px; font-weight: var(--font-weight-display); letter-spacing: -1px;">{currentExercise.reps}</div>
              <div style="color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Reps</div>
            </div>
          {/if}
          {#if currentExercise.durationSecs}
            <div>
              <div style="color: var(--color-text-primary); font-size: 28px; font-weight: var(--font-weight-display); letter-spacing: -1px;">{currentExercise.durationSecs}</div>
              <div style="color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Sec</div>
            </div>
          {/if}
        </div>
      </div>

      <!-- Completed sets log: task 4.6 -->
      {#if currentExercise.completedSets > 0}
        <div style="border-left: 3px solid rgba(252,211,77,0.3); padding-left: 12px;">
          <p style="margin: 0 0 8px; color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Completed Sets</p>
          {#each { length: currentExercise.completedSets } as _, i}
            <p style="margin: 0 0 4px; color: var(--color-text-muted); font-size: 12px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">
              Set {i + 1}{#if currentExercise.reps} — {currentExercise.reps} Reps ✓{/if}{#if currentExercise.durationSecs} — {currentExercise.durationSecs}s ✓{/if}
            </p>
          {/each}
        </div>
      {/if}

      {#if currentExercise.substitutedForName}
        <p style="margin: 0; color: var(--color-text-muted); font-size: 11px;">
          Substituted for {currentExercise.substitutedForName}
        </p>
      {/if}

      <!-- CTA buttons: Row 1 primary, Row 2 secondary -->
      <div style="display: grid; gap: var(--space-3);">
        <button
          type="button"
          onclick={handleSetDone}
          disabled={isBusy}
          style="width: 100%; padding: 14px; border: 0; border-radius: var(--radius-lg); background: linear-gradient(135deg, #fcd34d, #f59e0b); color: #111; font-weight: var(--font-weight-display); font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 20px rgba(252,211,77,0.25);"
        >
          {isBusy ? "Saving…" : "Log Set ✓"}
        </button>
        <div style="display: flex; gap: var(--space-3); justify-content: center;">
          <button
            type="button"
            onclick={handleToggleSubstitutions}
            disabled={isLoadingSubstitutions || isSubstituting}
            style="padding: 10px 1.2rem; border: 1px solid rgba(255,255,255,0.10); border-radius: var(--radius-lg); background: transparent; color: inherit; font-weight: 600; font-size: 0.875rem; min-height: 44px; cursor: pointer;"
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
            style="padding: 10px 1.2rem; border: 1px solid rgba(255,255,255,0.10); border-radius: var(--radius-lg); background: transparent; color: var(--color-text-muted); font-weight: 600; font-size: 0.875rem; min-height: 44px; cursor: pointer;"
          >
            Abandon workout
          </button>
        </div>
      </div>

      <!-- Substitutions list: task 4.7 -->
      {#if showSubstitutions}
        <section style="display: grid; gap: var(--space-3); padding: var(--space-4); border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);">
          <h2 style="margin: 0; font-size: 10px; font-weight: 700; letter-spacing: var(--letter-spacing-caps); text-transform: uppercase; color: var(--color-text-muted);">Suggested Alternatives</h2>
          {#if substitutions.length === 0}
            <p style="margin: 0; color: var(--color-text-secondary);">
              No close alternatives are available for this exercise.
            </p>
          {:else}
            <div style="display: grid; gap: var(--space-2);">
              {#each substitutions as substitution}
                <div style="display: flex; align-items: center; gap: var(--space-3); justify-content: space-between;">
                  <div style="flex: 1; min-width: 0;">
                    <ExerciseRow
                      name={substitution.name}
                      sets={currentExercise.sets}
                      reps={currentExercise.reps ?? 0}
                      weight="Bodyweight"
                      icon="💪"
                      active={false}
                    />
                  </div>
                  <button
                    type="button"
                    onclick={() => handleSubstituteExercise(substitution.id)}
                    disabled={isSubstituting}
                    style="flex-shrink: 0; padding: 0.8rem 1rem; border: 0; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-accent-text); font-weight: 700; cursor: pointer; font-size: 12px;"
                  >
                    {isSubstituting ? "Saving…" : "Use this"}
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}
    </section>
  {:else if workoutSession.phase === "rest"}
    <section style="width: min(100%, 52rem); margin: 0 auto; display: grid; gap: var(--space-4); padding: var(--space-6); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg); background: linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 100%);">
      <h1 id="heading-rest" tabindex="-1" style="margin: 0; font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em;">Rest</h1>
      <time aria-label={`${restSecondsRemaining} seconds remaining`} style="font-size: clamp(2rem, 10vw, 4rem); font-weight: 800;">
        {formatTime(restSecondsRemaining)}
      </time>
      <div style="display: flex; gap: var(--space-3); justify-content: center;">
        <button
          type="button"
          onclick={moveToNextExercise}
          style="padding: 10px 1.5rem; border: 1px solid rgba(255,255,255,0.10); border-radius: var(--radius-lg); background: transparent; color: inherit; font-weight: 600; font-size: 0.875rem; min-height: 44px; cursor: pointer;"
        >
          Skip rest
        </button>
        <button
          type="button"
          onclick={handleAbandonWorkout}
          style="padding: 10px 1.5rem; border: 1px solid rgba(255,255,255,0.10); border-radius: var(--radius-lg); background: transparent; color: var(--color-text-muted); font-weight: 600; font-size: 0.875rem; min-height: 44px; cursor: pointer;"
        >
          Abandon workout
        </button>
      </div>
    </section>
  {/if}
</main>