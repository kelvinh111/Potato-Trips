import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const DESKTOP_CHAT_FRACTION = 1 / 6;
export const DESKTOP_CENTER_FRACTION = 3 / 6;
export const DESKTOP_MAP_FRACTION = 2 / 6;
export const DESKTOP_CHAT_MIN_WIDTH = 288;
export const DESKTOP_CENTER_MIN_WIDTH = 360;
export const DESKTOP_MAP_MIN_WIDTH = 320;
export const DESKTOP_SEPARATOR_WIDTH = 8;
const KEYBOARD_STEP_PX = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function deriveChatWidth(workspaceWidth: number): number {
  const preferred = Math.round(workspaceWidth * DESKTOP_CHAT_FRACTION);
  const maxAllowed = Math.max(
    0,
    workspaceWidth
      - DESKTOP_CENTER_MIN_WIDTH
      - DESKTOP_MAP_MIN_WIDTH
      - DESKTOP_SEPARATOR_WIDTH,
  );

  let chatWidth = Math.min(preferred, maxAllowed);

  if (maxAllowed >= DESKTOP_CHAT_MIN_WIDTH) {
    chatWidth = Math.max(chatWidth, DESKTOP_CHAT_MIN_WIDTH);
  }

  return chatWidth;
}

export function deriveClampedCenterWidth(input: {
  centerMapContentWidth: number;
  centerWidth: number;
}): number {
  const minCenter = Math.min(DESKTOP_CENTER_MIN_WIDTH, input.centerMapContentWidth);
  const maxCenter = Math.max(minCenter, input.centerMapContentWidth - DESKTOP_MAP_MIN_WIDTH);

  return clamp(input.centerWidth, minCenter, maxCenter);
}

export function deriveDefaultDesktopSplit(input: { workspaceWidth: number }): {
  chatWidth: number;
  centerWidth: number;
  mapWidth: number;
  centerMapAreaWidth: number;
  centerMapContentWidth: number;
} {
  const chatWidth = deriveChatWidth(input.workspaceWidth);
  const centerMapAreaWidth = Math.max(0, input.workspaceWidth - chatWidth);
  const centerMapContentWidth = Math.max(0, centerMapAreaWidth - DESKTOP_SEPARATOR_WIDTH);
  const defaultCenterWidth = Math.round(
    centerMapContentWidth * (DESKTOP_CENTER_FRACTION / (DESKTOP_CENTER_FRACTION + DESKTOP_MAP_FRACTION)),
  );
  const centerWidth = deriveClampedCenterWidth({
    centerMapContentWidth,
    centerWidth: defaultCenterWidth,
  });
  const mapWidth = Math.max(0, centerMapContentWidth - centerWidth);

  return {
    chatWidth,
    centerWidth,
    mapWidth,
    centerMapAreaWidth,
    centerMapContentWidth,
  };
}

export function shouldStartResizeDrag(input: {
  button: number;
  isPrimary: boolean;
}): boolean {
  return input.button === 0 && input.isPrimary;
}

export function deriveDraggedCenterWidth(input: {
  startCenterWidth: number;
  startClientX: number;
  currentClientX: number;
  centerMapContentWidth: number;
}): number {
  const deltaX = input.currentClientX - input.startClientX;
  const nextCenterWidth = input.startCenterWidth + deltaX;

  return deriveClampedCenterWidth({
    centerMapContentWidth: input.centerMapContentWidth,
    centerWidth: nextCenterWidth,
  });
}

interface DesktopCenterMapSplitLayout {
  chatWidth: number;
  centerWidth: number;
  mapWidth: number;
  separatorMin: number;
  separatorMax: number;
  separatorValue: number;
}

interface ActiveResizeDrag {
  pointerId: number;
  startClientX: number;
  startCenterWidth: number;
  separatorElement: HTMLDivElement;
}

