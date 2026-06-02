"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MyPageHeadingPortal from "@/components/mypage/MyPageHeadingPortal";
import { Button } from "@/components/ui/button";

const DEFAULT_PAGE_SIZE = 2;

function getResponsiveFriendPageSize() {
  if (typeof window === "undefined") {
    return DEFAULT_PAGE_SIZE;
  }

  if (window.innerWidth >= 1280) {
    return 5;
  }

  if (window.innerWidth >= 1024) {
    return 4;
  }

  if (window.innerWidth >= 640) {
    return 3;
  }

  return 2;
}

type Friend = {
  id: number;
  name: string | null;
  image: string | null;
  followerCount: number;
  postCount: number;
  followedAt?: string;
};

type FriendsResponse = {
  followers: Friend[];
  following: Friend[];
  totalCount?: number;
  resolvedPage?: number;
};

function FriendList({
  listKey,
  title,
  onFollowingStatusChange,
  emptyMessage,
  hideHeading = false,
}: {
  listKey: "followers" | "following";
  title: string;
  onFollowingStatusChange?: (delta: number) => void;
  emptyMessage: string;
  hideHeading?: boolean;
}) {
  const searchParams = useSearchParams();
  const [pageSize, setPageSize] = useState(() => getResponsiveFriendPageSize());
  const [friends, setFriends] = useState<Friend[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextPage, setNextPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [highlightedFriendId, setHighlightedFriendId] = useState<number | null>(
    null,
  );
  const [pendingFriendId, setPendingFriendId] = useState<number | null>(null);
  const [unfollowedFriendIds, setUnfollowedFriendIds] = useState<Set<number>>(
    () => new Set(),
  );
  const targetFriendId = useMemo(() => {
    const value = Number(searchParams.get("friendId") ?? "");
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [searchParams]);
  const targetFriendType = searchParams.get("friendType");
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const sort = searchParams.get("sort") ?? "latest";
  const filterKey = `${query}:${sort}`;
  const previousFilterKeyRef = useRef(filterKey);
  const fetchingRef = useRef(false);
  const loadFriends = useCallback(
    async (page: number, options: { replace?: boolean } = {}) => {
      if (fetchingRef.current) {
        return;
      }

      fetchingRef.current = true;
      if (options.replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          listType: listKey,
          page: String(page),
          limit: String(pageSize),
          sort,
        });
        if (query) {
          params.set("q", query);
        }

        const response = await fetch(`/api/mypage/friends?${params}`);
        if (!response.ok) {
          throw new Error();
        }

        const data: FriendsResponse = await response.json();
        const nextFriends =
          listKey === "followers"
            ? Array.isArray(data.followers)
              ? data.followers
              : []
            : Array.isArray(data.following)
              ? data.following
              : [];
        const resolvedPage =
          typeof data.resolvedPage === "number" && data.resolvedPage > 0
            ? data.resolvedPage
            : page;
        const nextTotalCount =
          typeof data.totalCount === "number" ? data.totalCount : 0;

        setFriends((current) => {
          if (options.replace) {
            return nextFriends;
          }

          const existingIds = new Set(current.map((friend) => friend.id));
          return [
            ...current,
            ...nextFriends.filter((friend) => !existingIds.has(friend.id)),
          ];
        });
        setNextPage(resolvedPage + 1);
        setTotalCount(nextTotalCount);
        setHasMore(resolvedPage * pageSize < nextTotalCount);
      } catch {
        if (options.replace) {
          setFriends([]);
          setTotalCount(0);
          setHasMore(false);
        }
      } finally {
        fetchingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [listKey, pageSize, query, sort],
  );

  useEffect(() => {
    const updatePageSize = () => {
      setPageSize((current) => {
        const next = getResponsiveFriendPageSize();
        return current === next ? current : next;
      });
    };

    updatePageSize();
    window.addEventListener("resize", updatePageSize);

    return () => {
      window.removeEventListener("resize", updatePageSize);
    };
  }, []);

  useEffect(() => {
    void loadFriends(1, { replace: true });
  }, [loadFriends]);

  const headingCount =
    listKey === "following"
      ? Math.max(0, totalCount - unfollowedFriendIds.size)
      : totalCount;

  useEffect(() => {
    if (previousFilterKeyRef.current === filterKey) {
      return;
    }

    previousFilterKeyRef.current = filterKey;
  }, [filterKey]);

  useEffect(() => {
    const handleNearEnd = () => {
      if (!hasMore || loading || loadingMore) {
        return;
      }

      void loadFriends(nextPage);
    };

    window.addEventListener("orange-scroll-area-near-end", handleNearEnd);

    return () => {
      window.removeEventListener("orange-scroll-area-near-end", handleNearEnd);
    };
  }, [hasMore, loadFriends, loading, loadingMore, nextPage]);

  useEffect(() => {
    if (targetFriendType !== listKey || typeof targetFriendId !== "number") {
      return;
    }

    const targetFriend = friends.find((friend) => friend.id === targetFriendId);
    if (!targetFriend) {
      return;
    }

    setHighlightedFriendId(targetFriendId);
  }, [friends, listKey, targetFriendId, targetFriendType]);

  useEffect(() => {
    if (typeof highlightedFriendId !== "number") {
      return;
    }

    const visible = friends.some((friend) => friend.id === highlightedFriendId);
    if (!visible) {
      return;
    }

    const scrollTimeout = window.setTimeout(() => {
      const element = document.getElementById(
        `mypage-${listKey}-friend-${highlightedFriendId}`,
      );
      element?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    const highlightTimeout = window.setTimeout(() => {
      setHighlightedFriendId((current) =>
        current === highlightedFriendId ? null : current,
      );
    }, 2600);

    return () => {
      window.clearTimeout(scrollTimeout);
      window.clearTimeout(highlightTimeout);
    };
  }, [friends, highlightedFriendId, listKey]);

  async function handleToggleFollowing(friendId: number) {
    if (listKey !== "following") {
      return;
    }

    const isFollowing = !unfollowedFriendIds.has(friendId);

    try {
      setPendingFriendId(friendId);

      const response = await fetch("/api/friends", {
        method: isFollowing ? "DELETE" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friendUserId: friendId }),
      });

      if (!response.ok) {
        throw new Error();
      }

      setUnfollowedFriendIds((current) => {
        const next = new Set(current);

        if (isFollowing) {
          next.add(friendId);
        } else {
          next.delete(friendId);
        }

        return next;
      });
      onFollowingStatusChange?.(isFollowing ? -1 : 1);
      window.dispatchEvent(
        new CustomEvent("mypage-friend-count-change", {
          detail: { listKey, delta: isFollowing ? -1 : 1 },
        }),
      );
    } catch {
      window.alert(
        isFollowing ? "구독 취소에 실패했습니다." : "팔로잉에 실패했습니다.",
      );
    } finally {
      setPendingFriendId(null);
    }
  }

  return (
    <div className="space-y-4">
      {hideHeading ? (
        <MyPageHeadingPortal>
          <HeadingContent title={title} count={headingCount} />
        </MyPageHeadingPortal>
      ) : null}
      {hideHeading ? null : (
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <span className="text-sm font-medium text-muted-foreground">
            {headingCount}
          </span>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : friends.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {friends.map((friend) => (
              <li
                key={`${title}-${friend.id}`}
                id={`mypage-${listKey}-friend-${friend.id}`}
                className="min-w-0 rounded-xl transition-colors"
              >
                <div
                  className={`card-hover-scale relative flex h-full min-w-0 flex-col items-center rounded-xl border bg-background px-4 py-4 text-center ${
                    highlightedFriendId === friend.id
                      ? "border-primary bg-primary/5"
                      : ""
                  }`}
                >
                  <Link
                    href={`/users/${friend.id}`}
                    className="absolute inset-0 z-10 rounded-xl"
                    aria-label={`${friend.name ?? "이름 없는 사용자"} 홈으로 이동`}
                  />
                  <div className="pointer-events-none relative z-20 flex min-w-0 flex-1 flex-col items-center">
                    <Image
                      src={friend.image ?? "/logo.png"}
                      alt={`${friend.name ?? "구독 유저"} 프로필`}
                      width={72}
                      height={72}
                      className={`h-18 w-18 rounded-full border object-cover ${!friend.image ? "grayscale" : ""}`}
                    />
                    <p className="mt-3 w-full truncate font-medium">
                      {friend.name ?? "이름 없는 사용자"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      팔로워 {friend.followerCount}명 · 글 {friend.postCount}개
                    </p>
                  </div>
                  {listKey === "following" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        unfollowedFriendIds.has(friend.id)
                          ? "default"
                          : "outline"
                      }
                      className={`relative z-30 mt-3 h-8 w-full text-xs ${
                        unfollowedFriendIds.has(friend.id)
                          ? ""
                          : "hover:!border-destructive hover:!bg-destructive hover:!text-white dark:hover:!border-destructive dark:hover:!bg-destructive dark:hover:!text-white"
                      }`}
                      disabled={pendingFriendId === friend.id}
                      onClick={() => void handleToggleFollowing(friend.id)}
                    >
                      {pendingFriendId === friend.id
                        ? "처리 중..."
                        : unfollowedFriendIds.has(friend.id)
                          ? "팔로잉"
                          : "팔로잉 취소"}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {hasMore ? <div className="h-12 w-full" /> : null}
          {loadingMore ? (
            <p className="text-center text-sm text-muted-foreground">
              더 불러오는 중…
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

type Props = {
  listType?: "followers" | "following";
};

function HeadingContent({ title, count }: { title: string; count?: number }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="truncate">{title}</span>
      {typeof count === "number" ? (
        <span className="text-sm font-medium text-muted-foreground">
          {count}
        </span>
      ) : null}
    </span>
  );
}

export default function MyFriendsSection({ listType }: Props) {
  if (listType) {
    const title = listType === "followers" ? "팔로워" : "팔로잉";
    const emptyMessage =
      listType === "followers"
        ? "나를 구독한 유저가 없습니다."
        : "구독 중인 유저가 없습니다.";

    return (
      <section className="space-y-16">
        <FriendList
          listKey={listType}
          title={title}
          emptyMessage={emptyMessage}
          hideHeading
        />
      </section>
    );
  }

  return (
    <section className="space-y-16">
      <MyPageHeadingPortal>
        <HeadingContent title="친구" />
      </MyPageHeadingPortal>
      <FriendList
        listKey="followers"
        title="팔로워"
        emptyMessage="나를 구독한 유저가 없습니다."
      />
      <FriendList
        listKey="following"
        title="팔로잉"
        emptyMessage="구독 중인 유저가 없습니다."
      />
    </section>
  );
}
