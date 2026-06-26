const DASHBOARD_FLASH_KEY = "dashboard-flash";

export type DashboardFlash = { kind: "error" | "success"; message: string };

export function setDashboardFlash(flash: DashboardFlash) {
  if (typeof sessionStorage === "undefined") {
    return;
  }

  sessionStorage.setItem(DASHBOARD_FLASH_KEY, JSON.stringify(flash));
}

export function consumeDashboardFlash(): DashboardFlash | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(DASHBOARD_FLASH_KEY);

  if (!raw) {
    return null;
  }

  sessionStorage.removeItem(DASHBOARD_FLASH_KEY);

  try {
    const parsed = JSON.parse(raw) as Partial<DashboardFlash>;

    if (
      (parsed.kind === "success" || parsed.kind === "error") &&
      typeof parsed.message === "string"
    ) {
      return { kind: parsed.kind, message: parsed.message };
    }
  } catch {
    // Ignore malformed flash data.
  }

  return null;
}
