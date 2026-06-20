"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import InfiniteScrollDownHint from "@/components/common/InfiniteScrollDownHint";
import {
  getOrangeScrollHasMoreSnapshot,
  ORANGE_SCROLL_HAS_MORE_EVENT,
} from "@/lib/orange-scroll-area-events";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
  /** true면 커스텀 오렌지 스크롤바 UI 사용 */
  useCustomScroll?: boolean;
  /** true면 아래로 더 스크롤할 수 있을 때 하단 화살표 표시 */
  showScrollDownHint?: boolean;
};

const NEAR_END_THRESHOLD_PX = 240;
const SCROLL_DOWN_STEP_MIN_PX = 240;

function scrollViewportOnePage(viewport: HTMLDivElement) {
  const distanceToBottom =
    viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
  const delta = Math.max(
    SCROLL_DOWN_STEP_MIN_PX,
    Math.min(Math.round(viewport.clientHeight * 0.85), distanceToBottom),
  );

  if (delta <= 0) {
    dispatchNearEndIfNeeded(viewport);
    return;
  }

  viewport.scrollBy({ top: delta, behavior: "smooth" });

  window.setTimeout(() => {
    dispatchNearEndIfNeeded(viewport);
  }, 350);
}

function shouldShowScrollDownHint(
  viewport: HTMLDivElement,
  enabled: boolean,
  hasMoreBelow: boolean,
) {
  if (!enabled) {
    return false;
  }

  if (hasMoreBelow) {
    return true;
  }

  const { clientHeight, scrollHeight, scrollTop } = viewport;
  const distanceToBottom = scrollHeight - scrollTop - clientHeight;
  const atBottom = distanceToBottom <= 1;
  const canScroll = scrollHeight > clientHeight + 1;

  return canScroll && !atBottom;
}

function dispatchNearEndIfNeeded(viewport: HTMLDivElement) {
  const distanceToBottom =
    viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

  if (
    viewport.scrollHeight <= viewport.clientHeight + 1 ||
    distanceToBottom <= NEAR_END_THRESHOLD_PX
  ) {
    window.dispatchEvent(new CustomEvent("orange-scroll-area-near-end"));
  }
}

type ScrollAreaContentProps = Omit<Props, "useCustomScroll">;

function useScrollDownHintState(enabled: boolean) {
  const [scrollHintVisible, setScrollHintVisible] = useState(false);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setHasMoreBelow(false);
      return;
    }

    setHasMoreBelow(getOrangeScrollHasMoreSnapshot());

    const handleHasMore = (event: Event) => {
      const { hasMore } = (event as CustomEvent<{ hasMore: boolean }>).detail;
      setHasMoreBelow(Boolean(hasMore));
    };

    window.addEventListener(ORANGE_SCROLL_HAS_MORE_EVENT, handleHasMore);

    return () => {
      window.removeEventListener(ORANGE_SCROLL_HAS_MORE_EVENT, handleHasMore);
      setHasMoreBelow(false);
    };
  }, [enabled]);

  return { scrollHintVisible, setScrollHintVisible, hasMoreBelow };
}

function NativeOrangeScrollArea({
  children,
  className = "",
  showScrollDownHint = false,
}: ScrollAreaContentProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const { scrollHintVisible, setScrollHintVisible, hasMoreBelow } =
    useScrollDownHintState(showScrollDownHint);

  const updateScrollHint = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      setScrollHintVisible(false);
      return;
    }

    setScrollHintVisible(
      shouldShowScrollDownHint(viewport, showScrollDownHint, hasMoreBelow),
    );
  }, [hasMoreBelow, showScrollDownHint, setScrollHintVisible]);

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current;

    updateScrollHint();

    if (!viewport) {
      return;
    }

    dispatchNearEndIfNeeded(viewport);
  }, [updateScrollHint]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const viewport = viewportRef.current;

      if (!viewport || event.deltaY <= 0) {
        return;
      }

      updateScrollHint();
      dispatchNearEndIfNeeded(viewport);
    },
    [updateScrollHint],
  );

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    updateScrollHint();

    const resizeObserver = new ResizeObserver(updateScrollHint);
    resizeObserver.observe(viewport);

    const mutationObserver = new MutationObserver(updateScrollHint);
    mutationObserver.observe(viewport, {
      childList: true,
      subtree: true,
    });

    const raf = window.requestAnimationFrame(updateScrollHint);
    const timeout = window.setTimeout(updateScrollHint, 120);
    const delayedTimeout = window.setTimeout(updateScrollHint, 400);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
      window.clearTimeout(delayedTimeout);
    };
  }, [updateScrollHint]);

  useEffect(() => {
    updateScrollHint();
  }, [hasMoreBelow, updateScrollHint]);

  const handleScrollDownHintClick = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    if (hasMoreBelow) {
      dispatchNearEndIfNeeded(viewport);
    }

    scrollViewportOnePage(viewport);
    window.requestAnimationFrame(updateScrollHint);
  }, [hasMoreBelow, updateScrollHint]);

  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        <div className="min-w-0">{children}</div>
      </div>
      <InfiniteScrollDownHint
        visible={scrollHintVisible}
        variant="overlay"
        onClick={handleScrollDownHintClick}
      />
    </div>
  );
}

