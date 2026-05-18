import { getContext, setContext } from "svelte";

const AUDIO_SETTINGS_KEY = Symbol("audio-settings");

class AudioSettingsContext {
  ttsEnabled = $state(false);
  beepsEnabled = $state(false);
  vibrationEnabled = $state(false);
  autoAdvanceEnabled = $state(false);
}

export function createAudioSettings() {
  return setContext(AUDIO_SETTINGS_KEY, new AudioSettingsContext());
}

export function useAudioSettings() {
  return getContext<AudioSettingsContext>(AUDIO_SETTINGS_KEY);
}
