<script lang="ts">
import { browser } from "$app/environment";
import { goto } from "$app/navigation";
import { onMount } from "svelte";

import { type ActiveWorkout, type EquipmentPool, type WorkoutHistoryItem, api } from "$lib/api";
import ExerciseRow from "$lib/components/ExerciseRow.svelte";
import { useAuthSession } from "$lib/context/auth-session.svelte.ts";
import {
  getTodayWorkout,
  isOfflineError,
  skipTodayWithOfflineFallback,
  submitFeedbackWithOfflineFallback,
} from "$lib/sync";

const authSession = useAuthSession();
const DASHBOARD_FLASH_KEY = "dashboard-flash";

// biome-ignore lint/style/useConst: Svelte $state values are updated through bindings.
let email = $state("demo@hone.local");
// biome-ignore lint/style/useConst: Svelte $state values are updated through bindings.
let password = $state("password12345");
let screenError = $state<string | null>(null);
let planSuccess = $state<string | null>(null);
let isGeneratingPlan = $state(false);
let isLoadingWorkout = $state(false);
let isStartingWorkout = $state(false);
let isSkippingWorkout = $state(false);
let isSubmittingFeedback = $state(false);
// biome-ignore lint/style/useConst: Svelte $state values are updated through bindings.
let feedbackDifficulty = $state("just_right");
// biome-ignore lint/style/useConst: Svelte $state values are updated through bindings.
let feedbackVariety = $state("good");
let feedbackSuccess = $state<string | null>(null);
let todayWorkout = $state<ActiveWorkout | null>(null);
let workoutHistory = $state<WorkoutHistoryItem[]>([]);
let equipmentPools = $state<EquipmentPool[]>([]);

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "title" in error) {
    return typeof error.title === "string" ? error.title : fallback;
  }

  return fallback;
}

function applyDashboardFlash() {
  if (!browser) {
    return;
  }

  const rawFlash = sessionStorage.getItem(DASHBOARD_FLASH_KEY);

  if (!rawFlash) {
    return;
  }

  sessionStorage.removeItem(DASHBOARD_FLASH_KEY);

  try {
    const flash = JSON.parse(rawFlash) as {
      kind?: "error" | "success";
      message?: string;
    };

    if (flash.kind === "success" && typeof flash.message === "string") {
      planSuccess = flash.message;
      screenError = null;
      return;
    }

    if (flash.kind === "error" && typeof flash.message === "string") {
      screenError = flash.message;
    }
  } catch {
    // Ignore malformed flash data and continue normally.
  }
}

async function loadDashboard() {
  if (!authSession.isAuthenticated) {
    todayWorkout = null;
    workoutHistory = [];
    equipmentPools = [];
    return;
  }

  isLoadingWorkout = true;
  screenError = null;
  feedbackSuccess = null;

  try {
    todayWorkout = await getTodayWorkout();

    try {
      const [history, pools] = await Promise.all([
        api.listWorkoutHistory(),
        api.listEquipmentPools(),
      ]);
      workoutHistory = history.items;
      equipmentPools = pools.items;
    } catch (error) {
      if (!isOfflineError(error)) {
        throw error;
      }
    }
  } catch (error) {
    screenError = getErrorMessage(error, "Unable to load workout.");
  } finally {
    isLoadingWorkout = false;
  }
}

onMount(() => {
  loadDashboard().catch((error) => {
    console.error("Failed to load workout dashboard", error);
  });
  applyDashboardFlash();
});

$effect(() => {
  if (authSession.isReady && authSession.isAuthenticated) {
    loadDashboard().catch((error) => {
      console.error("Failed to refresh workout dashboard", error);
    });
  }
});

async function handleLogin() {
  try {
    await authSession.login(email, password);
    await loadDashboard();
  } catch {
    // The auth context stores the displayable error state.
  }
}

async function handleRegister() {
  try {
    await authSession.register(email, password);
    await loadDashboard();
  } catch {
    // The auth context stores the displayable error state.
  }
}

async function handleLogout() {
  try {
    await authSession.logout();
    todayWorkout = null;
    workoutHistory = [];
  } catch {
    // The auth context stores the displayable error state.
  }
}

async function handlePrimaryWorkoutAction() {
  if (!todayWorkout || todayWorkout.status === "empty") {
    return;
  }

  if (todayWorkout.status === "active_session") {
    await goto("/workout");
    return;
  }

  isStartingWorkout = true;
  screenError = null;

  try {
    await api.startSession(todayWorkout.templateId);
    await goto("/workout");
  } catch (error) {
    if (isOfflineError(error)) {
      screenError =
        "Starting a workout is unavailable offline. Reconnect to begin this session.";
      return;
    }

    screenError = getErrorMessage(error, "Unable to start workout.");
  } finally {
    isStartingWorkout = false;
  }
}

