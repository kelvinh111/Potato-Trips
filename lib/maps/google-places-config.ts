import "server-only";

export const GOOGLE_PLACES_TEXT_SEARCH_ENDPOINT =
  "https://places.googleapis.com/v1/places:searchText";
export const GOOGLE_PLACES_TEXT_SEARCH_FIELD_MASK =
  "places.id,places.displayName.text,places.location";
export const GOOGLE_PLACE_DETAILS_ENDPOINT_PREFIX =
  "https://places.googleapis.com/v1/places/";
export const GOOGLE_PLACE_DETAILS_FIELD_MASK =
  "id,displayName.text,primaryTypeDisplayName.text,formattedAddress,googleMapsUri";
export const GOOGLE_PLACES_REQUEST_TIMEOUT_MS = 5000;

export interface GooglePlacesServerConfig {
  apiKey: string;
}

export type GooglePlacesProviderAvailability =
  | { ok: true }
  | {
      ok: false;
      reason: "CONFIGURATION";
      providerWide: true;
    };

export function parseGooglePlacesServerConfig(
  env: Record<string, string | undefined>,
): GooglePlacesServerConfig | null {
  const apiKey = env.GOOGLE_PLACES_API_KEY?.trim();

  if (!apiKey) {
    return null;
  }

  return { apiKey };
}

export function getGooglePlacesProviderAvailability(
  env: Record<string, string | undefined> = process.env,
): GooglePlacesProviderAvailability {
  const config = parseGooglePlacesServerConfig(env);

  if (!config) {
    return {
      ok: false,
      reason: "CONFIGURATION",
      providerWide: true,
    };
  }

  return { ok: true };
}
