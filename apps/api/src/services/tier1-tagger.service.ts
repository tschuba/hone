type ExerciseTagInput = {
  category: "MODIFIER";
  confidence: number;
  source: "heuristic";
  value: string;
};

const KNEE_LOAD_PATTERNS = [/squat/i, /lunge/i, /leg press/i, /step.?up/i];
const BACK_LOAD_PATTERNS = [/deadlift/i, /good morning/i, /bent.?over/i];

export class Tier1Tagger {
  tag(exercise: { category: string; nameEn: string }) {
    const tags: ExerciseTagInput[] = [];

    if (KNEE_LOAD_PATTERNS.some((pattern) => pattern.test(exercise.nameEn))) {
      tags.push({
        category: "MODIFIER",
        confidence: 0.85,
        source: "heuristic",
        value: "knee_load",
      });
    }

    if (BACK_LOAD_PATTERNS.some((pattern) => pattern.test(exercise.nameEn))) {
      tags.push({
        category: "MODIFIER",
        confidence: 0.85,
        source: "heuristic",
        value: "back_load",
      });
    }

    return tags;
  }
}