async function handleGeneratePlan() {
  isGeneratingPlan = true;
  screenError = null;
  feedbackSuccess = null;
  planSuccess = null;

  try {
    await api.createPlan({
      cycleCount: 4,
      equipmentPoolId: equipmentPools[0]?.id,
      sessionMinutes: 30,
    });
    planSuccess = "Plan created. Your first workout is ready.";
    await loadDashboard();
  } catch (error) {
    if (isOfflineError(error)) {
      screenError =
        "Plan generation is unavailable offline. Reconnect to create a new plan.";
      return;
    }

    screenError = getErrorMessage(error, "Unable to generate plan.");
  } finally {
    isGeneratingPlan = false;
  }
}

async function handleSkipWorkout() {
  if (!todayWorkout || todayWorkout.status !== "planned") {
    return;
  }

  isSkippingWorkout = true;
  screenError = null;
  feedbackSuccess = null;

  try {
    const result = await skipTodayWithOfflineFallback(
      todayWorkout.mesocyclusId,
    );

    if (result.status === "queued") {
      todayWorkout = { status: "empty" };
      feedbackSuccess = "Skip queued. It will sync when you reconnect.";
      return;
    }

    await loadDashboard();
  } catch (error) {
    screenError = getErrorMessage(error, "Unable to skip workout.");
  } finally {
    isSkippingWorkout = false;
  }
}

