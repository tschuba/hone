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

  if (
    error instanceof TypeError &&
    /failed to fetch|networkerror|load failed/i.test(error.message)
  ) {
    return true;
  }

  const status = getErrorStatus(error);

  return status === 502 || status === 503 || status === 504;
}

export function createOfflineUnavailableError(title: string) {
  return {
    status: 503,
    title,
  };
}

export function createStorageRecoveryError(title: string) {
  return {
    status: 507,
    title,
  };
}

export function createSyncBlockedError(
  title: string,
  reason: "blocked" | "reauthentication" | "conflict" | "storage",
) {
  return {
    reason,
    status: 409,
    title,
  };
}
