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
const DASHBOARD_FLASH_KEY = "dashboard-flash";
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

    let dashboardFlash:
      | {
          kind: "error" | "success";
          message: string;
        }
      | undefined;

    try {
      await api.createPlan({
        equipmentPoolId: resolvedPoolId ?? undefined,
        sessionMinutes: 30,
        weeksCount: 4,
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
        sessionStorage.setItem(
          DASHBOARD_FLASH_KEY,
          JSON.stringify(dashboardFlash),
        );
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

<main style="padding: calc(var(--safe-top) + var(--space-6)) var(--space-4) calc(var(--safe-bottom) + var(--space-6));">
  <section
    style="max-width: 52rem; margin: 0 auto; padding: var(--space-6); background: var(--color-surface-card); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); display: grid; gap: var(--space-6);"
  >
    <div style="display: grid; gap: var(--space-2);">
      <p style="margin: 0; color: var(--color-accent); font-weight: 600;">Sprint 3</p>
      <h1 style="margin: 0; font-size: clamp(2rem, 6vw, 3rem); line-height: 1.05;">Profile and equipment onboarding</h1>
      <p style="margin: 0; color: var(--color-text-secondary); line-height: 1.6; max-width: 40rem;">
        Set your training goals, equipment, and joint-friendly preferences. Progress saves locally on every change.
      </p>
    </div>

    <nav aria-label="Onboarding progress" style="display: flex; flex-wrap: wrap; gap: var(--space-3);">
      {#each STEP_ORDER as progressStep, index}
        <span
          aria-current={step === progressStep ? "step" : undefined}
          style={`display: inline-flex; align-items: center; justify-content: center; min-width: 2.25rem; padding: 0.55rem 0.8rem; border-radius: 999px; border: 1px solid ${step === progressStep ? "rgba(252, 211, 77, 0.55)" : "var(--color-border-subtle)"}; background: ${step === progressStep ? "rgba(252, 211, 77, 0.14)" : "rgba(255,255,255,0.03)"}; font-weight: 700;`}
        >
          {index + 1}
        </span>
      {/each}
    </nav>

    {#if isLoading}
      <p style="margin: 0; color: var(--color-text-secondary);">Loading your profile…</p>
    {:else}
      <div style="display: grid; gap: var(--space-5);">
        {#if step === "welcome"}
          <div style="display: grid; gap: var(--space-3);">
            <h2 style="margin: 0;">Welcome</h2>
            <p style="margin: 0; color: var(--color-text-secondary);">
              This setup should take under two minutes. You can come back later and change everything.
            </p>
          </div>
        {/if}

        {#if step === "goals"}
          <fieldset style="display: grid; gap: var(--space-3); border: 0; padding: 0; margin: 0;">
            <legend style="font-weight: 700; margin-bottom: var(--space-2);">What do you want from training?</legend>
            <p id="goals-help" style="margin: 0; color: var(--color-text-secondary);">
              Select one or more priorities. They will be stored on your profile.
            </p>
            <div style="display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));">
              {#each GOAL_OPTIONS as goal}
                <label style="display: flex; gap: 0.75rem; align-items: center; padding: var(--space-3); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md);">
                  <input
                    type="checkbox"
                    checked={formData.goals.includes(goal)}
                    onchange={() => toggleGoal(goal)}
                    aria-describedby={stepError ? "goals-error" : "goals-help"}
                  />
                  <span>{goal}</span>
                </label>
              {/each}
            </div>
          </fieldset>
        {/if}

        {#if step === "equipment"}
          <div style="display: grid; gap: var(--space-4);">
            <label style="display: grid; gap: var(--space-2);">
              <span style="font-weight: 700;">Equipment set name</span>
              <input
                bind:value={formData.poolName}
                aria-describedby={stepError ? "equipment-error" : undefined}
                style="padding: 0.85rem 0.9rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: rgba(255,255,255,0.04); color: inherit;"
              />
            </label>

            <fieldset style="display: grid; gap: var(--space-3); border: 0; padding: 0; margin: 0;">
              <legend style="font-weight: 700; margin-bottom: var(--space-2);">Which equipment do you have?</legend>
              <p id="equipment-help" style="margin: 0; color: var(--color-text-secondary);">
                Pick at least one option. You can add more pools later.
              </p>
              <div style="display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));">
                {#each EQUIPMENT_OPTIONS as option}
                  <label style="display: flex; gap: 0.75rem; align-items: center; padding: var(--space-3); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md);">
                    <input
                      type="checkbox"
                      checked={formData.equipment.includes(option.value)}
                      onchange={() => toggleEquipment(option.value)}
                      aria-describedby={stepError ? "equipment-error" : "equipment-help"}
                    />
                    <span>{option.label}</span>
                  </label>
                {/each}
              </div>
            </fieldset>
          </div>
        {/if}

        {#if step === "constraints"}
          <fieldset style="display: grid; gap: var(--space-3); border: 0; padding: 0; margin: 0;">
            <legend style="font-weight: 700; margin-bottom: var(--space-2);">Constraints</legend>
            <p id="constraints-help" style="margin: 0; color: var(--color-text-secondary);">
              This Sprint 3 toggle is saved now and will activate exercise filtering in a later phase.
            </p>
            <label style="display: flex; gap: 0.75rem; align-items: center; padding: var(--space-3); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md);">
              <input
                type="checkbox"
                bind:checked={formData.constraints.impactFilter}
                aria-describedby="constraints-help"
              />
              <span>Gelenkschonend (nur Low-Impact)</span>
            </label>
          </fieldset>
        {/if}

        {#if step === "ready"}
          <div style="display: grid; gap: var(--space-3);">
            <h2 style="margin: 0;">Ready to start</h2>
            <p style="margin: 0; color: var(--color-text-secondary);">
              Review your setup before saving.
            </p>
            <div style="display: grid; gap: var(--space-3); padding: var(--space-4); border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: rgba(255,255,255,0.03);">
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
            style="padding: 0.85rem 1rem; border: 1px solid var(--color-border-subtle); border-radius: var(--radius-md); background: transparent; color: inherit; font-weight: 700;"
          >
            Back
          </button>

          {#if step !== "ready"}
            <button
              type="button"
              onclick={nextStep}
              style="padding: 0.85rem 1rem; border: 0; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-accent-text); font-weight: 700;"
            >
              Next
            </button>
          {:else}
            <button
              type="button"
              onclick={completeOnboarding}
              disabled={isSubmitting}
              style="padding: 0.85rem 1rem; border: 0; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-accent-text); font-weight: 700;"
            >
              {isSubmitting ? "Saving…" : "Finish onboarding"}
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </section>
</main>