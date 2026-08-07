import type { PlanningSessionStatusValue } from "@/lib/planning-sessions/types";

export const WORKSPACE_DESKTOP_MEDIA_QUERY = "(min-width: 64rem)";

export interface GoogleMapsPublicConfig {
  apiKey: string;
  mapId: string;
}

const NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const NEXT_PUBLIC_GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAP_ID;

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

interface ShouldAttemptMapInitializationInput {
  hasConfig: boolean;
  hasMapReadySignal: boolean;
  hasInitializationFailure: boolean;
  hasInFlightInitialization: boolean;
  hasMapInstance: boolean;
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
): GoogleMapsPublicConfig | null {
  return parseGoogleMapsPublicConfig({
    apiKey: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    mapId: NEXT_PUBLIC_GOOGLE_MAP_ID,
  });
}

export function parseGoogleMapsPublicConfig({
  apiKey,
  mapId,
}: {
  apiKey: string | undefined;
  mapId: string | undefined;
}): GoogleMapsPublicConfig | null {
  const normalizedApiKey = normalizePublicValue(apiKey);
  const normalizedMapId = normalizePublicValue(mapId);

  if (!normalizedApiKey || !normalizedMapId) {
    return null;
  }

  return {
    apiKey: normalizedApiKey,
    mapId: normalizedMapId,
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

export function shouldAttemptMapInitialization({
  hasConfig,
  hasMapReadySignal,
  hasInitializationFailure,
  hasInFlightInitialization,
  hasMapInstance,
}: ShouldAttemptMapInitializationInput): boolean {
  return (
    hasConfig
    && !hasMapReadySignal
    && !hasInitializationFailure
    && !hasInFlightInitialization
    && !hasMapInstance
  );
}
