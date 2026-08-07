import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

import type { GoogleMapsPublicConfig } from "@/lib/maps/google-maps-foundation";

let hasConfiguredOptions = false;
let mapsLibraryPromise: Promise<google.maps.MapsLibrary> | null = null;

function configureGoogleMapsOptions(config: GoogleMapsPublicConfig) {
  if (hasConfiguredOptions) {
    return;
  }

  setOptions({
    key: config.apiKey,
    v: "weekly",
    mapIds: [config.mapId],
  });

  hasConfiguredOptions = true;
}

export function loadGoogleMapsLibrary(
  config: GoogleMapsPublicConfig,
): Promise<google.maps.MapsLibrary> {
  configureGoogleMapsOptions(config);

  if (!mapsLibraryPromise) {
    mapsLibraryPromise = importLibrary("maps");
  }

  return mapsLibraryPromise;
}
