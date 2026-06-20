"use client";

import { useEffect, useState } from "react";

export function useHydratedPortalTarget(elementId: string, disabled = false) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (disabled) {
      setTarget(null);
      return;
    }

    let cancelled = false;

    const syncTarget = () => {
      if (!cancelled) {
        setTarget(document.getElementById(elementId));
      }
    };

    const frame = requestAnimationFrame(syncTarget);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [disabled, elementId]);

  return target;
}
