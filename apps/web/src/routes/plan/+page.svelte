<script lang="ts">
import { goto } from "$app/navigation";
import { type ActivePlan, type EquipmentPool, api } from "$lib/api";
import { useAuthSession } from "$lib/context/auth-session.svelte.ts";
import { offlineStore } from "$lib/db/offline-store";
import { onMount } from "svelte";

const authSession = useAuthSession();

let plan = $state<ActivePlan | null>(null);
let equipmentPools = $state<EquipmentPool[]>([]);
let isLoading = $state(true);
let isOffline = $state(false);
let isRegenerating = $state(false);
let screenError = $state<string | null>(null);

// Action bar selections — initialised from plan data once loaded, then user-editable
let selectedPoolId = $state<string | null>(null);
let selectedCycles = $state(4);
let selectedMinutes = $state(30);

const CYCLE_OPTIONS = [2, 3, 4, 6];
const MINUTE_OPTIONS = [30, 45, 60, 90];

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "title" in error) {
    return typeof error.title === "string" ? error.title : fallback;
  }
  return fallback;
}

async function load() {
  isLoading = true;
  screenError = null;
  isOffline = false;

  if (!navigator.onLine) {
    const cached = await offlineStore.getCachedActivePlan();

    if (cached) {
      plan = cached.data;
      selectedPoolId = plan.equipmentPoolId ?? null;
      selectedCycles = plan.cycleCount;
      selectedMinutes = plan.sessionMinutes;
    } else {
      plan = null;
      isOffline = true;
    }

    isLoading = false;
    return;
  }

  try {
    const [planResult, poolsResult] = await Promise.allSettled([
      api.getActivePlan(),
      api.listEquipmentPools(),
    ]);

    if (poolsResult.status === "fulfilled") {
      equipmentPools = poolsResult.value.items;
    }

    if (planResult.status === "fulfilled") {
      plan = planResult.value;
      selectedPoolId = plan.equipmentPoolId ?? equipmentPools[0]?.id ?? null;
      selectedCycles = plan.cycleCount;
      selectedMinutes = plan.sessionMinutes;
      await offlineStore.cacheActivePlan(plan);
    } else {
      // 404 means no active plan — that's the empty state, not an error
      const err = planResult.reason as { status?: number };
      if (err?.status !== 404) {
        screenError = getErrorMessage(
          planResult.reason,
          "Unable to load plan.",
        );
      }
      plan = null;
      selectedPoolId = equipmentPools[0]?.id ?? null;
    }
  } catch (error) {
    screenError = getErrorMessage(error, "Unable to load plan.");
  } finally {
    isLoading = false;
  }
}

onMount(() => {
  if (!authSession.isAuthenticated) {
    goto("/");
    return;
  }
  load().catch((e) => console.error("Failed to load plan", e));
});

$effect(() => {
  if (authSession.isReady && !authSession.isAuthenticated) {
    goto("/");
  }
});

async function handleRegenerate() {
  isRegenerating = true;
  screenError = null;

  try {
    await api.createPlan({
      cycleCount: selectedCycles,
      equipmentPoolId: selectedPoolId ?? undefined,
      sessionMinutes: selectedMinutes,
    });
    await load();
  } catch (error) {
    screenError = getErrorMessage(error, "Unable to generate plan.");
  } finally {
    isRegenerating = false;
  }
}

// Cycle progress helpers
function getDotState(
  cycleIndex: number,
  sessionPosition: number,
  completedSessions: number,
  totalSessions: number,
  sessionsPerCycle: number,
  nextSession: ActivePlan["sessions"][number] | undefined,
): "done" | "next" | "upcoming" {
  const globalIndex = cycleIndex * sessionsPerCycle + (sessionPosition - 1);
  if (globalIndex < completedSessions) return "done";
  if (
    nextSession &&
    globalIndex === completedSessions &&
    sessionPosition === nextSession.position
  ) {
    return "next";
  }
  if (globalIndex === completedSessions) return "next";
  return "upcoming";
}
</script>

