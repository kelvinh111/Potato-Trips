"use client";

import { useEffect, useRef, useState, type MouseEventHandler } from "react";

import {
  toItineraryKanbanViewModel,
} from "@/lib/planning-sessions/itinerary-kanban";
import type { PersistedItinerary } from "@/lib/planning-sessions/types";

interface ItineraryKanbanBoardProps {
  itinerary: PersistedItinerary | null;
}

export function ItineraryKanbanBoard({ itinerary }: ItineraryKanbanBoardProps) {
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const boardStripRef = useRef<HTMLOListElement | null>(null);
  const scrollbarDockRef = useRef<HTMLDivElement | null>(null);
  const syncingFromBoardRef = useRef(false);
  const syncingFromDockRef = useRef(false);
  const isMiddlePanningRef = useRef(false);
  const lastPointerXRef = useRef(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  useEffect(() => {
    const updateScrollbarWidth = () => {
      const boardStrip = boardStripRef.current;
      if (!boardStrip) {
        setScrollbarWidth(0);
        return;
      }

      setScrollbarWidth(boardStrip.scrollWidth);
    };

    updateScrollbarWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateScrollbarWidth();
    });

    if (boardStripRef.current) {
      resizeObserver.observe(boardStripRef.current);
    }

    if (boardScrollRef.current) {
      resizeObserver.observe(boardScrollRef.current);
    }

    window.addEventListener("resize", updateScrollbarWidth);

    return () => {
      window.removeEventListener("resize", updateScrollbarWidth);
      resizeObserver.disconnect();
    };
  }, [itinerary]);

  useEffect(() => {
    const handleWindowMouseMove = (event: MouseEvent) => {
      if (!isMiddlePanningRef.current) {
        return;
      }

      const boardScroll = boardScrollRef.current;
      if (!boardScroll) {
        return;
      }

      const deltaX = event.clientX - lastPointerXRef.current;
      lastPointerXRef.current = event.clientX;
      boardScroll.scrollLeft -= deltaX;
    };

    const stopMiddlePanning = () => {
      if (!isMiddlePanningRef.current) {
        return;
      }

      isMiddlePanningRef.current = false;
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", stopMiddlePanning);
    window.addEventListener("blur", stopMiddlePanning);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", stopMiddlePanning);
      window.removeEventListener("blur", stopMiddlePanning);
      stopMiddlePanning();
    };
  }, []);

  const handleBoardScroll = () => {
    const boardScroll = boardScrollRef.current;
    const scrollbarDock = scrollbarDockRef.current;

    if (!boardScroll || !scrollbarDock || syncingFromDockRef.current) {
      return;
    }

    syncingFromBoardRef.current = true;
    scrollbarDock.scrollLeft = boardScroll.scrollLeft;
    requestAnimationFrame(() => {
      syncingFromBoardRef.current = false;
    });
  };

  const handleDockScroll = () => {
    const boardScroll = boardScrollRef.current;
    const scrollbarDock = scrollbarDockRef.current;

    if (!boardScroll || !scrollbarDock || syncingFromBoardRef.current) {
      return;
    }

    syncingFromDockRef.current = true;
    boardScroll.scrollLeft = scrollbarDock.scrollLeft;
    requestAnimationFrame(() => {
      syncingFromDockRef.current = false;
    });
  };

  const handlePanelMouseDown: MouseEventHandler<HTMLDivElement> = (event) => {
    if (event.button !== 1) {
      return;
    }

    event.preventDefault();
    isMiddlePanningRef.current = true;
    lastPointerXRef.current = event.clientX;
    document.body.style.cursor = "ew-resize";
  };

  if (!itinerary) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div
          role="status"
          aria-live="polite"
          className="flex h-full min-h-48 items-center justify-center rounded-3xl border border-dashed border-border-default p-8 text-center"
        >
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-text-primary">
              Itinerary unavailable
            </h2>
            <p className="max-w-md text-sm text-text-secondary">
              This plan was marked generated, but no itinerary payload is available.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const board = toItineraryKanbanViewModel(itinerary);

  return (
    <div
      className="min-h-0 flex h-full flex-1 flex-col overflow-hidden"
      onMouseDown={handlePanelMouseDown}
    >
      <div className="min-h-0 flex-1 py-6 pl-6 pr-3 sm:py-5 sm:pl-5 sm:pr-3">
        <div className="h-full overflow-y-auto pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.95)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/95 [&::-webkit-scrollbar-corner]:bg-transparent sm:pr-2">
          <div className="min-w-0 space-y-5">
        <header className="space-y-2">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
            {board.title}
          </h2>
          <p className="text-sm text-text-secondary sm:text-base">{board.summary}</p>
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
            <div>
              <dt className="sr-only">Total days</dt>
              <dd>
                {board.dayCount} {board.dayCount === 1 ? "day" : "days"}
              </dd>
            </div>
            <div>
              <dt className="sr-only">Total itinerary items</dt>
              <dd>
                {board.totalItemCount} {board.totalItemCount === 1 ? "item" : "items"}
              </dd>
            </div>
          </dl>
        </header>

          <div
            ref={boardScrollRef}
            onScroll={handleBoardScroll}
            className="w-full overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <ol ref={boardStripRef} className="flex min-w-max items-start gap-4">
              {board.days.map((day) => (
                <li key={day.id} className="w-[18rem] shrink-0 sm:w-[19rem] lg:w-[20rem]">
                  <article className="flex flex-col rounded-2xl border border-border-subtle bg-bg-surface p-3">
                    <header className="space-y-1 border-b border-border-subtle pb-3">
                      <h3 className="text-base font-semibold text-text-primary">
                        {day.dayLabel}
                      </h3>
                      {day.summary ? (
                        <p className="text-sm text-text-secondary">{day.summary}</p>
                      ) : null}
                    </header>

                    <ol className="mt-3 space-y-3">
                      {day.items.map((item) => {
                        const timeAndDurationParts = [
                          item.suggestedTime,
                          item.suggestedDurationLabel,
                        ].filter((part): part is string => {
                          return part !== null;
                        });

                        return (
                          <li key={item.id}>
                            <article className="space-y-2 rounded-xl border border-border-subtle bg-bg-elevated px-3 py-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                                {item.typeLabel}
                              </p>
                              <h4 className="text-sm font-semibold text-text-primary">
                                {item.title}
                              </h4>
                              <p className="text-sm text-text-secondary">{item.description}</p>
                              <p className="text-sm text-text-primary">{item.planningText}</p>
                              {timeAndDurationParts.length > 0 ? (
                                <p className="text-xs text-text-muted">
                                  {timeAndDurationParts.join(" • ")}
                                </p>
                              ) : null}
                            </article>
                          </li>
                        );
                      })}
                    </ol>
                  </article>
                </li>
              ))}
            </ol>
          </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 pb-3 pl-6 pr-3 sm:pb-3 sm:pl-5 sm:pr-3">
        <div
          ref={scrollbarDockRef}
          onScroll={handleDockScroll}
          className="overflow-x-auto overflow-y-hidden pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.95)_transparent] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/95 [&::-webkit-scrollbar-corner]:bg-transparent sm:pr-2"
          aria-label="Kanban horizontal scrollbar"
        >
          <div style={{ width: `${scrollbarWidth}px`, height: "1px" }} />
        </div>
      </div>
    </div>
  );
}