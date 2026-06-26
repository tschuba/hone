<script lang="ts">
import { browser } from "$app/environment";
import { goto } from "$app/navigation";

import {
  type EquipmentPool,
  type ProfileConstraints,
  type UserProfile,
  api,
} from "$lib/api";
import { useAuthSession } from "$lib/context/auth-session.svelte.ts";
import { type DashboardFlash, setDashboardFlash } from "$lib/dashboard-flash";

type Step = "welcome" | "goals" | "equipment" | "constraints" | "ready";
type OnboardingFormData = {
  constraints: ProfileConstraints;
  equipment: string[];
  goals: string[];
  poolId: string | null;
  poolName: string;
};

const authSession = useAuthSession();
const DRAFT_STORAGE_KEY = "onboarding-draft";
const STEP_ORDER: Step[] = [
  "welcome",
  "goals",
  "equipment",
  "constraints",
  "ready",
];
const GOAL_OPTIONS = [
  "Build consistency",
  "Reduce knee pain",
  "Improve strength",
  "Lose body fat",
  "Increase energy",
];
const EQUIPMENT_OPTIONS = [
  { label: "Dumbbell", value: "dumbbell" },
  { label: "Pull-up bar", value: "pull_up_bar" },
  { label: "Resistance band", value: "resistance_band" },
  { label: "Mat", value: "mat" },
  { label: "Row erg", value: "row_erg" },
  { label: "Bench", value: "bench" },
];

const defaultFormData: OnboardingFormData = {
  constraints: { impactFilter: false },
  equipment: [],
  goals: [],
  poolId: null,
  poolName: "Zuhause",
};

function normalizeDraft(value: unknown): OnboardingFormData {
  if (typeof value !== "object" || value === null) {
    return defaultFormData;
  }

  const record = value as Record<string, unknown>;

  return {
    constraints:
      typeof record.constraints === "object" && record.constraints !== null
        ? {
            impactFilter: Boolean(
              (record.constraints as Record<string, unknown>).impactFilter,
            ),
          }
        : defaultFormData.constraints,
    equipment: Array.isArray(record.equipment)
      ? record.equipment.filter(
          (item): item is string => typeof item === "string",
        )
      : defaultFormData.equipment,
    goals: Array.isArray(record.goals)
      ? record.goals.filter((item): item is string => typeof item === "string")
      : defaultFormData.goals,
    poolId: typeof record.poolId === "string" ? record.poolId : null,
    poolName:
      typeof record.poolName === "string" && record.poolName.trim().length > 0
        ? record.poolName
        : defaultFormData.poolName,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "title" in error) {
    return typeof error.title === "string" ? error.title : fallback;
  }

  return fallback;
}

let isLoading = $state(true);
let isSubmitting = $state(false);
let saveError = $state<string | null>(null);
let step = $state<Step>("welcome");
let stepError = $state<string | null>(null);
let formData = $state<OnboardingFormData>(defaultFormData);
let hasLoaded = false;

$effect(() => {
  if (!authSession.isReady || hasLoaded) {
    return;
  }

  hasLoaded = true;

  void (async () => {
    if (!authSession.isAuthenticated) {
      await goto("/");
      return;
    }

    try {
      if (browser) {
        const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);

        if (savedDraft) {
          formData = normalizeDraft(JSON.parse(savedDraft));
        }
      }

      const [profile, equipmentPools] = await Promise.all([
        api.getProfile(),
        api.listEquipmentPools(),
      ]);

      hydrateFromServer(profile, equipmentPools.items);
    } catch (error) {
      console.error("Failed to load onboarding state", error);
      saveError = "Unable to load your onboarding progress.";
    } finally {
      isLoading = false;
    }
  })();
});

$effect(() => {
  if (!browser || isLoading) {
    return;
  }

  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
});

