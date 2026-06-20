"use client";

import { useCallback, useEffect, useState } from "react";
import InfiniteScrollDownHint from "@/components/common/InfiniteScrollDownHint";
import { ORANGE_SCROLL_HAS_MORE_EVENT } from "@/lib/orange-scroll-area-events";
import {
  dispatchPageNearEndIfNeeded,
  getPageScrollElement,
  scrollPageOneStep,
  shouldShowPageScrollDownHint,
} from "@/lib/page-scroll";

export default function PageScrollDownHint() {
  const [scrollHintVisible, setScrollHintVisible] = useState(false);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  useEffect(() => {
    const handleHasMore = (event: Event) => {
      const { hasMore } = (event as CustomEvent<{ hasMore: boolean }>).detail;
      setHasMoreBelow(Boolean(hasMore));
    };

    window.addEventListener(ORANGE_SCROLL_HAS_MORE_EVENT, handleHasMore);

    return () => {
      window.removeEventListener(ORANGE_SCROLL_HAS_MORE_EVENT, handleHasMore);
      setHasMoreBelow(false);
    };
  }, []);

  const updateScrollHint = useCallback(() => {
    setScrollHintVisible(shouldShowPageScrollDownHint(true, hasMoreBelow));
  }, [hasMoreBelow]);

  const handleScroll = useCallback(() => {
    updateScrollHint();
    dispatchPageNearEndIfNeeded();
  }, [updateScrollHint]);

  useEffect(() => {
    updateScrollHint();

    const scrollElement = getPageScrollElement();
    const scrollTarget = scrollElement ?? window;

    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", updateScrollHint);

    const resizeObserver = new ResizeObserver(updateScrollHint);
    resizeObserver.observe(document.documentElement);
    if (scrollElement) {
      resizeObserver.observe(scrollElement);
    }

    const mutationObserver = new MutationObserver(updateScrollHint);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    const raf = window.requestAnimationFrame(updateScrollHint);
    const timeout = window.setTimeout(updateScrollHint, 120);
    const delayedTimeout = window.setTimeout(updateScrollHint, 400);

    return () => {
      scrollTarget.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateScrollHint);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeout);
      window.clearTimeout(delayedTimeout);
    };
  }, [handleScroll, updateScrollHint]);

  useEffect(() => {
    updateScrollHint();
  }, [hasMoreBelow, updateScrollHint]);

  const handleScrollDownHintClick = useCallback(() => {
    scrollPageOneStep();
    window.requestAnimationFrame(updateScrollHint);
  }, [updateScrollHint]);

  return (
    <InfiniteScrollDownHint
      visible={scrollHintVisible}
      variant="viewport"
      onClick={handleScrollDownHintClick}
    />
  );
}