function CustomOrangeScrollArea({
  children,
  className = "",
  showScrollDownHint = false,
}: ScrollAreaContentProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const scrollHideTimeoutRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startY: number;
    startScrollTop: number;
  } | null>(null);
  const [thumb, setThumb] = useState({
    height: 0,
    top: 0,
    visible: false,
  });
  const [isScrolling, setIsScrolling] = useState(false);
  const { scrollHintVisible, setScrollHintVisible, hasMoreBelow } =
    useScrollDownHintState(showScrollDownHint);

  const updateScrollHint = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      setScrollHintVisible(false);
      return;
    }

    setScrollHintVisible(
      shouldShowScrollDownHint(viewport, showScrollDownHint, hasMoreBelow),
    );
  }, [hasMoreBelow, showScrollDownHint, setScrollHintVisible]);

  const updateThumb = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const { clientHeight, scrollHeight, scrollTop } = viewport;
    const visible = scrollHeight > clientHeight + 1;
    const height = visible
      ? Math.max(36, (clientHeight / scrollHeight) * clientHeight)
      : 0;
    const maxTop = Math.max(0, clientHeight - height);
    const top = visible
      ? (scrollTop / Math.max(1, scrollHeight - clientHeight)) * maxTop
      : 0;

    setThumb({ height, top, visible });
    updateScrollHint();
  }, [updateScrollHint]);

  const showScrollThumb = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport || viewport.scrollHeight <= viewport.clientHeight + 1) {
      setIsScrolling(false);
      return;
    }

    setIsScrolling(true);

    if (scrollHideTimeoutRef.current !== null) {
      window.clearTimeout(scrollHideTimeoutRef.current);
    }

    scrollHideTimeoutRef.current = window.setTimeout(() => {
      setIsScrolling(false);
    }, 700);
  }, []);

  const keepScrollThumbVisible = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport || viewport.scrollHeight <= viewport.clientHeight + 1) {
      return;
    }

    setIsScrolling(true);

    if (scrollHideTimeoutRef.current !== null) {
      window.clearTimeout(scrollHideTimeoutRef.current);
      scrollHideTimeoutRef.current = null;
    }
  }, []);

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current;

    updateThumb();
    showScrollThumb();

    if (!viewport) {
      return;
    }

    dispatchNearEndIfNeeded(viewport);
  }, [showScrollThumb, updateThumb]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;

    if (!viewport || event.deltaY <= 0) {
      return;
    }

    dispatchNearEndIfNeeded(viewport);
  }, []);

  const handleThumbPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const viewport = viewportRef.current;

      if (!viewport || !thumb.visible) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      dragStateRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startScrollTop: viewport.scrollTop,
      };
      keepScrollThumbVisible();
    },
    [keepScrollThumbVisible, thumb.visible],
  );

  const handleThumbPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const viewport = viewportRef.current;
      const dragState = dragStateRef.current;

      if (!viewport || !dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const maxThumbTop = Math.max(1, viewport.clientHeight - thumb.height);
      const maxScrollTop = Math.max(
        0,
        viewport.scrollHeight - viewport.clientHeight,
      );
      const scrollDelta =
        ((event.clientY - dragState.startY) / maxThumbTop) * maxScrollTop;

      viewport.scrollTop = dragState.startScrollTop + scrollDelta;
      updateThumb();
      keepScrollThumbVisible();
    },
    [keepScrollThumbVisible, thumb.height, updateThumb],
  );

  const handleThumbPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const dragState = dragStateRef.current;

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      dragStateRef.current = null;
      showScrollThumb();
    },
    [showScrollThumb],
  );

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(updateThumb);
    const timeout = window.setTimeout(updateThumb, 150);
    const delayedTimeout = window.setTimeout(updateThumb, 400);

    const resizeObserver = new ResizeObserver(updateThumb);
    resizeObserver.observe(viewport);

    const mutationObserver = new MutationObserver(updateThumb);
    mutationObserver.observe(viewport, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("resize", updateThumb);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", updateThumb);
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
      window.clearTimeout(delayedTimeout);
      if (scrollHideTimeoutRef.current !== null) {
        window.clearTimeout(scrollHideTimeoutRef.current);
      }
    };
  }, [updateThumb]);

  useEffect(() => {
    updateScrollHint();
  }, [hasMoreBelow, updateScrollHint]);

  const handleScrollDownHintClick = useCallback(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    if (hasMoreBelow) {
      dispatchNearEndIfNeeded(viewport);
    }

    scrollViewportOnePage(viewport);
    window.requestAnimationFrame(updateScrollHint);
  }, [hasMoreBelow, updateScrollHint]);

  return (
    <div className={cn("relative flex min-h-0 flex-col", className)}>
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        className="scrollbar-native-hidden scroll-hover-surface min-h-0 flex-1 overflow-x-hidden overflow-y-scroll overscroll-contain"
      >
        <div className="min-w-0">{children}</div>
      </div>
      {thumb.visible ? (
        <div
          className={`absolute inset-y-0 right-0 z-30 w-3 transition-opacity duration-300 ease-out ${
            isScrolling
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        >
          <div
            className="absolute right-0 w-2 cursor-grab touch-none rounded-full bg-primary active:cursor-grabbing"
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerEnd}
            onPointerCancel={handleThumbPointerEnd}
            style={{
              height: `${thumb.height}px`,
              transform: `translateY(${thumb.top}px)`,
            }}
          />
        </div>
      ) : null}
      <InfiniteScrollDownHint
        visible={scrollHintVisible}
        variant="overlay"
        onClick={handleScrollDownHintClick}
      />
    </div>
  );
}

export default function OrangeScrollArea({
  children,
  className = "",
  useCustomScroll = false,
  showScrollDownHint = false,
}: Props) {
  if (useCustomScroll) {
    return (
      <CustomOrangeScrollArea
        className={className}
        showScrollDownHint={showScrollDownHint}
      >
        {children}
      </CustomOrangeScrollArea>
    );
  }

  return (
    <NativeOrangeScrollArea
      className={className}
      showScrollDownHint={showScrollDownHint}
    >
      {children}
    </NativeOrangeScrollArea>
  );
}