export function useDesktopCenterMapSplit(input: {
  isDesktopLayout: boolean;
  showMapSlot: boolean;
}) {
  const [workspaceElement, setWorkspaceElement] = useState<HTMLDivElement | null>(null);
  const [centerMapAreaElement, setCenterMapAreaElement] = useState<HTMLDivElement | null>(null);
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const [centerMapAreaWidth, setCenterMapAreaWidth] = useState(0);
  const [centerWidthOverride, setCenterWidthOverride] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const activeDragRef = useRef<ActiveResizeDrag | null>(null);

  const workspaceRef = useCallback((node: HTMLDivElement | null) => {
    setWorkspaceElement(node);
  }, []);

  const centerMapAreaRef = useCallback((node: HTMLDivElement | null) => {
    setCenterMapAreaElement(node);
  }, []);

  useEffect(() => {
    const updateWidth = () => {
      setWorkspaceWidth(workspaceElement?.clientWidth ?? 0);
    };

    updateWidth();

    if (!workspaceElement) {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(workspaceElement);

    return () => {
      observer.disconnect();
    };
  }, [workspaceElement]);

  useEffect(() => {
    const updateWidth = () => {
      setCenterMapAreaWidth(centerMapAreaElement?.clientWidth ?? 0);
    };

    updateWidth();

    if (!centerMapAreaElement) {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(centerMapAreaElement);

    return () => {
      observer.disconnect();
    };
  }, [centerMapAreaElement]);

  const layout = useMemo<DesktopCenterMapSplitLayout | null>(() => {
    if (!input.isDesktopLayout || !input.showMapSlot || workspaceWidth <= 0 || centerMapAreaWidth <= 0) {
      return null;
    }

    const defaults = deriveDefaultDesktopSplit({ workspaceWidth });
    const measuredContentWidth = Math.max(0, centerMapAreaWidth - DESKTOP_SEPARATOR_WIDTH);
    const defaultCenterWidth = deriveClampedCenterWidth({
      centerMapContentWidth: measuredContentWidth,
      centerWidth: Math.round(measuredContentWidth * (3 / 5)),
    });
    const centerWidth = deriveClampedCenterWidth({
      centerMapContentWidth: measuredContentWidth,
      centerWidth: centerWidthOverride ?? defaultCenterWidth,
    });
    const mapWidth = Math.max(0, measuredContentWidth - centerWidth);

    return {
      chatWidth: defaults.chatWidth,
      centerWidth,
      mapWidth,
      separatorMin: Math.min(DESKTOP_CENTER_MIN_WIDTH, measuredContentWidth),
      separatorMax: Math.max(
        Math.min(DESKTOP_CENTER_MIN_WIDTH, measuredContentWidth),
        measuredContentWidth - DESKTOP_MAP_MIN_WIDTH,
      ),
      separatorValue: centerWidth,
    };
  }, [centerMapAreaWidth, centerWidthOverride, input.isDesktopLayout, input.showMapSlot, workspaceWidth]);

  const endActiveDrag = useCallback(() => {
    const activeDrag = activeDragRef.current;

    if (!activeDrag) {
      return;
    }

    if (activeDrag.separatorElement.hasPointerCapture(activeDrag.pointerId)) {
      activeDrag.separatorElement.releasePointerCapture(activeDrag.pointerId);
    }

    activeDragRef.current = null;
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handleWindowInterrupt = () => {
      endActiveDrag();
    };

    window.addEventListener("blur", handleWindowInterrupt);
    window.addEventListener("contextmenu", handleWindowInterrupt);
    window.addEventListener("pointerup", handleWindowInterrupt);
    window.addEventListener("pointercancel", handleWindowInterrupt);

    return () => {
      window.removeEventListener("blur", handleWindowInterrupt);
      window.removeEventListener("contextmenu", handleWindowInterrupt);
      window.removeEventListener("pointerup", handleWindowInterrupt);
      window.removeEventListener("pointercancel", handleWindowInterrupt);
    };
  }, [endActiveDrag, isResizing]);

  const handleSeparatorKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!layout) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setCenterWidthOverride(
        deriveClampedCenterWidth({
          centerMapContentWidth: layout.centerWidth + layout.mapWidth,
          centerWidth: layout.centerWidth - KEYBOARD_STEP_PX,
        }),
      );
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      setCenterWidthOverride(
        deriveClampedCenterWidth({
          centerMapContentWidth: layout.centerWidth + layout.mapWidth,
          centerWidth: layout.centerWidth + KEYBOARD_STEP_PX,
        }),
      );
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setCenterWidthOverride(layout.separatorMin);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setCenterWidthOverride(layout.separatorMax);
    }
  }, [layout]);

  const handleSeparatorPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!layout) {
      return;
    }

    if (!shouldStartResizeDrag({ button: event.button, isPrimary: event.isPrimary })) {
      return;
    }

    event.preventDefault();

    const separatorElement = event.currentTarget;
    separatorElement.setPointerCapture(event.pointerId);

    activeDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startCenterWidth: layout.centerWidth,
      separatorElement,
    };

    setIsResizing(true);
  }, [layout]);

  const handleSeparatorPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const activeDrag = activeDragRef.current;

    if (!activeDrag || !layout || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    const nextCenterWidth = deriveDraggedCenterWidth({
      startCenterWidth: activeDrag.startCenterWidth,
      startClientX: activeDrag.startClientX,
      currentClientX: event.clientX,
      centerMapContentWidth: layout.centerWidth + layout.mapWidth,
    });

    setCenterWidthOverride(nextCenterWidth);
  }, [layout]);

  const handleSeparatorPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const activeDrag = activeDragRef.current;

    if (!activeDrag || event.pointerId !== activeDrag.pointerId) {
      return;
    }

    endActiveDrag();
  }, [endActiveDrag]);

  const handleSeparatorLostPointerCapture = useCallback(() => {
    endActiveDrag();
  }, [endActiveDrag]);

  return {
    workspaceRef,
    centerMapAreaRef,
    layout,
    isResizing,
    handleSeparatorKeyDown,
    handleSeparatorPointerDown,
    handleSeparatorPointerMove,
    handleSeparatorPointerUp,
    handleSeparatorLostPointerCapture,
    endActiveDrag,
  };
}
