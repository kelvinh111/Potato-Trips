import assert from "node:assert/strict";

import {
  DESKTOP_CENTER_FRACTION,
  DESKTOP_CHAT_FRACTION,
  DESKTOP_CHAT_MIN_WIDTH,
  DESKTOP_CENTER_MIN_WIDTH,
  DESKTOP_MAP_FRACTION,
  DESKTOP_MAP_MIN_WIDTH,
  deriveClampedCenterWidth,
  deriveDefaultDesktopSplit,
} from "@/lib/planning-sessions/workspace-layout-sizing";

function approxEqual(actual: number, expected: number, tolerance = 1) {
  assert.equal(Math.abs(actual - expected) <= tolerance, true);
}

function testDefaultFractionsForWideLayout() {
  const containerWidth = 1800;
  const split = deriveDefaultDesktopSplit({ containerWidth });

  approxEqual(split.chatWidth, containerWidth * DESKTOP_CHAT_FRACTION);
  approxEqual(split.centerWidth, containerWidth * DESKTOP_CENTER_FRACTION);
  approxEqual(split.mapWidth, containerWidth * DESKTOP_MAP_FRACTION);
}

function testChatMinimumAppliesWhenPossible() {
  const containerWidth = 1200;
  const split = deriveDefaultDesktopSplit({ containerWidth });

  assert.equal(split.chatWidth >= DESKTOP_CHAT_MIN_WIDTH, true);
  assert.equal(split.centerWidth >= DESKTOP_CENTER_MIN_WIDTH, true);
  assert.equal(split.mapWidth >= DESKTOP_MAP_MIN_WIDTH, true);
  assert.equal(split.chatWidth + split.centerWidth + split.mapWidth, containerWidth);
}

function testCenterClampRespectsMapMinimum() {
  const containerWidth = 1400;
  const split = deriveDefaultDesktopSplit({ containerWidth });

  const tooLargeCenter = deriveClampedCenterWidth({
    containerWidth,
    chatWidth: split.chatWidth,
    centerWidth: 9999,
  });

  const tooSmallCenter = deriveClampedCenterWidth({
    containerWidth,
    chatWidth: split.chatWidth,
    centerWidth: 1,
  });

  const resizableWidth = containerWidth - split.chatWidth;

  assert.equal(tooSmallCenter >= Math.min(DESKTOP_CENTER_MIN_WIDTH, resizableWidth), true);
  assert.equal(tooLargeCenter <= resizableWidth - DESKTOP_MAP_MIN_WIDTH, true);
}

function run() {
  testDefaultFractionsForWideLayout();
  testChatMinimumAppliesWhenPossible();
  testCenterClampRespectsMapMinimum();

  console.log("workspace-layout-sizing-regression: pass");
}

run();
