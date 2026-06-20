const NEAR_END_THRESHOLD_PX = 240;
const SCROLL_DOWN_STEP_MIN_PX = 240;

type ScrollMetrics = {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
  scrollBy: (delta: number) => void;
};

export function getPageScrollElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-app-shell-scroll='true']");
}

function getScrollMetrics(): ScrollMetrics {
  const element = getPageScrollElement();

  if (element) {
    return {
      scrollHeight: element.scrollHeight,
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
      scrollBy: (delta) => {
        element.scrollBy({ top: delta, behavior: "smooth" });
      },
    };
  }

  return {
    scrollHeight: document.documentElement.scrollHeight,
    scrollTop: window.scrollY,
    clientHeight: window.innerHeight,
    scrollBy: (delta) => {
      window.scrollBy({ top: delta, behavior: "smooth" });
    },
  };
}

export function shouldShowPageScrollDownHint(
  enabled: boolean,
  hasMoreBelow: boolean,
) {
  if (!enabled) {
    return false;
  }

  if (hasMoreBelow) {
    return true;
  }

  const { scrollHeight, scrollTop, clientHeight } = getScrollMetrics();
  const distanceToBottom = scrollHeight - scrollTop - clientHeight;
  const atBottom = distanceToBottom <= 1;
  const canScroll = scrollHeight > clientHeight + 1;

  return canScroll && !atBottom;
}

export function dispatchPageNearEndIfNeeded() {
  const { scrollHeight, scrollTop, clientHeight } = getScrollMetrics();
  const distanceToBottom = scrollHeight - scrollTop - clientHeight;

  if (
    scrollHeight <= clientHeight + 1 ||
    distanceToBottom <= NEAR_END_THRESHOLD_PX
  ) {
    window.dispatchEvent(new CustomEvent("orange-scroll-area-near-end"));
  }
}

export function scrollPageOneStep() {
  const { scrollHeight, scrollTop, clientHeight, scrollBy } = getScrollMetrics();
  const distanceToBottom = scrollHeight - scrollTop - clientHeight;
  const delta = Math.max(
    SCROLL_DOWN_STEP_MIN_PX,
    Math.min(Math.round(clientHeight * 0.85), distanceToBottom),
  );

  if (delta <= 0) {
    dispatchPageNearEndIfNeeded();
    return;
  }

  scrollBy(delta);

  window.setTimeout(() => {
    dispatchPageNearEndIfNeeded();
  }, 350);
}
