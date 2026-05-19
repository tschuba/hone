<script lang="ts">
import "../app.css";
import { onMount } from "svelte";

import { createAudioSettings } from "$lib/context/audio-settings.svelte.ts";
import { createAuthSession } from "$lib/context/auth-session.svelte.ts";
import { createTimerState } from "$lib/context/timer-state.svelte.ts";
import { createWorkoutSession } from "$lib/context/workout-session.svelte.ts";

const authSession = createAuthSession();
createWorkoutSession();
createTimerState();
createAudioSettings();

onMount(() => {
  authSession.initialize().catch((error) => {
    console.error("Failed to initialize auth session", error);
  });
});

const { children } = $props();
</script>

{@render children()}