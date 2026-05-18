import { getContext, setContext } from "svelte";

const TIMER_STATE_KEY = Symbol("timer-state");

class TimerStateContext {
  elapsedMs = $state(0);
  totalMs = $state(0);
  paused = $state(false);

  configure(totalMs: number) {
    this.totalMs = totalMs;
    this.elapsedMs = 0;
    this.paused = false;
  }
}

export function createTimerState() {
  return setContext(TIMER_STATE_KEY, new TimerStateContext());
}

export function useTimerState() {
  return getContext<TimerStateContext>(TIMER_STATE_KEY);
}
