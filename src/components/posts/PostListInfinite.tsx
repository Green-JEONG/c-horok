"use client";

import { EyeOff, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isNoticeCategoryName } from "@/lib/notice-categories";
import { parseSortType, type SortType } from "@/lib/post-sort";
import { getLogFaqPath, getLogNoticePath } from "@/lib/routes";
import { formatSeoulDate } from "@/lib/utils";
import PostCard from "./PostCard";

const PAGE_SIZE = 12;
const GRID_PROBE_ITEMS = [
  "probe-1",
  "probe-2",
  "probe-3",
  "probe-4",
  "probe-5",
];
const INITIAL_VISIBLE_ROW_COUNT = 3;

type PostListItem = {
  id: number;
  title: string;
  content: string;
  thumbnail: string | null;
  created_at: Date | string;
  author_name: string;
  author_image?: string | null;
  category_name: string;
  view_count?: number;
  likes_count: number;
  reactions_count?: number;
  comments_count: number;
  is_resolved?: boolean;
  has_admin_answer?: boolean;
  is_hidden?: boolean;
  is_secret?: boolean;
  can_view_secret?: boolean;
};

function getInquiryStatusLabel(post: PostListItem) {
  if (post.is_resolved) {
    return "답변 완료";
  }

  return post.has_admin_answer ? "확인 중" : "접수 완료";
}

function getInquiryStatusClassName(post: PostListItem) {
  if (post.is_resolved) {
    return "text-green-500";
  }

  return post.has_admin_answer ? "text-blue-500" : "text-red-500";
}

type Props = {
  initialPosts: PostListItem[];
  endpoint: string;
  initialSort?: SortType;
  responseKey?: string;
  gridClassName?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  syncSortWithSearchParams?: boolean;
  autoloadFirstPage?: boolean;
  postRouteSection?: "feeds" | "likes";
  groupBySearchCategory?: boolean;
  searchGroupTitleAction?: ReactNode;
  faqSearchGroupTitleAction?: ReactNode;
  noticeTableLabel?: (typeof SEARCH_RESULT_GROUPS)[number]["label"];
  noticeTableDateWithoutWeekday?: boolean;
  disableInfinite?: boolean;
  responsiveRowLoading?: boolean;
  initialVisibleRowCount?: number;
};

const SEARCH_RESULT_GROUPS = [
  {
    label: "게시물",
    matches: (post: PostListItem) => !isNoticeCategoryName(post.category_name),
  },
  {
    label: "공지",
    matches: (post: PostListItem) => post.category_name === "공지",
  },
  {
    label: "FAQ",
    matches: (post: PostListItem) => post.category_name === "FAQ",
  },
  {
    label: "문의",
    matches: (post: PostListItem) => post.category_name === "QnA",
  },
] as const;

const SEARCH_SORTABLE_GROUPS = new Set(["게시물", "공지", "문의"]);
const SEARCH_NOTICE_GROUPS = new Set(["공지", "FAQ", "문의"]);

function readPostsFromPayload(
  payload: unknown,
  responseKey?: string,
): PostListItem[] {
  if (Array.isArray(payload)) {
    return payload as PostListItem[];
  }

  if (
    responseKey &&
    payload &&
    typeof payload === "object" &&
    responseKey in payload
  ) {
    const value = payload[responseKey as keyof typeof payload];
    return Array.isArray(value) ? (value as PostListItem[]) : [];
  }

  return [];
}

