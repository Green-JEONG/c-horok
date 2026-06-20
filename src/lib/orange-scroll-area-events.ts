export const ORANGE_SCROLL_HAS_MORE_EVENT = "orange-scroll-has-more";

let currentOrangeScrollHasMore = false;

export function dispatchOrangeScrollHasMore(hasMore: boolean) {
  currentOrangeScrollHasMore = hasMore;

  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(ORANGE_SCROLL_HAS_MORE_EVENT, {
      detail: { hasMore },
    }),
  );
}

export function getOrangeScrollHasMoreSnapshot() {
  return currentOrangeScrollHasMore;
}