function hydrateFromServer(
  profile: UserProfile,
  equipmentPools: EquipmentPool[],
) {
  const firstPool = equipmentPools[0];

  formData = {
    constraints: profile.constraints,
    equipment: firstPool?.tags ?? formData.equipment,
    goals: profile.goals.map((goal) => goal.value),
    poolId: firstPool?.id ?? formData.poolId,
    poolName: firstPool?.name ?? formData.poolName,
  };
}

function previousStep() {
  const currentIndex = STEP_ORDER.indexOf(step);

  if (currentIndex > 0) {
    step = STEP_ORDER[currentIndex - 1];
    stepError = null;
  }
}

function validateStep(currentStep: Step) {
  if (currentStep === "goals" && formData.goals.length === 0) {
    return "Choose at least one goal to continue.";
  }

  if (currentStep === "equipment") {
    if (formData.poolName.trim().length === 0) {
      return "Give your equipment set a name.";
    }

    if (formData.equipment.length === 0) {
      return "Choose at least one piece of equipment.";
    }
  }

  return null;
}

function nextStep() {
  const error = validateStep(step);

  if (error) {
    stepError = error;
    return;
  }

  const currentIndex = STEP_ORDER.indexOf(step);

  if (currentIndex < STEP_ORDER.length - 1) {
    step = STEP_ORDER[currentIndex + 1];
    stepError = null;
  }
}

function toggleGoal(goal: string) {
  formData = {
    ...formData,
    goals: formData.goals.includes(goal)
      ? formData.goals.filter((item) => item !== goal)
      : [...formData.goals, goal],
  };
}

function toggleEquipment(equipmentTag: string) {
  formData = {
    ...formData,
    equipment: formData.equipment.includes(equipmentTag)
      ? formData.equipment.filter((item) => item !== equipmentTag)
      : [...formData.equipment, equipmentTag],
  };
}

async function completeOnboarding() {
  const error = validateStep("equipment");

  if (error) {
    step = "equipment";
    stepError = error;
    return;
  }

  isSubmitting = true;
  saveError = null;

  try {
    await api.updateProfile({
      constraints: formData.constraints,
      goals: formData.goals.map((goal) => ({ scope: "profile", value: goal })),
    });

    let resolvedPoolId = formData.poolId;

    if (formData.poolId) {
      await api.updateEquipmentPool(formData.poolId, {
        name: formData.poolName,
        tags: formData.equipment,
      });
    } else {
      const pool = await api.createEquipmentPool(
        formData.poolName,
        formData.equipment,
      );

      formData = {
        ...formData,
        poolId: pool.id,
      };
      resolvedPoolId = pool.id;
    }

    let dashboardFlash: DashboardFlash | undefined;

    try {
      await api.createPlan({
        equipmentPoolId: resolvedPoolId ?? undefined,
        sessionMinutes: 30,
        cycleCount: 4,
      });

      dashboardFlash = {
        kind: "success",
        message: "Onboarding saved. Your first training plan is ready.",
      };
    } catch (error) {
      dashboardFlash = {
        kind: "error",
        message: `Onboarding saved, but plan generation could not be completed: ${getErrorMessage(
          error,
          "Please generate your plan from the dashboard.",
        )}`,
      };
    }

    if (browser) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      if (dashboardFlash) {
        setDashboardFlash(dashboardFlash);
      }
    }

    await goto("/app");
  } catch (error) {
    console.error("Failed to save onboarding", error);
    saveError = getErrorMessage(
      error,
      "Unable to save your onboarding progress.",
    );
  } finally {
    isSubmitting = false;
  }
}
</script>

<svelte:head>
  <title>Onboarding | Hone</title>
</svelte:head>

