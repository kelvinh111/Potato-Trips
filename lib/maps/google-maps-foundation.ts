import type { PlanningSessionStatusValue } from "@/lib/planning-sessions/types";

export const WORKSPACE_DESKTOP_MEDIA_QUERY = "(min-width: 64rem)";

export interface GoogleMapsPublicConfig {
  apiKey: string;
  mapId: string;
}

interface ShouldInitializeGoogleMapInput {
  status: PlanningSessionStatusValue;
  isMapPanelDisplayed: boolean;
  hasConfig: boolean;
}

interface DeriveGeneratedMapPanelStatusInput {
  hasConfig: boolean;
  hasAuthFailure: boolean;
  hasLoadFailure: boolean;
  hasRenderFailure: boolean;
  hasMapReadySignal: boolean;
}

interface IsStaleMapInitializationResultInput {
  isComponentActive: boolean;
  requestId: number;
  activeRequestId: number;
}

export type GeneratedMapPanelStatus = "loading" | "ready" | "unavailable" | "error";

function normalizePublicValue(value: string | undefined): string | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  return normalized;
}

export function readGoogleMapsPublicConfig(
  env: Record<string, string | undefined> = process.env,
): GoogleMapsPublicConfig | null {
  const apiKey = normalizePublicValue(env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
  const mapId = normalizePublicValue(env.NEXT_PUBLIC_GOOGLE_MAP_ID);

  if (!apiKey || !mapId) {
    return null;
  }

  return {
    apiKey,
    mapId,
  };
}

export function shouldDisplayGeneratedDesktopMapPanel(
  status: PlanningSessionStatusValue,
  isDesktopLayout: boolean,
): boolean {
  return status === "GENERATED" && isDesktopLayout;
}

export function shouldInitializeGoogleMap({
  status,
  isMapPanelDisplayed,
  hasConfig,
}: ShouldInitializeGoogleMapInput): boolean {
  return status === "GENERATED" && isMapPanelDisplayed && hasConfig;
}

export function deriveGeneratedMapPanelStatus({
  hasConfig,
  hasAuthFailure,
  hasLoadFailure,
  hasRenderFailure,
  hasMapReadySignal,
}: DeriveGeneratedMapPanelStatusInput): GeneratedMapPanelStatus {
  if (!hasConfig) {
    return "unavailable";
  }

  if (hasAuthFailure || hasLoadFailure || hasRenderFailure) {
    return "error";
  }

  if (hasMapReadySignal) {
    return "ready";
  }

  return "loading";
}

export function isStaleMapInitializationResult({
  isComponentActive,
  requestId,
  activeRequestId,
}: IsStaleMapInitializationResultInput): boolean {
  return !isComponentActive || requestId !== activeRequestId;
}
