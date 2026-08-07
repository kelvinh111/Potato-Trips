import assert from "node:assert/strict";

import {
  WORKSPACE_DESKTOP_MEDIA_QUERY,
  deriveGeneratedMapPanelStatus,
  isStaleMapInitializationResult,
  parseGoogleMapsPublicConfig,
  readGoogleMapsPublicConfig,
  shouldAttemptMapInitialization,
  shouldDisplayGeneratedDesktopMapPanel,
  shouldInitializeGoogleMap,
} from "@/lib/maps/google-maps-foundation";
import type { PlanningSessionStatusValue } from "@/lib/planning-sessions/types";

function testConfigParsing() {
  assert.equal(
    parseGoogleMapsPublicConfig({
      apiKey: "",
      mapId: "demo-map-id",
    }),
    null,
  );

  assert.equal(
    parseGoogleMapsPublicConfig({
      apiKey: "demo-key",
      mapId: "",
    }),
    null,
  );

  assert.deepEqual(
    parseGoogleMapsPublicConfig({
      apiKey: " demo-key ",
      mapId: " demo-map-id ",
    }),
    {
      apiKey: "demo-key",
      mapId: "demo-map-id",
    },
  );

  const fromRuntimeEnv = readGoogleMapsPublicConfig();
  if (fromRuntimeEnv !== null) {
    assert.notEqual(fromRuntimeEnv.apiKey.length, 0);
    assert.notEqual(fromRuntimeEnv.mapId.length, 0);
  }
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

function testInitializationAttemptPolicy() {
  assert.equal(
    shouldAttemptMapInitialization({
      hasConfig: true,
      hasMapReadySignal: false,
      hasInitializationFailure: false,
      hasInFlightInitialization: false,
      hasMapInstance: false,
    }),
    true,
  );

  assert.equal(
    shouldAttemptMapInitialization({
      hasConfig: false,
      hasMapReadySignal: false,
      hasInitializationFailure: false,
      hasInFlightInitialization: false,
      hasMapInstance: false,
    }),
    false,
  );

  assert.equal(
    shouldAttemptMapInitialization({
      hasConfig: true,
      hasMapReadySignal: true,
      hasInitializationFailure: false,
      hasInFlightInitialization: false,
      hasMapInstance: false,
    }),
    false,
  );

  assert.equal(
    shouldAttemptMapInitialization({
      hasConfig: true,
      hasMapReadySignal: false,
      hasInitializationFailure: true,
      hasInFlightInitialization: false,
      hasMapInstance: false,
    }),
    false,
  );

  assert.equal(
    shouldAttemptMapInitialization({
      hasConfig: true,
      hasMapReadySignal: false,
      hasInitializationFailure: false,
      hasInFlightInitialization: true,
      hasMapInstance: false,
    }),
    false,
  );

  assert.equal(
    shouldAttemptMapInitialization({
      hasConfig: true,
      hasMapReadySignal: false,
      hasInitializationFailure: false,
      hasInFlightInitialization: false,
      hasMapInstance: true,
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
  testInitializationAttemptPolicy();

  console.log("google-maps-foundation-regression: pass");
}

run();