<main style="min-height: 100dvh; display: grid; place-items: start center; padding: calc(var(--safe-top) + var(--space-6)) var(--space-4) calc(var(--safe-bottom) + var(--space-6));">
  <section
    style="max-width: 52rem; width: 100%; padding: var(--space-6); background: linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 100%); border: 1px solid rgba(255,255,255,0.07); border-radius: var(--radius-lg); display: grid; gap: var(--space-6);"
  >
    <div style="display: grid; gap: var(--space-2);">
      <p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">Hone</p>
      <h1 style="margin: 0; font-size: clamp(1.5rem, 5vw, 2rem); font-weight: var(--font-weight-display); text-transform: uppercase; letter-spacing: -0.03em; line-height: 1.05;">Profile Setup</h1>
      <p style="margin: 0; color: var(--color-text-secondary); line-height: 1.6; max-width: 40rem;">
        Set your training goals, equipment, and joint-friendly preferences. Progress saves locally on every change.
      </p>
    </div>

    <!-- Step progress: task 6.1 -->
    <nav aria-label="Onboarding progress" style="display: flex; justify-content: space-between; align-items: center;">
      <span style="color: var(--color-text-muted); font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
        Step {STEP_ORDER.indexOf(step) + 1} of {STEP_ORDER.length}
      </span>
      <div style="display: flex; gap: 4px;">
        {#each STEP_ORDER as progressStep, index}
          <div
            aria-current={step === progressStep ? "step" : undefined}
            style={`width: 20px; height: 3px; border-radius: 2px; background: ${index <= STEP_ORDER.indexOf(step) ? "var(--color-accent)" : "rgba(255,255,255,0.1)"};`}
          ></div>
        {/each}
      </div>
    </nav>

    {#if isLoading}
      <p style="margin: 0; color: var(--color-text-secondary);">Loading your profile…</p>
    {:else}
      <div style="display: grid; gap: var(--space-5);">
        {#if step === "welcome"}
          <div style="display: grid; gap: var(--space-3);">
            <!-- task 6.2 -->
            <p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">Get Started</p>
            <h2 style="margin: 0; font-size: 22px; font-weight: var(--font-weight-display); letter-spacing: -0.5px; text-transform: uppercase;">Welcome to Hone</h2>
            <p style="margin: 0; color: var(--color-text-secondary);">
              This setup should take under two minutes. You can come back later and change everything.
            </p>
          </div>
        {/if}

        {#if step === "goals"}
          <fieldset style="display: grid; gap: var(--space-3); border: 0; padding: 0; margin: 0;">
            <!-- task 6.2 -->
            <p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">Your Goals</p>
            <legend style="padding: 0; font-size: 22px; font-weight: var(--font-weight-display); letter-spacing: -0.5px; text-transform: uppercase; margin-bottom: var(--space-2); color: var(--color-text-primary);">What do you want from training?</legend>
            <p id="goals-help" style="margin: 0; color: var(--color-text-secondary);">
              Select one or more priorities. They will be stored on your profile.
            </p>
            <!-- task 6.3 + 6.4 -->
            <div style="display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));">
              {#each GOAL_OPTIONS as goal}
                {@const selected = formData.goals.includes(goal)}
                <label
                  style={`display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; min-height: 44px; padding: var(--space-3) var(--space-4); border-radius: 10px; cursor: pointer; background: ${selected ? "rgba(252,211,77,0.08)" : "rgba(255,255,255,0.08)"}; border: 1px solid ${selected ? "rgba(252,211,77,0.3)" : "rgba(255,255,255,0.10)"};`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onchange={() => toggleGoal(goal)}
                    aria-describedby={stepError ? "goals-error" : "goals-help"}
                    style="position: absolute; width: 1px; height: 1px; clip: rect(0 0 0 0); white-space: nowrap; overflow: hidden;"
                  />
                  <span style={`font-size: 12px; font-weight: var(--font-weight-display); letter-spacing: 0.8px; text-transform: uppercase; color: ${selected ? "var(--color-text-primary)" : "var(--color-text-secondary)"};`}>{goal}</span>
                  <span style={`flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; ${selected ? "background: var(--color-accent); border: 1.5px solid var(--color-accent);" : "border: 1.5px solid rgba(255,255,255,0.25); background: transparent;"}`}></span>
                </label>
              {/each}
            </div>
          </fieldset>
        {/if}

        {#if step === "equipment"}
          <div style="display: grid; gap: var(--space-4);">
            <!-- task 6.2 -->
            <div>
              <p style="margin: 0 0 8px; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">Your Equipment</p>
              <h2 style="margin: 0; font-size: 22px; font-weight: var(--font-weight-display); letter-spacing: -0.5px; text-transform: uppercase; color: var(--color-text-primary);">What do you have access to?</h2>
            </div>
            <label style="display: grid; gap: var(--space-2);">
              <span style="font-weight: 700; font-size: 12px; letter-spacing: 0.8px; text-transform: uppercase; color: var(--color-text-secondary);">Equipment Set Name</span>
              <input
                bind:value={formData.poolName}
                aria-describedby={stepError ? "equipment-error" : undefined}
                style="padding: 0.85rem 0.9rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: inherit;"
              />
            </label>

            <fieldset style="display: grid; gap: var(--space-3); border: 0; padding: 0; margin: 0;">
              <legend style="padding: 0; font-weight: 700; font-size: 12px; letter-spacing: 0.8px; text-transform: uppercase; color: var(--color-text-secondary); margin-bottom: var(--space-2);">Which equipment do you have?</legend>
              <p id="equipment-help" style="margin: 0; color: var(--color-text-secondary);">
                Pick at least one option. You can add more pools later.
              </p>
              <!-- task 6.3 + 6.4 -->
              <div style="display: grid; gap: var(--space-2); grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));">
                {#each EQUIPMENT_OPTIONS as option}
                  {@const selected = formData.equipment.includes(option.value)}
                  <label
                    style={`display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; min-height: 44px; padding: var(--space-3) var(--space-4); border-radius: 10px; cursor: pointer; background: ${selected ? "rgba(252,211,77,0.08)" : "rgba(255,255,255,0.08)"}; border: 1px solid ${selected ? "rgba(252,211,77,0.3)" : "rgba(255,255,255,0.10)"};`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onchange={() => toggleEquipment(option.value)}
                      aria-describedby={stepError ? "equipment-error" : "equipment-help"}
                      style="position: absolute; width: 1px; height: 1px; clip: rect(0 0 0 0); white-space: nowrap; overflow: hidden;"
                    />
                    <span style={`font-size: 12px; font-weight: var(--font-weight-display); letter-spacing: 0.8px; text-transform: uppercase; color: ${selected ? "var(--color-text-primary)" : "var(--color-text-secondary)"};`}>{option.label}</span>
                    <span style={`flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; ${selected ? "background: var(--color-accent); border: 1.5px solid var(--color-accent);" : "border: 1.5px solid rgba(255,255,255,0.25); background: transparent;"}`}></span>
                  </label>
                {/each}
              </div>
            </fieldset>
          </div>
        {/if}

        {#if step === "constraints"}
          <fieldset style="display: grid; gap: var(--space-3); border: 0; padding: 0; margin: 0;">
            <!-- task 6.2 -->
            <p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">Preferences</p>
            <legend style="padding: 0; font-size: 22px; font-weight: var(--font-weight-display); letter-spacing: -0.5px; text-transform: uppercase; color: var(--color-text-primary); margin-bottom: var(--space-2);">Any joint constraints?</legend>
            <p id="constraints-help" style="margin: 0; color: var(--color-text-secondary);">
              This Sprint 3 toggle is saved now and will activate exercise filtering in a later phase.
            </p>
            <label
              style={`display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; min-height: 44px; padding: var(--space-3) var(--space-4); border-radius: 10px; cursor: pointer; background: ${formData.constraints.impactFilter ? "rgba(252,211,77,0.08)" : "rgba(255,255,255,0.08)"}; border: 1px solid ${formData.constraints.impactFilter ? "rgba(252,211,77,0.3)" : "rgba(255,255,255,0.10)"};`}
            >
              <input
                type="checkbox"
                bind:checked={formData.constraints.impactFilter}
                aria-describedby="constraints-help"
                style="position: absolute; width: 1px; height: 1px; clip: rect(0 0 0 0); white-space: nowrap; overflow: hidden;"
              />
              <span style={`font-size: 12px; font-weight: var(--font-weight-display); letter-spacing: 0.8px; text-transform: uppercase; color: ${formData.constraints.impactFilter ? "var(--color-text-primary)" : "var(--color-text-secondary)"};`}>Gelenkschonend (Low-Impact)</span>
              <span style={`flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; ${formData.constraints.impactFilter ? "background: var(--color-accent); border: 1.5px solid var(--color-accent);" : "border: 1.5px solid rgba(255,255,255,0.25); background: transparent;"}`}></span>
            </label>
          </fieldset>
        {/if}

        {#if step === "ready"}
          <div style="display: grid; gap: var(--space-3);">
            <!-- task 6.2 -->
            <p style="margin: 0; color: var(--color-accent); font-size: 10px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase;">Almost There</p>
            <h2 style="margin: 0; font-size: 22px; font-weight: var(--font-weight-display); letter-spacing: -0.5px; text-transform: uppercase;">Ready to start</h2>
            <p style="margin: 0; color: var(--color-text-secondary);">
              Review your setup before saving.
            </p>
            <div style="display: grid; gap: var(--space-3); padding: var(--space-4); border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius-md); background: rgba(255,255,255,0.05);">
              <p style="margin: 0;"><strong>Goals:</strong> {formData.goals.join(", ") || "None selected"}</p>
              <p style="margin: 0;"><strong>Equipment set:</strong> {formData.poolName}</p>
              <p style="margin: 0;"><strong>Equipment:</strong> {formData.equipment.join(", ") || "None selected"}</p>
              <p style="margin: 0;"><strong>Impact filter:</strong> {formData.constraints.impactFilter ? "Enabled" : "Disabled"}</p>
            </div>
          </div>
        {/if}

        {#if stepError}
          <p
            id={`${step}-error`}
            style="margin: 0; padding: var(--space-4); border-radius: var(--radius-md); background: rgba(248, 113, 113, 0.14); border: 1px solid rgba(248, 113, 113, 0.35); color: var(--color-error);"
          >
            {stepError}
          </p>
        {/if}

        {#if saveError}
          <p style="margin: 0; padding: var(--space-4); border-radius: var(--radius-md); background: rgba(248, 113, 113, 0.14); border: 1px solid rgba(248, 113, 113, 0.35); color: var(--color-error);">
            {saveError}
          </p>
        {/if}

        <div style="display: flex; flex-wrap: wrap; gap: var(--space-3); justify-content: space-between; align-items: center;">
          <button
            type="button"
            onclick={previousStep}
            disabled={step === "welcome" || isSubmitting}
            style="padding: 0.85rem 1rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); background: transparent; color: inherit; font-weight: 700;"
          >
            Back
          </button>

          {#if step !== "ready"}
            <!-- task 6.5 -->
            <button
              type="button"
              onclick={nextStep}
              style="padding: 14px 1.5rem; border: 0; border-radius: var(--radius-lg); background: linear-gradient(135deg, #fcd34d, #f59e0b); color: #111; font-weight: var(--font-weight-display); font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 20px rgba(252,211,77,0.25);"
            >
              Continue →
            </button>
          {:else}
            <!-- task 6.5 -->
            <button
              type="button"
              onclick={completeOnboarding}
              disabled={isSubmitting}
              style="padding: 14px 1.5rem; border: 0; border-radius: var(--radius-lg); background: linear-gradient(135deg, #fcd34d, #f59e0b); color: #111; font-weight: var(--font-weight-display); font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; box-shadow: 0 4px 20px rgba(252,211,77,0.25);"
            >
              {isSubmitting ? "Saving…" : "Finish →"}
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </section>
</main>