<script lang="ts">
import "../app.css";

import { createAudioSettings } from "$lib/context/audio-settings.svelte.ts";
import { createTimerState } from "$lib/context/timer-state.svelte.ts";
import { createWorkoutSession } from "$lib/context/workout-session.svelte.ts";

createWorkoutSession();
createTimerState();
createAudioSettings();

const { children } = $props();
</script>

{@render children()}