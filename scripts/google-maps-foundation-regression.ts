import assert from "node:assert/strict";

import {
  WORKSPACE_DESKTOP_MEDIA_QUERY,
  deriveGeneratedMapPanelStatus,
  isStaleMapInitializationResult,
  readGoogleMapsPublicConfig,
  shouldDisplayGeneratedDesktopMapPanel,
  shouldInitializeGoogleMap,
} from "@/lib/maps/google-maps-foundation";
import type { PlanningSessionStatusValue } from "@/lib/planning-sessions/types";

function testConfigParsing() {
  assert.equal(
    readGoogleMapsPublicConfig({
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "",
      NEXT_PUBLIC_GOOGLE_MAP_ID: "demo-map-id",
    }),
    null,
  );

  assert.equal(
    readGoogleMapsPublicConfig({
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: "demo-key",
      NEXT_PUBLIC_GOOGLE_MAP_ID: "",
    }),
    null,
  );

  assert.deepEqual(
    readGoogleMapsPublicConfig({
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: " demo-key ",
      NEXT_PUBLIC_GOOGLE_MAP_ID: " demo-map-id ",
    }),
    {
      apiKey: "demo-key",
      mapId: "demo-map-id",
    },
  );
}

function testDesktopMediaQuery() {
  assert.equal(WORKSPACE_DESKTOP_MEDIA_QUERY, "(min-width: 64rem)");
}

function testDisplayEligibility() {
  const statuses: PlanningSessionStatusValue[] = [
    "CLARIFYING",
    "READY_TO_GENERATE",
    "GENERATING",
    "GENERATED",
    "FAILED",
  ];

  for (const status of statuses) {
    const shouldDisplayOnDesktop = shouldDisplayGeneratedDesktopMapPanel(
      status,
      true,
    );

    assert.equal(shouldDisplayOnDesktop, status === "GENERATED");

    assert.equal(
      shouldDisplayGeneratedDesktopMapPanel(status, false),
      false,
    );
  }
}

function testInitializationEligibility() {
  assert.equal(
    shouldInitializeGoogleMap({
      status: "CLARIFYING",
      isMapPanelDisplayed: true,
      hasConfig: true,
    }),
    false,
  );

  assert.equal(
    shouldInitializeGoogleMap({
      status: "GENERATED",
      isMapPanelDisplayed: false,
      hasConfig: true,
    }),
    false,
  );

  assert.equal(
    shouldInitializeGoogleMap({
      status: "GENERATED",
      isMapPanelDisplayed: true,
      hasConfig: false,
    }),
    false,
  );

  assert.equal(
    shouldInitializeGoogleMap({
      status: "GENERATED",
      isMapPanelDisplayed: true,
      hasConfig: true,
    }),
    true,
  );
}

function testDerivedPanelStatus() {
  assert.equal(
    deriveGeneratedMapPanelStatus({
      hasConfig: false,
      hasAuthFailure: false,
      hasLoadFailure: false,
      hasRenderFailure: false,
      hasMapReadySignal: false,
    }),
    "unavailable",
  );

  assert.equal(
    deriveGeneratedMapPanelStatus({
      hasConfig: true,
      hasAuthFailure: true,
      hasLoadFailure: false,
      hasRenderFailure: false,
      hasMapReadySignal: false,
    }),
    "error",
  );

  assert.equal(
    deriveGeneratedMapPanelStatus({
      hasConfig: true,
      hasAuthFailure: false,
      hasLoadFailure: true,
      hasRenderFailure: false,
      hasMapReadySignal: false,
    }),
    "error",
  );

  assert.equal(
    deriveGeneratedMapPanelStatus({
      hasConfig: true,
      hasAuthFailure: false,
      hasLoadFailure: false,
      hasRenderFailure: false,
      hasMapReadySignal: false,
    }),
    "loading",
  );

  assert.equal(
    deriveGeneratedMapPanelStatus({
      hasConfig: true,
      hasAuthFailure: false,
      hasLoadFailure: false,
      hasRenderFailure: false,
      hasMapReadySignal: true,
    }),
    "ready",
  );
}

function testStaleInitializationGuard() {
  assert.equal(
    isStaleMapInitializationResult({
      isComponentActive: false,
      requestId: 1,
      activeRequestId: 1,
    }),
    true,
  );

  assert.equal(
    isStaleMapInitializationResult({
      isComponentActive: true,
      requestId: 1,
      activeRequestId: 2,
    }),
    true,
  );

  assert.equal(
    isStaleMapInitializationResult({
      isComponentActive: true,
      requestId: 3,
      activeRequestId: 3,
    }),
    false,
  );
}

function run() {
  testConfigParsing();
  testDesktopMediaQuery();
  testDisplayEligibility();
  testInitializationEligibility();
  testDerivedPanelStatus();
  testStaleInitializationGuard();

  console.log("google-maps-foundation-regression: pass");
}

run();
