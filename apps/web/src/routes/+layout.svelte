<script lang="ts">
import "../app.css";
import { registerSW } from "virtual:pwa-register";
import { onMount } from "svelte";

import { api } from "$lib/api";
import { createAudioSettings } from "$lib/context/audio-settings.svelte.ts";
import { createAuthSession } from "$lib/context/auth-session.svelte.ts";
import { createTimerState } from "$lib/context/timer-state.svelte.ts";
import { createWorkoutSession } from "$lib/context/workout-session.svelte.ts";
import { offlineStore } from "$lib/db/offline-store";
import { getSyncStatus, syncPendingOps } from "$lib/sync";

const authSession = createAuthSession();
const workoutSession = createWorkoutSession();
createTimerState();
createAudioSettings();
let isOffline = $state(false);
let swUpdateAvailable = $state(false);
let swUpdateError = $state<string | null>(null);
let lastSyncedUserId = $state<string | null>(null);
let syncState = $state<Awaited<ReturnType<typeof getSyncStatus>> | null>(null);
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null =
  null;

async function refreshSyncState() {
  if (!authSession.isAuthenticated) {
    syncState = null;
    return;
  }

  syncState = await getSyncStatus();
}

onMount(() => {
  isOffline = !navigator.onLine;
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      swUpdateAvailable = true;
      swUpdateError = null;
    },
  });

  const handleOnline = () => {
    isOffline = false;

    if (authSession.isAuthenticated) {
      void syncPendingOps()
        .then(() => refreshSyncState())
        .catch((error) => {
          console.error("Failed to sync pending offline operations", error);
        });
    }
  };
  const handleOffline = () => {
    isOffline = true;
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  authSession.initialize().catch((error) => {
    console.error("Failed to initialize auth session", error);
  });

  void refreshSyncState();

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
});

$effect(() => {
  if (!authSession.isAuthenticated) {
    lastSyncedUserId = null;
    syncState = null;
    return;
  }

  if (authSession.userId === lastSyncedUserId) {
    return;
  }

  lastSyncedUserId = authSession.userId;
  void syncPendingOps()
    .then(() => {
      if (navigator.onLine) {
        api
          .getActivePlan()
          .then((p) => offlineStore.cacheActivePlan(p))
          .catch(() => {});
      }

      return refreshSyncState();
    })
    .catch((error) => {
      console.error("Failed to sync pending offline operations", error);
    });
});

$effect(() => {
  if (
    !swUpdateAvailable ||
    workoutSession.phase !== "summary" ||
    !updateServiceWorker
  ) {
    return;
  }

  if (syncState?.workoutActive || (syncState?.pendingCount ?? 0) > 0) {
    return;
  }

  void updateServiceWorker(true).catch((error) => {
    swUpdateError = "Unable to apply the latest app update.";
    console.error("Failed to activate service worker update", error);
  });
});

const { children } = $props();
</script>

{#if isOffline}
  <div
    role="status"
    aria-live="polite"
    style="position: sticky; top: 0; z-index: 30; padding: 0.85rem 1rem; background: rgba(245, 158, 11, 0.16); border-bottom: 1px solid rgba(245, 158, 11, 0.35); color: #fcd34d; text-align: center; font-weight: 600;"
  >
    Offline mode. Logged sets stay on this device and sync automatically when you reconnect.
  </div>
{/if}

{#if swUpdateAvailable}
  <div
    role="status"
    aria-live="polite"
    style="position: sticky; top: 0; z-index: 20; padding: 0.85rem 1rem; background: rgba(59, 130, 246, 0.16); border-bottom: 1px solid rgba(59, 130, 246, 0.35); color: #bfdbfe; text-align: center; font-weight: 600;"
  >
    Update bereit — wird nach deinem Training angewendet.
  </div>
{/if}

{#if swUpdateError}
  <div
    role="alert"
    style="position: sticky; top: 0; z-index: 10; padding: 0.85rem 1rem; background: rgba(248, 113, 113, 0.16); border-bottom: 1px solid rgba(248, 113, 113, 0.35); color: #fecaca; text-align: center; font-weight: 600;"
  >
    {swUpdateError}
  </div>
{/if}

{#if authSession.isAuthenticated && syncState && (syncState.pendingCount > 0 || syncState.blockedReason || syncState.storageStatus === "recovery")}
  <div
    role="status"
    aria-live="polite"
    style="position: sticky; top: 0; z-index: 5; padding: 0.85rem 1rem; background: rgba(34, 197, 94, 0.14); border-bottom: 1px solid rgba(34, 197, 94, 0.28); color: #bbf7d0; text-align: center; font-weight: 600;"
  >
    {#if syncState.storageStatus === "recovery"}
      Offline storage needs recovery before new synced data can be trusted.
    {:else if syncState.blockedReason === "reauthentication"}
      Sync blocked until you sign in again. {syncState.pendingCount} item(s) remain queued.
    {:else if syncState.blockedReason}
      Sync blocked. {syncState.pendingCount} item(s) remain queued.
    {:else}
      {syncState.pendingCount} item(s) queued for sync.
      {#if syncState.lastSuccessfulReplayAt}
        Last replay {new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(syncState.lastSuccessfulReplayAt))}.
      {/if}
    {/if}
  </div>
{/if}

{@render children()}