export default function PostListInfinite({
  initialPosts,
  endpoint,
  initialSort = "latest",
  responseKey,
  gridClassName = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
  emptyMessage = "게시물이 없습니다.",
  loadingMessage = "불러오는 중...",
  syncSortWithSearchParams = false,
  autoloadFirstPage = false,
  postRouteSection = "feeds",
  groupBySearchCategory = false,
  searchGroupTitleAction,
  faqSearchGroupTitleAction,
  noticeTableLabel,
  noticeTableDateWithoutWeekday = false,
  disableInfinite = false,
  responsiveRowLoading = false,
  initialVisibleRowCount = INITIAL_VISIBLE_ROW_COUNT,
}: Props) {
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();
  const sort = syncSortWithSearchParams
    ? parseSortType(searchParams.get("sort") ?? initialSort)
    : initialSort;

  const [posts, setPosts] = useState<PostListItem[]>(initialPosts);
  const [page, setPage] = useState(initialPosts.length > 0 ? 2 : 1);
  const [responsivePageSize, setResponsivePageSize] = useState<number | null>(
    responsiveRowLoading ? null : PAGE_SIZE,
  );
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length >= PAGE_SIZE);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(!autoloadFirstPage);

  const loaderRef = useRef<HTMLDivElement | null>(null);
  const gridProbeRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);
  const loadedServerPostCountRef = useRef(initialPosts.length);

  useEffect(() => {
    setPosts(initialPosts);
    setPage(initialPosts.length > 0 ? 2 : 1);
    loadedServerPostCountRef.current = initialPosts.length;
    setHasMore(
      !disableInfinite &&
        (initialPosts.length >= PAGE_SIZE ||
          autoloadFirstPage ||
          responsiveRowLoading),
    );
    setHasLoadedOnce(!autoloadFirstPage || initialPosts.length > 0);
    fetchingRef.current = false;
  }, [autoloadFirstPage, disableInfinite, initialPosts, responsiveRowLoading]);

  useEffect(() => {
    if (!responsiveRowLoading) {
      setResponsivePageSize(PAGE_SIZE);
      return;
    }

    const probe = gridProbeRef.current;

    if (!probe) {
      return;
    }

    const updatePageSize = () => {
      const next = window
        .getComputedStyle(probe)
        .gridTemplateColumns.split(" ")
        .filter(Boolean).length;

      if (next <= 0) {
        return;
      }

      setResponsivePageSize((current) => (current === next ? current : next));
    };

    const frame = window.requestAnimationFrame(updatePageSize);
    const observer = new ResizeObserver(updatePageSize);
    observer.observe(probe);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [responsiveRowLoading]);

  const loadMore = useCallback(async () => {
    if (
      disableInfinite ||
      loading ||
      !hasMore ||
      fetchingRef.current ||
      responsivePageSize === null
    ) {
      return;
    }

    fetchingRef.current = true;
    setLoading(true);

    try {
      const url = new URL(endpoint, window.location.origin);
      const requestLimit = responsiveRowLoading
        ? hasLoadedOnce || posts.length > 0
          ? responsivePageSize
          : responsivePageSize * initialVisibleRowCount
        : PAGE_SIZE;

      if (syncSortWithSearchParams) {
        const currentParams = new URLSearchParams(searchParamsString);

        for (const [key, value] of currentParams.entries()) {
          url.searchParams.set(key, value);
        }
        url.searchParams.set("sort", sort);
      }

      if (responsiveRowLoading) {
        url.searchParams.set("limit", String(requestLimit));
        url.searchParams.set(
          "offset",
          String(loadedServerPostCountRef.current),
        );
      } else {
        url.searchParams.set("page", String(page));
      }

      const res = await fetch(url.toString());
      const data = readPostsFromPayload(await res.json(), responseKey);

      setPosts((prev) => {
        const existingIds = new Set(prev.map((post) => post.id));
        const newPosts = data.filter((post) => !existingIds.has(post.id));

        if (responsiveRowLoading) {
          loadedServerPostCountRef.current += data.length;
        }

        if (data.length < requestLimit) {
          setHasMore(false);
        }

        return [...prev, ...newPosts];
      });

      setPage((current) => current + 1);
      setHasLoadedOnce(true);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [
    disableInfinite,
    endpoint,
    hasLoadedOnce,
    hasMore,
    initialVisibleRowCount,
    loading,
    page,
    posts.length,
    responseKey,
    responsivePageSize,
    responsiveRowLoading,
    searchParamsString,
    sort,
    syncSortWithSearchParams,
  ]);

  const reloadFirstPage = useCallback(async () => {
    if (responsivePageSize === null) {
      return;
    }

    const url = new URL(endpoint, window.location.origin);
    const requestLimit = responsiveRowLoading
      ? Math.max(
          responsivePageSize * initialVisibleRowCount,
          loadedServerPostCountRef.current || initialPosts.length,
        )
      : PAGE_SIZE;

    if (syncSortWithSearchParams) {
      const currentParams = new URLSearchParams(searchParamsString);

      for (const [key, value] of currentParams.entries()) {
        url.searchParams.set(key, value);
      }
      url.searchParams.set("sort", sort);
    }

    if (responsiveRowLoading) {
      url.searchParams.set("limit", String(requestLimit));
      url.searchParams.set("offset", "0");
    } else {
      url.searchParams.set("page", "1");
    }

    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = readPostsFromPayload(await res.json(), responseKey);

    setPosts(data);
    setPage(data.length > 0 ? 2 : 1);
    loadedServerPostCountRef.current = data.length;
    setHasMore(!disableInfinite && data.length >= requestLimit);
    setHasLoadedOnce(true);
    fetchingRef.current = false;
  }, [
    disableInfinite,
    endpoint,
    initialPosts.length,
    initialVisibleRowCount,
    responseKey,
    responsivePageSize,
    responsiveRowLoading,
    searchParamsString,
    sort,
    syncSortWithSearchParams,
  ]);

  useEffect(() => {
    const handleProfileUpdated = () => {
      void reloadFirstPage();
    };

    window.addEventListener("profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, [reloadFirstPage]);

  useEffect(() => {
    if (
      !disableInfinite &&
      autoloadFirstPage &&
      !hasLoadedOnce &&
      posts.length === 0 &&
      responsivePageSize !== null
    ) {
      void loadMore();
      return;
    }

    if (!loaderRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        void loadMore();
      },
      { rootMargin: "300px" },
    );

    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [
    autoloadFirstPage,
    disableInfinite,
    hasLoadedOnce,
    loadMore,
    posts.length,
    responsivePageSize,
  ]);

  useEffect(() => {
    if (disableInfinite) {
      return;
    }

    const handleNearEnd = () => {
      void loadMore();
    };

    window.addEventListener("orange-scroll-area-near-end", handleNearEnd);

    return () => {
      window.removeEventListener("orange-scroll-area-near-end", handleNearEnd);
    };
  }, [disableInfinite, loadMore]);

  if (!loading && posts.length === 0 && !hasMore && hasLoadedOnce) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const groupedPosts = groupBySearchCategory
    ? SEARCH_RESULT_GROUPS.map((group) => ({
        label: group.label,
        posts: posts.filter(group.matches),
      })).filter((group) => group.posts.length > 0)
    : [];

  const renderPostCard = (post: PostListItem, eagerThumbnail = false) => (
    <PostCard
      key={post.id}
      id={post.id}
      title={post.title}
      description={post.content}
      thumbnail={post.thumbnail}
      category={post.category_name}
      author={post.author_name}
      authorImage={post.author_image}
      likes={post.likes_count}
      reactions={post.reactions_count ?? 0}
      comments={post.comments_count}
      views={post.view_count}
      createdAt={new Date(post.created_at)}
      isHidden={post.is_hidden}
      isSecret={post.is_secret}
      canViewSecret={post.can_view_secret}
      postRouteSection={postRouteSection}
      thumbnailLoading={eagerThumbnail ? "eager" : "lazy"}
    />
  );

  const renderSearchNoticeTable = (
    label: (typeof SEARCH_RESULT_GROUPS)[number]["label"],
    groupPosts: PostListItem[],
  ) => {
    const isQnaGroup = label === "문의";
    const formatNoticeTableDate = (value: Date | string) => {
      const formatted = formatSeoulDate(value);

      return noticeTableDateWithoutWeekday
        ? formatted.replace(/\s*\([^)]*\)/, "")
        : formatted;
    };

    return (
      <div className="overflow-x-auto border-y bg-background">
        <div
          className={`grid min-w-[560px] items-center gap-3 border-b bg-muted/40 px-5 py-3 text-center text-xs font-semibold text-muted-foreground ${
            isQnaGroup
              ? "min-w-[640px] grid-cols-[48px_minmax(0,1fr)_88px_92px_56px_56px]"
              : "grid-cols-[48px_minmax(0,1fr)_88px_92px_56px]"
          }`}
        >
          <span>번호</span>
          <span>제목</span>
          <span>작성자</span>
          <span>작성일</span>
          <span>조회</span>
          {isQnaGroup ? <span>상태</span> : null}
        </div>

        {groupPosts.map((post, index) => {
          const href =
            post.category_name === "FAQ"
              ? getLogFaqPath(post.id)
              : getLogNoticePath(post.id);
          const number = groupPosts.length - index;
          const statusLabel = getInquiryStatusLabel(post);

          return (
            <Link
              key={post.id}
              href={href}
              className={`grid min-w-[560px] items-center gap-3 border-b px-5 py-4 transition-colors last:border-b-0 hover:bg-muted/30 ${
                isQnaGroup
                  ? "min-w-[640px] grid-cols-[48px_minmax(0,1fr)_88px_92px_56px_56px]"
                  : "grid-cols-[48px_minmax(0,1fr)_88px_92px_56px]"
              }`}
            >
              <span className="text-center text-sm font-semibold tabular-nums text-muted-foreground">
                {number}
              </span>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="hidden shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                    {number}
                  </span>
                  {post.category_name === "FAQ" ? (
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      Q.
                    </span>
                  ) : null}
                  <p className="truncate text-sm font-semibold text-foreground">
                    {post.title}
                  </p>
                  {post.is_secret ? (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                  {post.is_hidden ? (
                    <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : null}
                </div>
                <div className="hidden mt-2 flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <Image
                      src={post.author_image ?? "/logo.png"}
                      alt={`${post.author_name} 프로필`}
                      width={18}
                      height={18}
                      className={`h-4.5 w-4.5 shrink-0 rounded-full border object-cover ${!post.author_image ? "grayscale" : ""}`}
                    />
                    <span className="truncate">{post.author_name}</span>
                  </span>
                  <span>{formatNoticeTableDate(post.created_at)}</span>
                  <span>조회 {post.view_count ?? 0}</span>
                  {isQnaGroup ? (
                    <span
                      className={`font-semibold ${getInquiryStatusClassName(post)}`}
                    >
                      {statusLabel}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex min-w-0 items-center justify-center gap-2">
                <Image
                  src={post.author_image ?? "/logo.png"}
                  alt={`${post.author_name} 프로필`}
                  width={24}
                  height={24}
                  className={`h-6 w-6 shrink-0 rounded-full border object-cover ${!post.author_image ? "grayscale" : ""}`}
                />
                <span className="truncate text-sm text-muted-foreground">
                  {post.author_name}
                </span>
              </div>
              <span className="text-center text-sm text-muted-foreground">
                {formatNoticeTableDate(post.created_at)}
              </span>
              <span className="text-center text-sm text-muted-foreground">
                {post.view_count ?? 0}
              </span>
              {isQnaGroup ? (
                <span
                  className={`text-center text-sm font-semibold ${getInquiryStatusClassName(post)}`}
                >
                  {statusLabel}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {responsiveRowLoading ? (
        <div
          ref={gridProbeRef}
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-px overflow-hidden opacity-0 ${gridClassName}`}
        >
          {GRID_PROBE_ITEMS.map((item) => (
            <span key={item} className="h-px min-w-0" />
          ))}
        </div>
      ) : null}

      {noticeTableLabel && posts.length > 0 ? (
        renderSearchNoticeTable(noticeTableLabel, posts)
      ) : groupBySearchCategory && groupedPosts.length > 0 ? (
        <div className="space-y-8">
          {groupedPosts.map((group) => (
            <section key={group.label} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold">{group.label}</h2>
                  <span className="text-sm font-medium text-muted-foreground">
                    {group.posts.length}
                  </span>
                </div>
                {group.label === "FAQ"
                  ? faqSearchGroupTitleAction
                  : SEARCH_SORTABLE_GROUPS.has(group.label)
                    ? searchGroupTitleAction
                    : null}
              </div>
              {SEARCH_NOTICE_GROUPS.has(group.label) ? (
                renderSearchNoticeTable(group.label, group.posts)
              ) : (
                <div className={gridClassName}>
                  {group.posts.map((post, index) =>
                    renderPostCard(post, index < 6),
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : posts.length > 0 ? (
        <div className={gridClassName}>
          {posts.map((post, index) => renderPostCard(post, index < 6))}
        </div>
      ) : null}

      {hasMore && <div ref={loaderRef} className="h-16 w-full" />}

      {loading && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {loadingMessage}
        </p>
      )}
    </>
  );
}
