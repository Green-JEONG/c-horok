"use client";

import type { ComponentProps } from "react";
import { findHashElement, scrollToHash } from "@/lib/hash-scroll";

type Props = ComponentProps<"a">;

export default function MarkdownAnchor({
  href,
  onClick,
  target,
  ...props
}: Props) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !href || target === "_blank") {
      return;
    }

    const hashIndex = href.indexOf("#");
    if (hashIndex === -1) {
      return;
    }

    let pathname = window.location.pathname;
    let hash = href.slice(hashIndex);

    if (!href.startsWith("#")) {
      try {
        const url = new URL(href, window.location.origin);
        pathname = url.pathname;
        hash = url.hash;
      } catch {
        return;
      }
    }

    if (!hash || pathname !== window.location.pathname) {
      return;
    }

    if (!findHashElement(hash)) {
      return;
    }

    event.preventDefault();
    const nextUrl = `${pathname}${window.location.search}${hash}`;
    window.history.pushState(null, "", nextUrl);
    scrollToHash(hash);
  };

  return <a href={href} onClick={handleClick} target={target} {...props} />;
}
