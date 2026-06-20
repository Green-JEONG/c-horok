"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

function getScrollContainer() {
  return document.querySelector<HTMLElement>("[data-app-shell-scroll='true']");
}

function scrollContainerTo(position: "top" | "bottom") {
  const scroller = getScrollContainer();

  if (scroller && scroller.scrollHeight > scroller.clientHeight) {
    scroller.scrollTo({
      top: position === "top" ? 0 : scroller.scrollHeight,
      behavior: "smooth",
    });
    return;
  }

  window.scrollTo({
    top:
      position === "top"
        ? 0
        : document.documentElement.scrollHeight,
    behavior: "smooth",
  });
}

const scrollButtonClassName =
  "inline-flex size-11 items-center justify-center rounded-full border border-primary/25 bg-background/95 text-primary shadow-lg shadow-black/10 backdrop-blur transition hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";

export default function PostScrollTopButton() {
  return (
    <div className="fixed top-1/2 right-5 z-50 flex -translate-y-1/2 flex-col gap-2 md:right-8">
      <button
        aria-label="게시물 맨 위로"
        className={scrollButtonClassName}
        onClick={() => scrollContainerTo("top")}
        type="button"
      >
        <ChevronUp aria-hidden="true" className="size-5" />
      </button>
      <button
        aria-label="게시물 맨 아래로"
        className={scrollButtonClassName}
        onClick={() => scrollContainerTo("bottom")}
        type="button"
      >
        <ChevronDown aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
