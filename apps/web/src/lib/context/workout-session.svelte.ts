import { getContext, setContext } from "svelte";

const WORKOUT_SESSION_KEY = Symbol("workout-session");

export type WorkoutPhase = "idle" | "exercise" | "rest" | "paused" | "summary";

class WorkoutSessionContext {
  phase = $state<WorkoutPhase>("idle");
  currentExerciseIndex = $state(0);
  totalExercises = $state(0);

  start(totalExercises: number) {
    this.phase = "exercise";
    this.currentExerciseIndex = 0;
    this.totalExercises = totalExercises;
  }

  reset() {
    this.phase = "idle";
    this.currentExerciseIndex = 0;
    this.totalExercises = 0;
  }
}

export function createWorkoutSession() {
  return setContext(WORKOUT_SESSION_KEY, new WorkoutSessionContext());
}

export function useWorkoutSession() {
  return getContext<WorkoutSessionContext>(WORKOUT_SESSION_KEY);
}
