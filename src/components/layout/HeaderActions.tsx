"use client";

import { Crown } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import LoginModal from "@/components/auth/LoginModal";
import MyPageDrawer from "@/components/mypage/MyPageDrawer";
import {
  getPlatformFromPathname,
  usePlatformProfile,
} from "@/components/mypage/usePlatformProfile";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

type NotificationSummary = {
  id: number;
  is_read: number;
};

const NOTIFICATIONS_UPDATED_EVENT = "notifications-updated";

export default function HeaderActions() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const platform = getPlatformFromPathname(pathname);
  const [open, setOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const isLoggedIn = status === "authenticated";
  const isCote = platform === "cote";
  const { profile: platformProfile } = usePlatformProfile(isLoggedIn);
  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    if (!isLoggedIn || isCote) {
      setHasUnreadNotifications(false);
      return;
    }

    let cancelled = false;

    const loadNotifications = async () => {
      try {
        const response = await fetch("/api/notifications");

        if (!response.ok) {
          if (!cancelled) {
            setHasUnreadNotifications(false);
          }
          return;
        }

        const notifications = (await response
          .json()
          .catch(() => [])) as NotificationSummary[];

        if (!cancelled) {
          setHasUnreadNotifications(
            notifications.some((notification) => notification.is_read === 0),
          );
        }
      } catch {
        if (!cancelled) {
          setHasUnreadNotifications(false);
        }
      }
    };

    loadNotifications();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, loadNotifications);

    return () => {
      cancelled = true;
      window.removeEventListener(
        NOTIFICATIONS_UPDATED_EVENT,
        loadNotifications,
      );
    };
  }, [isCote, isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <>
        <Button
          size="sm"
          onClick={() => setOpen(true)}
          className={
            isCote ? "bg-[#06923E] text-white hover:bg-[#047a33]" : "text-white"
          }
        >
          로그인
        </Button>

        <LoginModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* {isAdmin && (
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">관리자</Link>
        </Button>
      )} */}

      <Button
        variant="ghost"
        size="icon"
        className="group relative isolate h-10 w-10 shrink-0 overflow-visible rounded-full border border-transparent bg-background p-0 transition hover:bg-primary/10"
        onClick={() => setOpen(true)}
        aria-label="마이페이지 열기"
      >
        <Image
          src={platformProfile?.image ?? session?.user?.image ?? "/logo.png"}
          alt={
            (platformProfile?.name ?? session?.user?.name)
              ? `${platformProfile?.name ?? session?.user?.name} 프로필`
              : "profile"
          }
          width={30}
          height={30}
          className={cn(
            "relative z-10 h-full w-full rounded-full border border-border object-contain transition group-hover:border-primary/30",
            !(platformProfile?.image ?? session?.user?.image) && "grayscale",
          )}
        />
        {isAdmin ? (
          <Crown
            className="pointer-events-none absolute -top-2 left-1/2 z-0 h-4 w-4 -translate-x-1/2 fill-amber-300 text-amber-500 drop-shadow-sm"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        ) : null}
        {!isCote && hasUnreadNotifications ? (
          <span className="absolute -right-0.5 top-0 z-20 h-2.5 w-2.5 rounded-full bg-red-500" />
        ) : null}
      </Button>

      <MyPageDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