<div style="display: flex; flex-direction: column; height: 100dvh; overflow: hidden;">
  <!-- Fixed nav bar -->
  <nav style="flex-shrink: 0; z-index: 10; background: #0a0a14; border-bottom: 1px solid rgba(255,255,255,0.07); padding: calc(var(--safe-top, 0px) + var(--space-3)) var(--space-4) var(--space-3);">
    <div style="max-width: 48rem; margin: 0 auto; display: flex; align-items: center; justify-content: space-between;">
      <a
        href="/"
        style="color: var(--color-text-muted); font-size: 0.875rem; text-decoration: none; font-weight: 600;"
      >
        ← Dashboard
      </a>
      <p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">
        Training Plan
      </p>
    </div>
  </nav>

  {#if isLoading}
    <div style="flex: 1; display: flex; align-items: center; padding: var(--space-5) var(--space-4);">
      <p style="color: var(--color-text-muted); margin: 0;">Loading plan…</p>
    </div>

  {:else if isOffline}
    <div style="flex: 1; overflow-y: auto; padding: var(--space-5) var(--space-4) 160px;">
      <div style="max-width: 48rem; margin: 0 auto; display: grid; gap: var(--space-4);">
        <div style="display: grid; gap: var(--space-3); padding: var(--space-6); background: linear-gradient(160deg, #0f0f1a, #1a1a2e); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg);">
          <p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">Offline</p>
          <h1 style="margin: 0; font-size: clamp(1.5rem, 5vw, 2rem); font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em;">
            Plan not cached yet
          </h1>
          <p style="margin: 0; color: var(--color-text-secondary); line-height: 1.6;">
            Connect to the internet once to cache your plan for offline viewing.
          </p>
        </div>
      </div>
    </div>

  {:else if !plan}
    <!-- Empty state — whole area scrollable (content is small) -->
    <div style="flex: 1; overflow-y: auto; padding: var(--space-5) var(--space-4) 160px;">
      <div style="max-width: 48rem; margin: 0 auto; display: grid; gap: var(--space-4);">
        <div style="display: grid; gap: var(--space-3); padding: var(--space-6); background: linear-gradient(160deg, #0f0f1a, #1a1a2e); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg);">
          <p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">No active plan</p>
          <h1 style="margin: 0; font-size: clamp(1.5rem, 5vw, 2rem); font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em;">
            Generate your first plan
          </h1>
          <p style="margin: 0; color: var(--color-text-secondary); line-height: 1.6;">
            Select your equipment pool, cycle count, and session duration below, then hit "Generate →" to build your mesocyclus.
          </p>
        </div>
        {#if screenError}
          <p style="margin: 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); background: rgba(248,113,113,0.14); border: 1px solid rgba(248,113,113,0.35); color: var(--color-error);">
            {screenError}
          </p>
        {/if}
      </div>
    </div>

  {:else}
    <!-- Pinned: plan header + cycle progress -->
    <div style="flex-shrink: 0; padding: var(--space-4) var(--space-4) 0;">
      <div style="max-width: 48rem; margin: 0 auto; display: grid; gap: var(--space-4);">
        <!-- Header -->
        <div style="display: grid; gap: var(--space-2);">
          <p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">
            Active Mesocyclus
          </p>
          <h1 style="margin: 0; font-size: clamp(1.5rem, 5vw, 2rem); font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em;">
            {plan.name}
          </h1>
          <p style="margin: 0; color: var(--color-text-secondary); font-size: 0.875rem;">
            {plan.cycleCount} cycles · {plan.sessionsPerCycle} sessions per cycle · {plan.completedSessions}/{plan.totalSessions} sessions done
          </p>
        </div>

        <!-- Cycle progress dot grid -->
        <section style="display: grid; gap: var(--space-3); padding: var(--space-4); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg);">
          <p style="margin: 0; color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
            Cycle Progress
          </p>
          {#each Array(plan.cycleCount) as _, cycleIndex}
            {@const nextSession = plan.sessions.find((s) => s.isNext)}
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <span style="color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; width: 3.5rem; flex-shrink: 0;">
                Cycle {cycleIndex + 1}
              </span>
              <div style="display: flex; gap: var(--space-2);">
                {#each plan.sessions as session}
                  {@const state = getDotState(cycleIndex, session.position, plan.completedSessions, plan.totalSessions, plan.sessionsPerCycle, nextSession)}
                  <div
                    style="
                      width: 28px; height: 28px; border-radius: 50%;
                      display: flex; align-items: center; justify-content: center;
                      font-size: 9px; font-weight: 700; letter-spacing: 0.5px;
                      {state === 'done'
                        ? 'background: var(--color-accent); color: #111;'
                        : state === 'next'
                          ? 'background: transparent; border: 2px solid var(--color-accent); color: var(--color-accent);'
                          : 'background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.10); color: rgba(255,255,255,0.25);'}
                    "
                    title="Session {session.position}{state === 'next' ? ' · Up next' : ''}"
                  >
                    {session.position === 1 ? "A" : session.position === 2 ? "B" : "C"}
                  </div>
                {/each}
              </div>
            </div>
          {/each}

          <!-- Progress bar -->
          <div style="display: grid; gap: var(--space-1); margin-top: var(--space-1);">
            <div style="height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden;">
              <div style="height: 100%; width: {plan.totalSessions > 0 ? Math.round((plan.completedSessions / plan.totalSessions) * 100) : 0}%; background: var(--color-accent); border-radius: 2px; transition: width 0.3s ease;"></div>
            </div>
            <p style="margin: 0; color: var(--color-text-muted); font-size: 10px;">{plan.totalSessions > 0 ? Math.round((plan.completedSessions / plan.totalSessions) * 100) : 0}% complete</p>
          </div>
        </section>
      </div>
    </div>

    <!-- Scrollable: sessions per cycle only -->
    <div style="flex: 1; overflow-y: auto; padding: var(--space-4) var(--space-4) 160px;">
      <div style="max-width: 48rem; margin: 0 auto; display: grid; gap: var(--space-3);">
        <p style="margin: 0; color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
          Sessions per Cycle
        </p>
        {#each plan.sessions as session}
          <div style="
            padding: var(--space-4);
            background: {session.isNext ? 'linear-gradient(160deg, #0f0f1a, #1a1a2e)' : 'rgba(255,255,255,0.03)'};
            border: 1px solid {session.isNext ? 'rgba(252,211,77,0.25)' : 'rgba(255,255,255,0.07)'};
            border-radius: var(--radius-lg);
            display: grid; gap: var(--space-3);
          ">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span style="color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
                Session {session.position === 1 ? "A" : session.position === 2 ? "B" : "C"}
              </span>
              {#if session.isNext}
                <span style="background: rgba(252,211,77,0.12); color: var(--color-accent); padding: 2px 8px; border-radius: 20px; font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; border: 1px solid rgba(252,211,77,0.2);">
                  UP NEXT
                </span>
              {/if}
            </div>
            <ul style="margin: 0; padding: 0; list-style: none; display: grid; gap: var(--space-2);">
              {#each session.exercises as exercise}
                <li style="display: flex; justify-content: space-between; align-items: baseline; font-size: 0.875rem;">
                  <span style="color: var(--color-text-primary);">{exercise.name}</span>
                  <span style="color: var(--color-text-muted); font-size: 0.8rem; font-variant-numeric: tabular-nums;">
                    {#if exercise.durationSecs}
                      {exercise.sets}×{Math.round(exercise.durationSecs / 60)}min
                    {:else}
                      {exercise.sets}×{exercise.reps ?? "?"}
                    {/if}
                  </span>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
        {#if screenError}
          <p style="margin: 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); background: rgba(248,113,113,0.14); border: 1px solid rgba(248,113,113,0.35); color: var(--color-error);">
            {screenError}
          </p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Sticky action bar -->
  <div style="position: fixed; bottom: 0; left: 0; right: 0; z-index: 10; background: rgba(10,10,20,0.95); backdrop-filter: blur(12px); border-top: 1px solid rgba(255,255,255,0.07); padding: var(--space-3) var(--space-4) calc(var(--safe-bottom, 0px) + var(--space-4));">
    <div style="max-width: 48rem; margin: 0 auto; display: grid; gap: var(--space-3);">
      <div style="display: flex; flex-wrap: wrap; gap: var(--space-3);">
        <!-- Equipment pool -->
        <label style="display: grid; gap: 4px; flex: 2; min-width: 9rem;">
          <span style="color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Equipment</span>
          <select
            bind:value={selectedPoolId}
            disabled={isRegenerating || equipmentPools.length === 0}
            style="padding: 0.65rem 0.75rem; border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius-md); background: rgba(255,255,255,0.05); color: inherit; font-size: 0.875rem;"
          >
            {#if equipmentPools.length === 0}
              <option value={null}>No equipment set</option>
            {:else}
              {#each equipmentPools as pool}
                <option value={pool.id}>{pool.name}</option>
              {/each}
            {/if}
          </select>
        </label>

        <!-- Cycles -->
        <label style="display: grid; gap: 4px; flex: 1; min-width: 6rem;">
          <span style="color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Cycles</span>
          <select
            bind:value={selectedCycles}
            disabled={isRegenerating}
            style="padding: 0.65rem 0.75rem; border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius-md); background: rgba(255,255,255,0.05); color: inherit; font-size: 0.875rem;"
          >
            {#each CYCLE_OPTIONS as n}
              <option value={n}>{n}</option>
            {/each}
          </select>
        </label>

        <!-- Session duration -->
        <label style="display: grid; gap: 4px; flex: 1; min-width: 6rem;">
          <span style="color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">Duration</span>
          <select
            bind:value={selectedMinutes}
            disabled={isRegenerating}
            style="padding: 0.65rem 0.75rem; border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius-md); background: rgba(255,255,255,0.05); color: inherit; font-size: 0.875rem;"
          >
            {#each MINUTE_OPTIONS as m}
              <option value={m}>{m} min</option>
            {/each}
          </select>
        </label>
      </div>

      <div>
        <button
          type="button"
          onclick={handleRegenerate}
          disabled={isRegenerating}
          style="width: 100%; padding: 14px; border: 0; border-radius: var(--radius-lg); background: linear-gradient(135deg, #fcd34d, #f59e0b); color: #111; font-weight: var(--font-weight-display); font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 20px rgba(252,211,77,0.25);"
        >
          {isRegenerating ? "Generating…" : plan ? "Regenerate →" : "Generate →"}
        </button>
        {#if plan}
          <p style="margin: var(--space-2) 0 0; text-align: center; color: var(--color-text-muted); font-size: 0.75rem;">
            Archives current · session history kept
          </p>
        {/if}
      </div>
    </div>
  </div>
</div>
