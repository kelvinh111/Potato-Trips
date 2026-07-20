import { PLANNING_SESSION_LIFETIME_MS } from "@/lib/planning-sessions/constants";

export function getPlanningSessionExpiryFrom(baseDate: Date = new Date()): Date {
  return new Date(baseDate.getTime() + PLANNING_SESSION_LIFETIME_MS);
}

export function isPlanningSessionExpired(
  expiresAt: Date,
  now: Date = new Date(),
): boolean {
  return expiresAt.getTime() <= now.getTime();
}
