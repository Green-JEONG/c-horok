"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { scrollToHashWithRetry } from "@/lib/hash-scroll";

export default function PostHashScroll() {
  const pathname = usePathname();

  // pathname: client-side route changes with a hash should scroll after content mounts.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers hash scroll on navigation
  useEffect(() => {
    let cancelRetry = () => {};

    const scrollToCurrentHash = () => {
      const hash = window.location.hash;
      if (!hash) {
        return;
      }

      cancelRetry();
      cancelRetry = scrollToHashWithRetry(hash);
    };

    scrollToCurrentHash();

    const delayedRuns = [150, 500, 1200].map((delay) =>
      window.setTimeout(scrollToCurrentHash, delay),
    );

    window.addEventListener("hashchange", scrollToCurrentHash);

    return () => {
      cancelRetry();
      for (const timeoutId of delayedRuns) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("hashchange", scrollToCurrentHash);
    };
  }, [pathname]);

  return null;
}
