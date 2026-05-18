export interface WorkoutTemplate {
  id: string;
}

export interface MesocyclusPlan {
  id: string;
  workoutsPerWeek: number;
  durationWeeks: number;
  workouts: WorkoutTemplate[];
}

export function validatePlan(_plan: unknown): MesocyclusPlan {
  throw new Error("Not implemented - see Sprint 4");
}
