"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SectionPagination from "@/components/mypage/sections/SectionPagination";
import type { DbPostSeriesItem } from "@/lib/db";
import { getLogFeedPostPath } from "@/lib/routes";
import { cn, formatSeoulDate } from "@/lib/utils";

const SERIES_PAGE_SIZE = 5;

type Props = {
  currentPostId: number;
  items: DbPostSeriesItem[];
};

function getSeriesName(title: string) {
  const [, seriesName = ""] = title.match(/\[([^\]\n]{1,80})\]/) ?? [];
  return seriesName.trim();
}

function getPageForPost(
  items: DbPostSeriesItem[],
  currentPostId: number,
): number {
  const currentIndex = items.findIndex((item) => item.id === currentPostId);
  if (currentIndex === -1) {
    return 1;
  }

  return Math.floor(currentIndex / SERIES_PAGE_SIZE) + 1;
}

export default function PostSeriesTable({ currentPostId, items }: Props) {
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [currentPage, setCurrentPage] = useState(() =>
    getPageForPost(items, currentPostId),
  );

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setCurrentPage(getPageForPost(items, currentPostId));
  }, [currentPostId, items]);

  if (items.length === 0) {
    return null;
  }

  const seriesName = getSeriesName(items[0]?.title ?? "");
  const totalPages = Math.max(1, Math.ceil(items.length / SERIES_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const visibleItems = items.slice(
    (safePage - 1) * SERIES_PAGE_SIZE,
    safePage * SERIES_PAGE_SIZE,
  );
  const handleScroll = () => {
    setIsScrolling(true);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 900);
  };

  return (
    <section className="mb-5 min-w-0 border-b border-border pb-4">
      <h2 className="mb-3 min-w-0 truncate text-base font-bold text-foreground">
        {seriesName ? (
          <>
            <span className="text-primary">{seriesName}</span> 시리즈{" "}
            <span className="font-semibold text-muted-foreground">
              {items.length}
            </span>
          </>
        ) : (
          <>
            시리즈{" "}
            <span className="font-semibold text-muted-foreground">
              {items.length}
            </span>
          </>
        )}
      </h2>

      <div
        className={cn(
          "scrollbar-orange-auto scrollbar-orange-hover min-w-0 overflow-x-auto",
          isScrolling && "is-scrolling",
        )}
        onScroll={handleScroll}
      >
        <table className="w-full min-w-[640px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-14" />
            <col />
            <col className="w-32" />
            <col className="w-20" />
            <col className="w-20" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-center text-xs font-semibold text-muted-foreground">
              <th className="px-2 py-2">순서</th>
              <th className="px-2 py-2">제목</th>
              <th className="px-2 py-2">작성일</th>
              <th className="px-2 py-2">조회</th>
              <th className="px-2 py-2">댓글</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item, index) => {
              const isCurrent = item.id === currentPostId;
              const orderNumber =
                items.length - (safePage - 1) * SERIES_PAGE_SIZE - index;

              return (
                <tr
                  key={item.id}
                  className={`border-b border-border/70 last:border-b-0 ${
                    isCurrent ? "bg-primary/10" : ""
                  }`}
                >
                  <td className="px-2 py-2 text-center text-muted-foreground">
                    {orderNumber}
                  </td>
                  <td className="min-w-0 px-2 py-2">
                    <Link
                      href={getLogFeedPostPath(item.id)}
                      aria-current={isCurrent ? "page" : undefined}
                      className="block truncate font-medium text-foreground transition hover:text-primary hover:underline"
                    >
                      {item.title}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-center text-muted-foreground">
                    {formatSeoulDate(item.created_at)}
                  </td>
                  <td className="px-2 py-2 text-center text-muted-foreground">
                    {item.view_count}
                  </td>
                  <td className="px-2 py-2 text-center text-muted-foreground">
                    {item.comments_count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <SectionPagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      ) : null}
    </section>
  );
}
