"use client";

import { UserRound, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import LoginModal from "@/components/auth/LoginModal";
import { Button } from "@/components/ui/button";
import {
  countSyncedPostDrafts,
  getTechPostDraftStorageKey,
} from "@/lib/post-drafts";

type ProfileCard = {
  id: number;
  name: string | null;
  image: string | null;
  followerCount: number;
  postCount: number;
  isSelf: boolean;
  isFriend: boolean;
};

export default function UserProfiles() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<ProfileCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isSubscribedHovering, setIsSubscribedHovering] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [draftPostCount, setDraftPostCount] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadProfile = useCallback(async () => {
    const selfProfile = session?.user?.id
      ? await fetch(`/api/users/${session.user.id}/profile`, {
          cache: "no-store",
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error();
            }

            return response.json();
          })
          .catch(() => ({
            id: Number(session.user.id),
            name: session.user.name ?? null,
            image: session.user.image ?? null,
            followerCount: 0,
            postCount: 0,
            isSelf: true,
            isFriend: false,
          }))
      : null;

    const userPageMatch = pathname.match(/^\/users\/(\d+)$/);

    if (userPageMatch) {
      try {
        setLoading(true);

        const response = await fetch(`/api/users/${userPageMatch[1]}/profile`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error();
        }

        const data = await response.json();
        setProfile(data.isSelf ? selfProfile : data);
      } catch {
        setProfile(selfProfile);
      } finally {
        setLoading(false);
      }
      return;
    }

    setProfile(selfProfile);
    setLoading(false);
  }, [pathname, session]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    window.addEventListener("profile-updated", loadProfile);

    return () => {
      window.removeEventListener("profile-updated", loadProfile);
    };
  }, [loadProfile]);

  useEffect(() => {
    void countSyncedPostDrafts(getTechPostDraftStorageKey()).then(
      setDraftPostCount,
    );
  }, []);

  const handleToggleFriend = async (
    friendUserId: number,
    isFriend: boolean,
  ) => {
    try {
      setPendingId(friendUserId);

      const response = await fetch("/api/friends", {
        method: isFriend ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friendUserId }),
      });

      if (!response.ok) {
        throw new Error();
      }

      setProfile((current) =>
        current && current.id === friendUserId
          ? {
              ...current,
              isFriend: !isFriend,
              followerCount: Math.max(
                0,
                current.followerCount + (isFriend ? -1 : 1),
              ),
            }
          : current,
      );
      setIsSubscribedHovering(false);
    } catch {
      window.alert(
        isFriend ? "팔로잉 취소에 실패했습니다." : "친구 추가에 실패했습니다.",
      );
    } finally {
      setPendingId(null);
    }
  };
  const postCount = profile
    ? profile.postCount + (profile.isSelf ? draftPostCount : 0)
    : 0;
  const followersHref = profile?.isSelf
    ? "/mypage?tab=followers&friendType=followers"
    : profile
      ? `/users/${profile.id}?tab=following`
      : "#";
  const postsHref = profile?.isSelf
    ? "/mypage?tab=posts"
    : profile
      ? `/users/${profile.id}?tab=posts`
      : "#";
  const isPostDetailPage =
    /^\/horok-tech\/(?:feeds|likes)\/posts\/\d+$/.test(pathname) ||
    /^\/posts\/\d+$/.test(pathname);

  return (
    <section className="-mx-6 px-6 space-y-3">
      <div className="flex items-center gap-2">
        <UserRound className="h-[18px] w-[18px]" />
        <h3 className="text-lg font-bold tracking-tight">
          {isPostDetailPage ? "글쓴이" : "프로필"}
        </h3>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : !profile ? (
        <>
          <Button
            size="sm"
            className="w-full"
            onClick={() => setLoginOpen(true)}
          >
            로그인
          </Button>
          <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
        </>
      ) : (
        <>
          <div className="rounded-xl border bg-background p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setImagePreviewOpen(true)}
                className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`${profile.name ?? "사용자"} 프로필 이미지 확대`}
              >
                <Image
                  src={profile.image ?? "/logo.png"}
                  alt={`${profile.name ?? "사용자"} 프로필`}
                  width={52}
                  height={52}
                  className="h-12 w-12 rounded-full border object-cover"
                />
              </button>
              <div className="min-w-0 flex-1">
                <Link
                  href={profile.isSelf ? "/horok-tech" : `/users/${profile.id}`}
                  className="block truncate text-base font-semibold transition hover:text-foreground/80"
                >
                  {profile.name ?? "이름 없는 사용자"}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                  <Link
                    href={followersHref}
                    className="transition hover:text-foreground"
                  >
                    팔로워 {profile.followerCount}명
                  </Link>
                  <span>·</span>
                  <Link
                    href={postsHref}
                    className="transition hover:text-foreground"
                  >
                    글 {postCount}개
                  </Link>
                </div>
              </div>
            </div>

            <div className="mt-3">
              {profile.isSelf ? (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="w-full border-border bg-background text-muted-foreground transition hover:!border-primary/30 hover:!bg-primary/10 hover:!text-foreground"
                >
                  <Link href="/mypage">마이페이지</Link>
                </Button>
              ) : status !== "authenticated" ? (
                <Button size="sm" variant="outline" className="w-full" disabled>
                  로그인 후 팔로잉하기
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={
                    profile.isFriend && isSubscribedHovering
                      ? "destructive"
                      : profile.isFriend
                        ? "secondary"
                        : "default"
                  }
                  className="w-full"
                  disabled={pendingId === profile.id}
                  onClick={() =>
                    handleToggleFriend(profile.id, profile.isFriend)
                  }
                  onMouseEnter={() => {
                    if (profile.isFriend) {
                      setIsSubscribedHovering(true);
                    }
                  }}
                  onMouseLeave={() => setIsSubscribedHovering(false)}
                >
                  {pendingId === profile.id
                    ? profile.isFriend
                      ? "취소 중..."
                      : "추가 중..."
                    : profile.isFriend
                      ? isSubscribedHovering
                        ? "팔로잉 취소"
                        : "팔로잉"
                      : "팔로잉"}
                </Button>
              )}
            </div>
          </div>

          {imagePreviewOpen && mounted
            ? createPortal(
                <div
                  className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${profile.name ?? "사용자"} 프로필 이미지`}
                >
                  <button
                    type="button"
                    className="absolute inset-0 z-0 bg-black/60"
                    onClick={() => setImagePreviewOpen(false)}
                    aria-label="프로필 이미지 닫기"
                  />
                  <div className="relative z-10 rounded-2xl bg-background p-4 shadow-xl">
                    <button
                      type="button"
                      onClick={() => setImagePreviewOpen(false)}
                      className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center text-muted-foreground transition hover:text-foreground"
                      aria-label="프로필 이미지 닫기"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <Image
                      src={profile.image ?? "/logo.png"}
                      alt={`${profile.name ?? "사용자"} 프로필 확대`}
                      width={360}
                      height={360}
                      className="max-h-[80vh] max-w-[80vw] object-contain"
                    />
                  </div>
                </div>,
                document.body,
              )
            : null}
        </>
      )}
    </section>
  );
}
