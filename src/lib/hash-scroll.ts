const HASH_SCROLL_OFFSET_PX = 16;
const SANITIZE_CLOBBER_PREFIX = "user-content-";

export function getAppShellScroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-app-shell-scroll='true']");
}

export function getHashId(hash: string): string {
  try {
    return decodeURIComponent(hash.replace(/^#/, "").trim());
  } catch {
    return hash.replace(/^#/, "").trim();
  }
}

function getHashIdCandidates(hash: string): string[] {
  const id = getHashId(hash);
  if (!id) {
    return [];
  }

  const candidates = [id];
  if (!id.startsWith(SANITIZE_CLOBBER_PREFIX)) {
    candidates.push(`${SANITIZE_CLOBBER_PREFIX}${id}`);
  }

  return candidates;
}

export function findHashElement(hash: string): HTMLElement | null {
  const candidates = getHashIdCandidates(hash);
  if (candidates.length === 0) {
    return null;
  }

  for (const candidate of candidates) {
    const byId = document.getElementById(candidate);
    if (byId) {
      return byId;
    }
  }

  const scope = document.querySelector("article") ?? document;
  const headings = scope.querySelectorAll(
    "h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]",
  );

  for (const heading of headings) {
    if (candidates.includes(heading.id)) {
      return heading as HTMLElement;
    }
  }

  return null;
}

export function scrollToHash(
  hash: string,
  options: { behavior?: ScrollBehavior } = {},
): boolean {
  const element = findHashElement(hash);
  if (!element) {
    return false;
  }

  const behavior = options.behavior ?? "smooth";
  const scroller = getAppShellScroller();

  if (scroller) {
    const scrollerTop = scroller.getBoundingClientRect().top;
    const elementTop = element.getBoundingClientRect().top;
    const top =
      scroller.scrollTop + (elementTop - scrollerTop) - HASH_SCROLL_OFFSET_PX;

    scroller.scrollTo({
      top: Math.max(0, top),
      behavior,
    });
    return true;
  }

  element.scrollIntoView({ behavior, block: "start" });
  return true;
}

export function scrollToHashWithRetry(
  hash: string,
  options: { behavior?: ScrollBehavior; maxAttempts?: number } = {},
): () => void {
  const maxAttempts = options.maxAttempts ?? 80;
  let attempts = 0;
  let cancelled = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let observer: MutationObserver | null = null;

  const cleanup = () => {
    observer?.disconnect();
    observer = null;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const tryScroll = () => {
    if (cancelled) {
      cleanup();
      return true;
    }

    if (scrollToHash(hash, options)) {
      cleanup();
      return true;
    }

    attempts += 1;
    if (attempts >= maxAttempts) {
      cleanup();
      return true;
    }

    return false;
  };

  if (tryScroll()) {
    return cleanup;
  }

  observer = new MutationObserver(() => {
    tryScroll();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  const schedule = () => {
    if (cancelled || tryScroll()) {
      return;
    }

    timeoutId = setTimeout(schedule, 50);
  };

  timeoutId = setTimeout(schedule, 50);

  return () => {
    cancelled = true;
    cleanup();
  };
}
