import assert from "node:assert/strict";

import {
  DESKTOP_CENTER_FRACTION,
  DESKTOP_CHAT_MIN_WIDTH,
  DESKTOP_CENTER_MIN_WIDTH,
  DESKTOP_MAP_FRACTION,
  DESKTOP_MAP_MIN_WIDTH,
  DESKTOP_SEPARATOR_WIDTH,
  deriveDraggedCenterWidth,
  deriveClampedCenterWidth,
  deriveDefaultDesktopSplit,
  shouldStartResizeDrag,
} from "@/lib/planning-sessions/workspace-layout-sizing";

function approxEqual(actual: number, expected: number, tolerance = 1) {
  assert.equal(Math.abs(actual - expected) <= tolerance, true);
}

function testDefaultFractionsForWideLayout() {
  const workspaceWidth = 1800;
  const split = deriveDefaultDesktopSplit({ workspaceWidth });
  const centerMapContentWidth = split.centerMapContentWidth;

  assert.equal(split.centerMapAreaWidth, split.centerMapContentWidth + DESKTOP_SEPARATOR_WIDTH);
  approxEqual(
    split.centerWidth,
    centerMapContentWidth
      * (DESKTOP_CENTER_FRACTION / (DESKTOP_CENTER_FRACTION + DESKTOP_MAP_FRACTION)),
  );
  approxEqual(split.centerWidth + split.mapWidth, centerMapContentWidth);
}

function testChatMinimumAppliesWhenPossible() {
  const workspaceWidth = 1200;
  const split = deriveDefaultDesktopSplit({ workspaceWidth });

  assert.equal(split.chatWidth >= DESKTOP_CHAT_MIN_WIDTH, true);
  assert.equal(split.centerWidth >= DESKTOP_CENTER_MIN_WIDTH, true);
  assert.equal(split.mapWidth >= DESKTOP_MAP_MIN_WIDTH, true);
  assert.equal(
    split.chatWidth + split.centerWidth + split.mapWidth + DESKTOP_SEPARATOR_WIDTH,
    workspaceWidth,
  );
}

function testCenterClampRespectsMapMinimum() {
  const workspaceWidth = 1400;
  const split = deriveDefaultDesktopSplit({ workspaceWidth });
  const centerMapContentWidth = split.centerMapContentWidth;

  const tooLargeCenter = deriveClampedCenterWidth({
    centerMapContentWidth,
    centerWidth: 9999,
  });

  const tooSmallCenter = deriveClampedCenterWidth({
    centerMapContentWidth,
    centerWidth: 1,
  });

  assert.equal(tooSmallCenter >= Math.min(DESKTOP_CENTER_MIN_WIDTH, centerMapContentWidth), true);
  assert.equal(tooLargeCenter <= centerMapContentWidth - DESKTOP_MAP_MIN_WIDTH, true);
}

function testResizeStartPolicy() {
  assert.equal(shouldStartResizeDrag({ button: 0, isPrimary: true }), true);
  assert.equal(shouldStartResizeDrag({ button: 1, isPrimary: true }), false);
  assert.equal(shouldStartResizeDrag({ button: 2, isPrimary: true }), false);
  assert.equal(shouldStartResizeDrag({ button: 0, isPrimary: false }), false);
}

function testDraggedWidthUsesStartDelta() {
  const nextSameWidth = deriveDraggedCenterWidth({
    startCenterWidth: 480,
    startClientX: 200,
    currentClientX: 200,
    centerMapContentWidth: 1000,
  });

  assert.equal(nextSameWidth, 480);

  const nextMovedWidth = deriveDraggedCenterWidth({
    startCenterWidth: 480,
    startClientX: 200,
    currentClientX: 260,
    centerMapContentWidth: 1000,
  });

  assert.equal(nextMovedWidth, 540);
}

function run() {
  testDefaultFractionsForWideLayout();
  testChatMinimumAppliesWhenPossible();
  testCenterClampRespectsMapMinimum();
  testResizeStartPolicy();
  testDraggedWidthUsesStartDelta();

  console.log("workspace-layout-sizing-regression: pass");
}

run();
