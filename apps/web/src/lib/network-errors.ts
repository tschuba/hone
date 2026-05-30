function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getErrorStatus(error: unknown) {
  if (isRecord(error) && typeof error.status === "number") {
    return error.status;
  }

  return undefined;
}

export function isBackendUnavailableError(error: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  if (error instanceof TypeError) {
    return true;
  }

  const status = getErrorStatus(error);

  return typeof status === "number" && status >= 500;
}

export function createOfflineUnavailableError(title: string) {
  return {
    status: 503,
    title,
  };
}