async function handleFeedbackSubmit() {
  if (
    !todayWorkout ||
    todayWorkout.status === "empty" ||
    !todayWorkout.mesocyclusId
  ) {
    return;
  }

  isSubmittingFeedback = true;
  screenError = null;
  feedbackSuccess = null;

  try {
    const result = await submitFeedbackWithOfflineFallback(
      todayWorkout.mesocyclusId,
      feedbackDifficulty,
      feedbackVariety,
    );

    feedbackSuccess =
      result.status === "queued"
        ? "Feedback queued. It will be submitted when you reconnect."
        : "Feedback received. A new plan job is queued.";
  } catch (error) {
    screenError = getErrorMessage(error, "Unable to submit feedback.");
  } finally {
    isSubmittingFeedback = false;
  }
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "In progress";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
</script>

<main style="padding: calc(var(--safe-top) + var(--space-4)) var(--space-4) calc(var(--safe-bottom) + var(--space-6));">
  <section style="max-width: 64rem; margin: 0 auto; display: grid; gap: var(--space-4);">

    <!-- Unauthenticated: hero + login in a single focused card -->
    {#if !authSession.isReady || !authSession.isAuthenticated}
      <div style="max-width: 32rem; margin: 0 auto; width: 100%; padding: var(--space-6); background: linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 100%); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg); display: grid; gap: var(--space-5);">
        <div style="display: grid; gap: var(--space-2);">
          <p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">Hone</p>
          <h1 style="margin: 0; font-size: clamp(1.75rem, 6vw, 2.5rem); font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em; line-height: 1.05;">
            Today&apos;s workout
          </h1>
          <p style="margin: 0; color: var(--color-text-secondary); line-height: 1.6;">
            {#if !authSession.isReady}
              Initializing session…
            {:else}
              Sign in to load your plan and start training.
            {/if}
          </p>
        </div>

        {#if !authSession.isReady}
          <!-- Loading state — no form yet -->
        {:else}
          <div style="display: grid; gap: var(--space-4);">
            <div style="display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));">
              <label style="display: grid; gap: var(--space-2);">
                <span style="color: var(--color-text-muted); font-size: 0.9rem;">Email</span>
                <input
                  type="email"
                  bind:value={email}
                  autocomplete="email"
                  style="padding: 0.85rem 0.9rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: inherit;"
                />
              </label>

              <label style="display: grid; gap: var(--space-2);">
                <span style="color: var(--color-text-muted); font-size: 0.9rem;">Password</span>
                <input
                  type="password"
                  bind:value={password}
                  autocomplete="current-password"
                  style="padding: 0.85rem 0.9rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: inherit;"
                />
              </label>
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: var(--space-3);">
              <button
                type="button"
                onclick={handleLogin}
                disabled={authSession.isSubmitting}
                style="padding: 14px 1.5rem; border: 0; border-radius: var(--radius-lg); background: linear-gradient(135deg, #fcd34d, #f59e0b); color: #111; font-weight: var(--font-weight-display); font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 20px rgba(252,211,77,0.25);"
              >
                {authSession.isSubmitting ? "Working…" : "Sign in →"}
              </button>

              <button
                type="button"
                onclick={handleRegister}
                disabled={authSession.isSubmitting}
                style="padding: 14px 1.5rem; border: 1px solid rgba(255,255,255,0.10); border-radius: var(--radius-lg); background: transparent; color: inherit; font-weight: 700; cursor: pointer;"
              >
                {authSession.isSubmitting ? "Working…" : "Create account"}
              </button>
            </div>
          </div>
        {/if}

        {#if authSession.error || screenError}
          <p style="margin: 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); background: rgba(248,113,113,0.14); border: 1px solid rgba(248,113,113,0.35); color: var(--color-error);">
            {screenError ?? authSession.error}
          </p>
        {/if}
      </div>
    {/if}

    <!-- Authenticated: minimal auth bar + workout/history grid -->
    {#if authSession.isAuthenticated}
      <div style="display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; justify-content: space-between; padding: var(--space-2) 0;">
        <p style="margin: 0; color: var(--color-text-muted); font-size: 0.9rem;">
          {authSession.userId}{#if authSession.isUsingOfflineSession} · offline cache{/if}
        </p>
        <div style="display: flex; flex-wrap: wrap; gap: var(--space-3);">
          <a
            href="/plan"
            style="display: inline-flex; align-items: center; padding: 0.6rem 1rem; border-radius: var(--radius-md); background: rgba(252,211,77,0.08); border: 1px solid rgba(252,211,77,0.20); text-decoration: none; font-weight: 600; font-size: 0.875rem; color: var(--color-accent);"
          >
            View plan →
          </a>
          <a
            href="/onboarding"
            style="display: inline-flex; align-items: center; padding: 0.6rem 1rem; border-radius: var(--radius-md); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); text-decoration: none; font-weight: 600; font-size: 0.875rem; color: inherit;"
          >
            Update onboarding
          </a>
          <button
            type="button"
            onclick={handleLogout}
            disabled={authSession.isSubmitting}
            style="padding: 0.6rem 1rem; border: 0; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-accent-text); font-weight: 700; font-size: 0.875rem; cursor: pointer;"
          >
            {authSession.isSubmitting ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>

      <div style="display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));">
        <section style="display: grid; gap: var(--space-4); padding: 20px; border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg); background: linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 100%);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">
              {#if isLoadingWorkout}
                Loading…
              {:else if todayWorkout?.status === "active_session" || todayWorkout?.status === "planned"}
                Today · Strength
              {:else}
                Today
              {/if}
            </span>
            {#if todayWorkout && todayWorkout.status !== "empty" && !isLoadingWorkout}
              <span style="background: rgba(252,211,77,0.12); color: var(--color-accent); padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; border: 1px solid rgba(252,211,77,0.2); letter-spacing: 1px; text-transform: uppercase;">
                {todayWorkout.exercises.length} Exercises
              </span>
            {/if}
          </div>

          {#if isLoadingWorkout}
            <h2 style="margin: 0; font-size: 1.5rem; font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em;">Loading workout…</h2>
          {:else if todayWorkout?.status === "active_session"}
            <div>
              <h2 style="margin: 0 0 3px; font-size: 1.5rem; font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em;">{todayWorkout.templateTitle ?? `Workout ${todayWorkout.templateLabel}`}</h2>
              <p style="margin: 0; color: var(--color-text-muted); font-size: 11px; font-weight: 600; letter-spacing: var(--letter-spacing-caps); text-transform: uppercase;">Resume · In Progress</p>
            </div>
          {:else if todayWorkout?.status === "planned"}
            <div>
              <h2 style="margin: 0 0 3px; font-size: 1.5rem; font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em;">{todayWorkout.templateTitle ?? `Workout ${todayWorkout.templateLabel}`}</h2>
              <p style="margin: 0; color: var(--color-text-muted); font-size: 11px; font-weight: 600; letter-spacing: var(--letter-spacing-caps); text-transform: uppercase;">~45 Min · Moderate</p>
            </div>
          {:else}
            <h2 style="margin: 0; font-size: 1.5rem; font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em;">No active workout yet</h2>
          {/if}

          {#if todayWorkout?.status === "empty"}
            <p style="margin: 0; color: var(--color-text-secondary); line-height: 1.6;">
              There is no active mesocycle yet. Generate your first plan to populate today's workout.
            </p>
            <button
              type="button"
              onclick={handleGeneratePlan}
              disabled={isGeneratingPlan}
              style="width: 100%; padding: 14px; border: 0; border-radius: var(--radius-lg); background: linear-gradient(135deg, #fcd34d, #f59e0b); color: #111; font-weight: var(--font-weight-display); font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 20px rgba(252,211,77,0.25);"
            >
              {isGeneratingPlan ? "Generating…" : "Generate plan"}
            </button>
          {:else if todayWorkout}
            <div style="display: grid; gap: 6px;">
              {#each todayWorkout.exercises as exercise, i}
                <ExerciseRow
                  name={exercise.name}
                  sets={exercise.sets}
                  reps={exercise.reps ?? 0}
                  weight="Bodyweight"
                  icon="💪"
                  active={i === 0}
                />
              {/each}
            </div>

            <div style="display: flex; flex-wrap: wrap; gap: var(--space-3);">
              <button
                type="button"
                onclick={handlePrimaryWorkoutAction}
                disabled={isStartingWorkout}
                style="flex: 1; padding: 14px; border: 0; border-radius: var(--radius-lg); background: linear-gradient(135deg, #fcd34d, #f59e0b); color: #111; font-weight: var(--font-weight-display); font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 20px rgba(252,211,77,0.25);"
              >
                {#if todayWorkout.status === "active_session"}
                  Resume workout →
                {:else}
                  {isStartingWorkout ? "Starting…" : "Start workout →"}
                {/if}
              </button>

              {#if todayWorkout.status === "planned"}
                <button
                  type="button"
                  onclick={handleSkipWorkout}
                  disabled={isSkippingWorkout}
                  style="padding: 14px 1.2rem; border: 1px solid rgba(255,255,255,0.10); border-radius: var(--radius-lg); background: transparent; color: inherit; font-weight: 700; cursor: pointer;"
                >
                  {isSkippingWorkout ? "Skipping…" : "Skip today"}
                </button>
              {/if}
            </div>
          {/if}
        </section>

        <aside style="display: grid; gap: var(--space-4); padding: 20px; border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-lg); background: rgba(255,255,255,0.05);">
          <div style="display: grid; gap: var(--space-2);">
            <p style="margin: 0; color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">Recent sessions</p>
            <h2 style="margin: 0; font-size: 1.25rem; font-weight: var(--font-weight-display);">History</h2>
          </div>

          {#if workoutHistory.length === 0}
            <p style="margin: 0; color: var(--color-text-secondary);">No sessions logged yet.</p>
          {:else}
            <ul style="display: grid; gap: var(--space-3); margin: 0; padding: 0; list-style: none;">
              {#each workoutHistory.slice(0, 5) as session}
                <li style="padding: var(--space-3); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md); background: rgba(255,255,255,0.03); display: grid; gap: 0.35rem;">
                  <strong style="font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.5px;">{session.status}</strong>
                  <span style="color: var(--color-text-secondary); font-size: 0.85rem;">{formatTimestamp(session.completedAt)}</span>
                </li>
              {/each}
            </ul>
          {/if}

          {#if todayWorkout && todayWorkout.status !== "empty" && todayWorkout.mesocyclusId}
            <section style="display: grid; gap: var(--space-3); padding-top: var(--space-4); border-top: 1px solid rgba(255,255,255,0.08);">
              <div style="display: grid; gap: var(--space-2);">
                <p style="margin: 0; color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">Weekly feedback</p>
                <h3 style="margin: 0; font-size: 1rem;">Adjust the next plan</h3>
              </div>

              <label style="display: grid; gap: var(--space-2);">
                <span style="color: var(--color-text-muted); font-size: 0.875rem;">Difficulty</span>
                <select bind:value={feedbackDifficulty} style="padding: 0.85rem 0.9rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: inherit;">
                  <option value="too_easy">Too easy</option>
                  <option value="just_right">Just right</option>
                  <option value="too_hard">Too hard</option>
                </select>
              </label>

              <label style="display: grid; gap: var(--space-2);">
                <span style="color: var(--color-text-muted); font-size: 0.875rem;">Variety</span>
                <select bind:value={feedbackVariety} style="padding: 0.85rem 0.9rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: inherit;">
                  <option value="too_low">Need more variety</option>
                  <option value="good">Good balance</option>
                  <option value="too_high">Too much variety</option>
                </select>
              </label>

              <button
                type="button"
                onclick={handleFeedbackSubmit}
                disabled={isSubmittingFeedback}
                style="padding: 0.85rem 1.2rem; border: 1px solid rgba(255,255,255,0.10); border-radius: var(--radius-md); background: transparent; color: inherit; font-weight: 700; cursor: pointer;"
              >
                {isSubmittingFeedback ? "Submitting…" : "Send feedback"}
              </button>

              {#if feedbackSuccess}
                <p style="margin: 0; color: var(--color-success);">{feedbackSuccess}</p>
              {/if}
            </section>
          {/if}
        </aside>
      </div>

      {#if authSession.error || screenError}
        <p style="margin: 0; padding: var(--space-4); border-radius: var(--radius-md); background: rgba(248,113,113,0.14); border: 1px solid rgba(248,113,113,0.35); color: var(--color-error);">
          {screenError ?? authSession.error}
        </p>
      {/if}

      {#if planSuccess}
        <p style="margin: 0; padding: var(--space-4); border-radius: var(--radius-md); background: rgba(34,197,94,0.14); border: 1px solid rgba(34,197,94,0.35); color: var(--color-success);">
          {planSuccess}
        </p>
      {/if}
    {/if}
  </section>
</main>