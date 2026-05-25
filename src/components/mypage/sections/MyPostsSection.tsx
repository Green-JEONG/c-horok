"use client";

import { Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MyPageHeaderControls from "@/components/mypage/MyPageHeaderControls";
import MyPageHeadingActionsPortal from "@/components/mypage/MyPageHeadingActionsPortal";
import MyPageHeadingPortal from "@/components/mypage/MyPageHeadingPortal";
import PostCard from "@/components/posts/PostCard";
import {
  clearSyncedPostDraft,
  getTechPostDraftStorageKey,
  loadSyncedPostDrafts,
} from "@/lib/post-drafts";
import { comparePostMetrics, parseSortType } from "@/lib/post-sort";
import { getTechFeedNewPostPath } from "@/lib/routes";

const GRID_PROBE_ITEMS = [
  "probe-1",
  "probe-2",
  "probe-3",
  "probe-4",
  "probe-5",
];
const POST_GRID_CLASS_NAME =
  "grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
const INITIAL_VISIBLE_ROW_COUNT = 3;

type MyPost = {
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
  is_hidden: boolean;
  is_secret: boolean;
};

type DraftPost = MyPost & {
  is_draft?: boolean;
  draft_id?: string;
  href_override?: string;
};

type MyPostsResponse = {
  posts: MyPost[];
  totalCount: number;
  resolvedPage?: number;
};

function sortPostCards(posts: DraftPost[], sortValue: string | null) {
  const parsedSort = parseSortType(sortValue);

  return [...posts].sort((a, b) =>
    comparePostMetrics(
      parsedSort,
      {
        createdAt: new Date(a.created_at),
        likeCount: a.likes_count,
        commentsCount: a.comments_count,
        viewCount: a.view_count ?? 0,
        id: a.id,
        categoryName: a.category_name,
      },
      {
        createdAt: new Date(b.created_at),
        likeCount: b.likes_count,
        commentsCount: b.comments_count,
        viewCount: b.view_count ?? 0,
        id: b.id,
        categoryName: b.category_name,
      },
    ),
  );
}

export default function MyPostsSection() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [posts, setPosts] = useState<DraftPost[]>([]);
  const [visiblePostLimit, setVisiblePostLimit] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [draftPostCount, setDraftPostCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageSize, setPageSize] = useState<number | null>(null);
  const [highlightedPostId, setHighlightedPostId] = useState<number | null>(
    null,
  );
  const fetchingRef = useRef(false);
  const serverPostOffsetRef = useRef(0);
  const nearEndRevealLockedRef = useRef(false);
  const nearEndRevealUnlockTimeoutRef = useRef<number | null>(null);
  const gridProbeRef = useRef<HTMLDivElement | null>(null);
  const targetPostId = useMemo(() => {
    const value = Number(searchParams.get("postId") ?? "");
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [searchParams]);
  const categorySlug = searchParams.get("category")?.trim() || null;
  const sort = searchParams.get("sort")?.trim() || null;
  const query = searchParams.get("q")?.trim() || null;
  const searchTarget = searchParams.get("searchTarget")?.trim() || null;
  const listKey = `${categorySlug ?? ""}:${sort ?? ""}:${query ?? ""}:${
    searchTarget ?? ""
  }`;
  const previousListKeyRef = useRef(listKey);
  const draftStorageKey = getTechPostDraftStorageKey();

  useEffect(() => {
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

      setPageSize((current) => {
        if (current !== next) {
          setPosts([]);
          setVisiblePostLimit(next * INITIAL_VISIBLE_ROW_COUNT);
          setTotalCount(0);
          setHasMore(false);
          serverPostOffsetRef.current = 0;
          fetchingRef.current = false;
        }
        return current === next ? current : next;
      });
    };

    const frame = window.requestAnimationFrame(updatePageSize);
    const observer = new ResizeObserver(updatePageSize);
    observer.observe(probe);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      if (nearEndRevealUnlockTimeoutRef.current !== null) {
        window.clearTimeout(nearEndRevealUnlockTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (previousListKeyRef.current === listKey) {
      return;
    }

    previousListKeyRef.current = listKey;
    serverPostOffsetRef.current = 0;
  }, [listKey]);

  const loadPostsPage = useCallback(
    async (
      requestedOffset: number,
      options: { replace: boolean; includeTarget: boolean },
    ) => {
      if (fetchingRef.current || pageSize === null) {
        return;
      }

      fetchingRef.current = true;
      if (options.replace) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const requestLimit = options.replace
          ? pageSize * INITIAL_VISIBLE_ROW_COUNT
          : pageSize;
        const params = new URLSearchParams({
          limit: String(requestLimit),
        });
        if (options.includeTarget && typeof targetPostId === "number") {
          params.set("targetPostId", String(targetPostId));
        } else {
          params.set("offset", String(requestedOffset));
        }
        if (categorySlug) {
          params.set("category", categorySlug);
        }
        if (sort) {
          params.set("sort", sort);
        }
        if (query) {
          params.set("q", query);
        }
        if (searchTarget) {
          params.set("searchTarget", searchTarget);
        }

        const response = await fetch(`/api/mypage/posts?${params.toString()}`);
        const data: MyPostsResponse = await response.json();
        const nextPosts = Array.isArray(data.posts) ? data.posts : [];
        const nextTotalCount =
          typeof data.totalCount === "number" ? data.totalCount : 0;
        const drafts =
          status === "authenticated" &&
          options.replace &&
          requestedOffset === 0 &&
          !categorySlug &&
          !targetPostId
            ? await loadSyncedPostDrafts(draftStorageKey)
            : [];
        const draftPosts =
          options.replace && drafts.length > 0
            ? drafts.map((draft, index) => ({
                id: -1 - index,
                title: draft.title.trim() || "임시저장된 글",
                content: draft.content.trim() || "임시 저장된 글입니다.",
                thumbnail: draft.thumbnailUrl ?? null,
                created_at: draft.savedAt,
                author_name: session?.user?.name ?? "Unknown",
                author_image: session?.user?.image ?? null,
                category_name: "임시저장",
                view_count: 0,
                likes_count: 0,
                reactions_count: 0,
                comments_count: 0,
                is_hidden: false,
                is_secret: false,
                is_draft: true,
                draft_id: draft.id,
                href_override: `${getTechFeedNewPostPath()}?draftId=${encodeURIComponent(
                  draft.id ?? "",
                )}`,
              }))
            : [];
        const mergedPosts =
          draftPosts.length > 0 ? [...draftPosts, ...nextPosts] : nextPosts;
        const sortedMergedPosts = sortPostCards(mergedPosts, sort);
        const nextServerPostOffset = options.replace
          ? nextPosts.length
          : serverPostOffsetRef.current + nextPosts.length;

        if (options.replace) {
          setDraftPostCount(draftPosts.length);
        }
        setPosts((current) => {
          if (options.replace) {
            setVisiblePostLimit(pageSize * INITIAL_VISIBLE_ROW_COUNT);
            return sortedMergedPosts;
          }

          const existingIds = new Set(current.map((post) => post.id));
          return sortPostCards(
            [
              ...current,
              ...nextPosts.filter((post) => !existingIds.has(post.id)),
            ],
            sort,
          );
        });
        serverPostOffsetRef.current = nextServerPostOffset;
        setTotalCount(nextTotalCount);
        setHasMore(nextServerPostOffset < nextTotalCount);
      } catch {
        if (options.replace) {
          setDraftPostCount(0);
          setPosts([]);
          setTotalCount(0);
          setHasMore(false);
        }
      } finally {
        fetchingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      categorySlug,
      draftStorageKey,
      pageSize,
      query,
      searchTarget,
      session?.user?.image,
      session?.user?.name,
      sort,
      status,
      targetPostId,
    ],
  );

  useEffect(() => {
    if (pageSize === null) {
      return;
    }

    setPosts([]);
    setTotalCount(0);
    setHasMore(false);
    serverPostOffsetRef.current = 0;
    fetchingRef.current = false;
    void loadPostsPage(0, {
      replace: true,
      includeTarget: typeof targetPostId === "number",
    });
  }, [pageSize, targetPostId, loadPostsPage]);

  useEffect(() => {
    const handleNearEnd = async () => {
      if (
        pageSize === null ||
        loading ||
        loadingMore ||
        nearEndRevealLockedRef.current
      ) {
        return;
      }

      nearEndRevealLockedRef.current = true;

      const unlockNearEndReveal = () => {
        if (nearEndRevealUnlockTimeoutRef.current !== null) {
          window.clearTimeout(nearEndRevealUnlockTimeoutRef.current);
        }

        nearEndRevealUnlockTimeoutRef.current = window.setTimeout(() => {
          nearEndRevealLockedRef.current = false;
        }, 450);
      };

      const currentVisiblePostLimit = visiblePostLimit ?? pageSize;
      const hiddenLoadedPostCount = Math.max(
        0,
        posts.length - currentVisiblePostLimit,
      );

      if (!hasMore && hiddenLoadedPostCount === 0) {
        nearEndRevealLockedRef.current = false;
        return;
      }

      if (hiddenLoadedPostCount < pageSize && hasMore) {
        await loadPostsPage(serverPostOffsetRef.current, {
          replace: false,
          includeTarget: false,
        });
      }

      setVisiblePostLimit((current) =>
        current === null ? pageSize : current + pageSize,
      );
      unlockNearEndReveal();
    };

    window.addEventListener("orange-scroll-area-near-end", handleNearEnd);

    return () => {
      window.removeEventListener("orange-scroll-area-near-end", handleNearEnd);
    };
  }, [
    hasMore,
    loadPostsPage,
    loading,
    loadingMore,
    pageSize,
    posts.length,
    visiblePostLimit,
  ]);

  useEffect(() => {
    if (typeof targetPostId !== "number") {
      return;
    }

    const targetExists = posts.some((post) => post.id === targetPostId);
    if (!targetExists) {
      return;
    }

    setHighlightedPostId(targetPostId);

    const scrollTimeout = window.setTimeout(() => {
      const element = document.getElementById(`mypage-post-${targetPostId}`);
      element?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    const highlightTimeout = window.setTimeout(() => {
      setHighlightedPostId((current) =>
        current === targetPostId ? null : current,
      );
    }, 2600);

    return () => {
      window.clearTimeout(scrollTimeout);
      window.clearTimeout(highlightTimeout);
    };
  }, [posts, targetPostId]);

  const sectionTitle = categorySlug ? "게시물" : "내 글";
  const displayedTotalCount = categorySlug
    ? totalCount
    : totalCount + draftPostCount;
  const headingContent = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="truncate">{sectionTitle}</span>
      <span className="text-sm font-medium text-muted-foreground">
        {displayedTotalCount}
      </span>
    </span>
  );
  const visiblePosts =
    visiblePostLimit === null ? posts : posts.slice(0, visiblePostLimit);
  const canShowMorePosts =
    hasMore || (visiblePostLimit !== null && posts.length > visiblePostLimit);

  async function handleDeleteDraft(post: DraftPost) {
    if (!post.is_draft || !post.draft_id) {
      return;
    }

    const confirmed = window.confirm("이 임시저장 글을 삭제할까요?");
    if (!confirmed) {
      return;
    }

    await clearSyncedPostDraft(draftStorageKey, post.draft_id);
    setPosts((current) =>
      current.filter((item) => item.draft_id !== post.draft_id),
    );
    setDraftPostCount((current) => Math.max(0, current - 1));
  }

  return (
    <section className="relative space-y-4" id="mypage-posts">
      <div
        ref={gridProbeRef}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 -z-10 h-px overflow-hidden opacity-0 ${POST_GRID_CLASS_NAME}`}
      >
        {GRID_PROBE_ITEMS.map((item) => (
          <span key={item} className="h-px min-w-0" />
        ))}
      </div>

      <MyPageHeadingPortal disabled={Boolean(categorySlug)}>
        {headingContent}
      </MyPageHeadingPortal>
      <MyPageHeadingActionsPortal disabled={!categorySlug}>
        <MyPageHeaderControls />
      </MyPageHeadingActionsPortal>

      {categorySlug ? (
        <div className="flex items-center gap-3">
          <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold">
            {headingContent}
          </h2>
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : visiblePosts.length === 0 ? (
        <p className="text-sm text-muted-foreground">작성한 글이 없습니다.</p>
      ) : (
        <>
          <div className={POST_GRID_CLASS_NAME}>
            {visiblePosts.map((post, index) => (
              <div
                key={post.id}
                id={post.id > 0 ? `mypage-post-${post.id}` : undefined}
                className="relative rounded-xl transition-colors"
              >
                <PostCard
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
                  isDraft={post.is_draft}
                  hrefOverride={post.href_override}
                  showCategoryBadge={!post.is_draft}
                  thumbnailLoading={index < 6 ? "eager" : "lazy"}
                  className={
                    highlightedPostId === post.id
                      ? "border-primary bg-primary/5"
                      : ""
                  }
                />
                {post.is_draft ? (
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleDeleteDraft(post);
                    }}
                    className="absolute top-2 right-2 z-30 inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-500 bg-red-500 text-white transition hover:bg-red-600"
                    aria-label="임시저장 글 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {canShowMorePosts ? <div className="h-14 w-full" /> : null}
          {loadingMore ? (
            <p className="text-center text-sm text-muted-foreground">
              더 불러오는 중…
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
