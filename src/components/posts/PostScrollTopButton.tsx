"use client";

import { ChevronUp } from "lucide-react";

export default function PostScrollTopButton() {
  const handleClick = () => {
    const appShellScroller = document.querySelector<HTMLElement>(
      "[data-app-shell-scroll='true']",
    );

    if (
      appShellScroller &&
      appShellScroller.scrollHeight > appShellScroller.clientHeight
    ) {
      appShellScroller.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      aria-label="게시물 맨 위로"
      className="fixed top-1/2 right-5 z-50 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-primary/25 bg-background/95 text-primary shadow-lg shadow-black/10 backdrop-blur transition hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:right-8"
      onClick={handleClick}
      type="button"
    >
      <ChevronUp aria-hidden="true" className="size-5" />
    </button>
  );
}
