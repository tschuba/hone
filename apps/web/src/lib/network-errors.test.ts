import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { isBackendUnavailableError } from "./network-errors";

describe("isBackendUnavailableError", () => {
  let originalOnLine: boolean | undefined;

  beforeEach(() => {
    originalOnLine = navigator.onLine;
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: originalOnLine,
    });
  });

  function setOnLine(value: boolean) {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value,
    });
  }

  it("does not mask a real 400 error just because navigator.onLine is false", () => {
    setOnLine(false);

    expect(isBackendUnavailableError({ status: 400, title: "Bad input" })).toBe(
      false,
    );
  });

  it("does not mask a real 401 error just because navigator.onLine is false", () => {
    setOnLine(false);

    expect(
      isBackendUnavailableError({ status: 401, title: "Unauthorized" }),
    ).toBe(false);
  });

  it("treats a 503 error as backend-unavailable even when navigator.onLine is true", () => {
    setOnLine(true);

    expect(
      isBackendUnavailableError({ status: 503, title: "Service Unavailable" }),
    ).toBe(true);
  });

  it("falls back to navigator.onLine when the error carries no HTTP status", () => {
    setOnLine(false);

    expect(isBackendUnavailableError(new Error("something exploded"))).toBe(
      true,
    );
  });

  it("treats a fetch TypeError as backend-unavailable when online", () => {
    setOnLine(true);

    expect(isBackendUnavailableError(new TypeError("Failed to fetch"))).toBe(
      true,
    );
  });
});
