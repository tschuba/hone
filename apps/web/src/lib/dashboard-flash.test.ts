import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { consumeDashboardFlash, setDashboardFlash } from "./dashboard-flash";

type StorageLike = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();

  return {
    getItem(key) {
      return store.get(key) ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

describe("dashboard flash", () => {
  beforeEach(() => {
    (globalThis as { sessionStorage?: StorageLike }).sessionStorage =
      createMemoryStorage();
  });

  afterEach(() => {
    (globalThis as { sessionStorage?: StorageLike }).sessionStorage = undefined;
  });

  it("round-trips a success flash and clears it after reading", () => {
    setDashboardFlash({ kind: "success", message: "Done" });

    expect(consumeDashboardFlash()).toEqual({
      kind: "success",
      message: "Done",
    });
    expect(consumeDashboardFlash()).toBeNull();
  });

  it("round-trips an error flash", () => {
    setDashboardFlash({ kind: "error", message: "Something failed" });

    expect(consumeDashboardFlash()).toEqual({
      kind: "error",
      message: "Something failed",
    });
  });

  it("returns null when nothing was set", () => {
    expect(consumeDashboardFlash()).toBeNull();
  });

  it("returns null and clears storage for malformed JSON instead of throwing", () => {
    sessionStorage.setItem("dashboard-flash", "{not json");

    expect(consumeDashboardFlash()).toBeNull();
    expect(sessionStorage.getItem("dashboard-flash")).toBeNull();
  });

  it("returns null for a well-formed payload with an unrecognized kind", () => {
    sessionStorage.setItem(
      "dashboard-flash",
      JSON.stringify({ kind: "warning", message: "huh" }),
    );

    expect(consumeDashboardFlash()).toBeNull();
  });

  it("does not throw when sessionStorage is unavailable", () => {
    (globalThis as { sessionStorage?: StorageLike }).sessionStorage = undefined;

    expect(() =>
      setDashboardFlash({ kind: "error", message: "x" }),
    ).not.toThrow();
    expect(consumeDashboardFlash()).toBeNull();
  });
});
