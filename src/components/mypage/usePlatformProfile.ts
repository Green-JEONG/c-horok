"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

export type PlatformKind = "log" | "coding";

export type PlatformProfile = {
  platform: PlatformKind;
  name: string | null;
  image: string | null;
  email: string | null;
};

export function getPlatformFromPathname(pathname: string | null): PlatformKind {
  if (pathname?.startsWith("/horok-coding")) {
    return "coding";
  }

  return "log";
}

export function usePlatformProfile(enabled = true) {
  const pathname = usePathname();
  const platform = useMemo(() => getPlatformFromPathname(pathname), [pathname]);
  const [profile, setProfile] = useState<PlatformProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setProfile(null);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/platform-profile?platform=${platform}`,
      );

      if (!response.ok) {
        setProfile(null);
        return;
      }

      const data = (await response
        .json()
        .catch(() => null)) as PlatformProfile | null;

      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, platform]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    profile,
    platform,
    isLoading,
    refresh,
  };
}
