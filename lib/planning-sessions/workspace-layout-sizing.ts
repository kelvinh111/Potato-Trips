import { useCallback, useEffect, useMemo, useState } from "react";

export const DESKTOP_CHAT_FRACTION = 1 / 6;
export const DESKTOP_CENTER_FRACTION = 3 / 6;
export const DESKTOP_MAP_FRACTION = 2 / 6;
export const DESKTOP_CHAT_MIN_WIDTH = 288;
export const DESKTOP_CENTER_MIN_WIDTH = 360;
export const DESKTOP_MAP_MIN_WIDTH = 320;
const KEYBOARD_STEP_PX = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function deriveDefaultDesktopSplit(input: { containerWidth: number }): {
  chatWidth: number;
  centerWidth: number;
  mapWidth: number;
  centerFractionOfResizableArea: number;
} {
  const preferredChatWidth = Math.round(input.containerWidth * DESKTOP_CHAT_FRACTION);
  const maxChatWidth = Math.max(
    0,
    input.containerWidth - DESKTOP_CENTER_MIN_WIDTH - DESKTOP_MAP_MIN_WIDTH,
  );

  let chatWidth = Math.min(preferredChatWidth, maxChatWidth);

  if (maxChatWidth >= DESKTOP_CHAT_MIN_WIDTH) {
    chatWidth = Math.max(chatWidth, DESKTOP_CHAT_MIN_WIDTH);
  }

  const resizableWidth = Math.max(0, input.containerWidth - chatWidth);
  const centerWidth = Math.round(input.containerWidth * DESKTOP_CENTER_FRACTION);
  const clampedCenterWidth = clamp(
    centerWidth,
    DESKTOP_CENTER_MIN_WIDTH,
    Math.max(DESKTOP_CENTER_MIN_WIDTH, resizableWidth - DESKTOP_MAP_MIN_WIDTH),
  );
  const mapWidth = Math.max(0, resizableWidth - clampedCenterWidth);

  return {
    chatWidth,
    centerWidth: clampedCenterWidth,
    mapWidth,
    centerFractionOfResizableArea:
      resizableWidth > 0 ? clampedCenterWidth / resizableWidth : 0.5,
  };
}

export function deriveClampedCenterWidth(input: {
  containerWidth: number;
  chatWidth: number;
  centerWidth: number;
}): number {
  const resizableWidth = Math.max(0, input.containerWidth - input.chatWidth);
  const minCenter = Math.min(DESKTOP_CENTER_MIN_WIDTH, resizableWidth);
  const maxCenter = Math.max(minCenter, resizableWidth - DESKTOP_MAP_MIN_WIDTH);

  return clamp(input.centerWidth, minCenter, maxCenter);
}

export function useDesktopCenterMapSplit(input: {
  isDesktopLayout: boolean;
  showMapSlot: boolean;
}) {
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [centerFraction, setCenterFraction] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainerElement(node);
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      const width = containerElement?.clientWidth ?? 0;
      setContainerWidth(width);
    };

    updateWidth();

    if (!containerElement) {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(containerElement);

    return () => {
      observer.disconnect();
    };
  }, [containerElement]);

  const layout = useMemo(() => {
    if (!input.isDesktopLayout || !input.showMapSlot || containerWidth <= 0) {
      return null;
    }

    const defaults = deriveDefaultDesktopSplit({ containerWidth });
    const resizableWidth = Math.max(0, containerWidth - defaults.chatWidth);
    const fraction = centerFraction ?? defaults.centerFractionOfResizableArea;
    const centerWidth = deriveClampedCenterWidth({
      containerWidth,
      chatWidth: defaults.chatWidth,
      centerWidth: Math.round(resizableWidth * fraction),
    });
    const mapWidth = Math.max(0, resizableWidth - centerWidth);

    return {
      chatWidth: defaults.chatWidth,
      centerWidth,
      mapWidth,
      resizableWidth,
      separatorValue: centerWidth,
      separatorMin: Math.min(DESKTOP_CENTER_MIN_WIDTH, resizableWidth),
      separatorMax: Math.max(
        Math.min(DESKTOP_CENTER_MIN_WIDTH, resizableWidth),
        resizableWidth - DESKTOP_MAP_MIN_WIDTH,
      ),
    };
  }, [centerFraction, containerWidth, input.isDesktopLayout, input.showMapSlot]);

  const applySeparatorPosition = (centerWidth: number) => {
    if (!layout) {
      return;
    }

    const clamped = deriveClampedCenterWidth({
      containerWidth,
      chatWidth: layout.chatWidth,
      centerWidth,
    });
    const nextFraction = layout.resizableWidth > 0 ? clamped / layout.resizableWidth : 0.5;
    setCenterFraction(nextFraction);
  };

  const handleSeparatorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!layout) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      applySeparatorPosition(layout.centerWidth - KEYBOARD_STEP_PX);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      applySeparatorPosition(layout.centerWidth + KEYBOARD_STEP_PX);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      applySeparatorPosition(layout.separatorMin);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      applySeparatorPosition(layout.separatorMax);
    }
  };

  const handleSeparatorPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!layout) {
      return;
    }

    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSeparatorPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !layout || !containerElement) {
      return;
    }

    const bounds = containerElement.getBoundingClientRect();
    const pointerOffset = event.clientX - bounds.left;
    applySeparatorPosition(pointerOffset - layout.chatWidth);
  };

  const handleSeparatorPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDragging(false);
  };

  return {
    containerRef,
    layout,
    dragging,
    handleSeparatorKeyDown,
    handleSeparatorPointerDown,
    handleSeparatorPointerMove,
    handleSeparatorPointerUp,
  };
}
