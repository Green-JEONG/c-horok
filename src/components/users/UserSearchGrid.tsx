"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import SectionPagination from "@/components/mypage/sections/SectionPagination";
import UserSearchSortButton from "@/components/users/UserSearchSortButton";
import type { DbUserSearchResult } from "@/lib/queries";

const DEFAULT_PAGE_SIZE = 2;

function getResponsiveUserPageSize() {
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

type Props = {
  users: DbUserSearchResult[];
  title?: string;
  showSortButton?: boolean;
  hideHeading?: boolean;
  infinite?: boolean;
  endpoint?: string;
  totalCount?: number;
};

export default function UserSearchGrid({
  users,
  title = "유저",
  showSortButton = false,
  hideHeading = false,
  infinite = false,
  endpoint,
  totalCount,
}: Props) {
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_PAGE_SIZE);
  const [items, setItems] = useState(users);
  const [nextPage, setNextPage] = useState(2);
  const [loadingMore, setLoadingMore] = useState(false);
  const [remoteExhausted, setRemoteExhausted] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);

  useEffect(() => {
    const updatePageSize = () => {
      setPageSize((current) => {
        const next = getResponsiveUserPageSize();
        if (current !== next) {
          setPage(1);
          setVisibleCount(next);
        }
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
    setItems(users);
    setNextPage(2);
    setVisibleCount(pageSize);
    setRemoteExhausted(false);
    fetchingRef.current = false;
  }, [pageSize, users]);

  const hasMoreLocal = infinite && !endpoint && visibleCount < items.length;
  const hasMoreRemote =
    infinite &&
    Boolean(endpoint) &&
    !remoteExhausted &&
    items.length < (typeof totalCount === "number" ? totalCount : items.length);

  useEffect(() => {
    if (!infinite || (!hasMoreLocal && !hasMoreRemote) || !loaderRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || fetchingRef.current) {
          return;
        }

        if (endpoint) {
          fetchingRef.current = true;
          setLoadingMore(true);
          const url = new URL(endpoint, window.location.origin);
          const currentParams = new URLSearchParams(searchParamsString);

          for (const [key, value] of currentParams.entries()) {
            url.searchParams.set(key, value);
          }
          url.searchParams.set("page", String(nextPage));

          void fetch(url.toString())
            .then((response) => response.json())
            .then((data) => {
              const nextUsers = Array.isArray(data)
                ? (data as DbUserSearchResult[])
                : [];
              setItems((current) => {
                const existingIds = new Set(current.map((user) => user.id));
                const uniqueNextUsers = nextUsers.filter(
                  (user) => !existingIds.has(user.id),
                );

                if (uniqueNextUsers.length === 0) {
                  setRemoteExhausted(true);
                }

                return [...current, ...uniqueNextUsers];
              });
              setNextPage((current) => current + 1);
            })
            .finally(() => {
              fetchingRef.current = false;
              setLoadingMore(false);
            });
          return;
        }

        setVisibleCount((current) =>
          Math.min(items.length, current + pageSize),
        );
      },
      { rootMargin: "240px" },
    );

    observer.observe(loaderRef.current);

    return () => observer.disconnect();
  }, [
    endpoint,
    hasMoreLocal,
    hasMoreRemote,
    infinite,
    items.length,
    nextPage,
    pageSize,
    searchParamsString,
  ]);

  if (items.length === 0) {
    return null;
  }

  const displayCount = totalCount ?? items.length;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleUsers = infinite
    ? items.slice(0, endpoint ? items.length : visibleCount)
    : items.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="space-y-4">
      {hideHeading ? null : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">{title}</h2>
            <span className="text-sm font-medium text-muted-foreground">
              {displayCount}
            </span>
          </div>
          {showSortButton ? <UserSearchSortButton /> : null}
        </div>
      )}
      {hideHeading && showSortButton ? (
        <div className="flex justify-end">
          <UserSearchSortButton />
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visibleUsers.map((user) => (
          <li key={user.id} className="min-w-0 rounded-xl transition-colors">
            <Link
              href={`/users/${user.id}`}
              className="card-hover-scale flex h-full min-w-0 flex-col items-center rounded-xl border bg-background px-4 py-4 text-center"
            >
              <Image
                src={user.image ?? "/logo.png"}
                alt={`${user.name ?? "검색 유저"} 프로필`}
                width={72}
                height={72}
                className={`h-18 w-18 rounded-full border object-cover ${!user.image ? "grayscale" : ""}`}
              />
              <p className="mt-3 w-full truncate font-medium">
                {user.name ?? "이름 없는 사용자"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                팔로워 {user.followerCount}명 · 글 {user.postCount}개
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {infinite ? (
        <>
          {(hasMoreLocal || hasMoreRemote) && (
            <div ref={loaderRef} className="h-12 w-full" />
          )}
          {loadingMore ? (
            <p className="text-center text-sm text-muted-foreground">
              더 불러오는 중…
            </p>
          ) : null}
        </>
      ) : (
        <SectionPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </section>
  );
}
