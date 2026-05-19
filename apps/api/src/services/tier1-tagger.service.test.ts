import { describe, expect, it } from "bun:test";

import { Tier1Tagger } from "./tier1-tagger.service";

describe("Tier1Tagger", () => {
  it("tags knee-load modifier for squats", () => {
    const tagger = new Tier1Tagger();

    const tags = tagger.tag({
      category: "legs",
      nameEn: "Barbell Squat",
    });

    expect(tags).toContainEqual({
      category: "MODIFIER",
      confidence: 0.85,
      source: "heuristic",
      value: "knee_load",
    });
  });

  it("tags back-load modifier for deadlifts", () => {
    const tagger = new Tier1Tagger();

    const tags = tagger.tag({
      category: "back",
      nameEn: "Romanian Deadlift",
    });

    expect(tags).toContainEqual({
      category: "MODIFIER",
      confidence: 0.85,
      source: "heuristic",
      value: "back_load",
    });
  });
});
