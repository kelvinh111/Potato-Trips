import { PLANNING_SESSION_STORAGE_KEY } from "@/lib/planning-sessions/constants";

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function savePlanningSessionId(sessionId: string): void {
  const storage = getBrowserStorage();

  if (!storage) {
    return;
  }

  const normalized = sessionId.trim();

  if (!normalized) {
    return;
  }

  try {
    storage.setItem(PLANNING_SESSION_STORAGE_KEY, normalized);
  } catch {
    // Intentionally no-op when storage is unavailable or blocked.
  }
}

export function readPlanningSessionId(): string | null {
  const storage = getBrowserStorage();

  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(PLANNING_SESSION_STORAGE_KEY);

    if (!value) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

export function clearPlanningSessionId(): void {
  const storage = getBrowserStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(PLANNING_SESSION_STORAGE_KEY);
  } catch {
    // Intentionally no-op when storage is unavailable or blocked.
  }
}
