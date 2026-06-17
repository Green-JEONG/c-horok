"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MyPageHeadingPortal from "@/components/mypage/MyPageHeadingPortal";
import {
  getLogFaqPath,
  getLogFeedPostPath,
  getLogNoticePath,
} from "@/lib/routes";
import { formatSeoulDate } from "@/lib/utils";

const PAGE_SIZE = 5;

type MyComment = {
  id: number;
  content: string;
  created_at: string;
  post_id: number;
  post_title: string;
  is_post_deleted: boolean;
  is_notice_post: boolean;
  notice_category_name?: string | null;
};

type MyCommentsResponse = {
  comments: MyComment[];
  totalCount: number;
  resolvedPage?: number;
};

export default function MyCommentsSection() {
  const searchParams = useSearchParams();
  const [comments, setComments] = useState<MyComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [nextPage, setNextPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [highlightedCommentId, setHighlightedCommentId] = useState<
    number | null
  >(null);
  const targetCommentId = useMemo(() => {
    const value = Number(searchParams.get("commentId") ?? "");
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [searchParams]);
  const targetPostId = useMemo(() => {
    const value = Number(searchParams.get("postId") ?? "");
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [searchParams]);
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const sort = searchParams.get("sort") ?? "latest";
  const filterKey = `${query}:${sort}`;
  const previousFilterKeyRef = useRef(filterKey);
  const fetchingRef = useRef(false);

  const loadComments = useCallback(
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
          page: String(page),
          limit: String(PAGE_SIZE),
          sort,
        });
        if (query) {
          params.set("q", query);
        }

        const response = await fetch(`/api/mypage/comments?${params}`);
        const data: MyCommentsResponse = await response.json();
        const nextComments = Array.isArray(data.comments) ? data.comments : [];
        const resolvedPage =
          typeof data.resolvedPage === "number" && data.resolvedPage > 0
            ? data.resolvedPage
            : page;
        const nextTotalCount =
          typeof data.totalCount === "number" ? data.totalCount : 0;

        setComments((current) => {
          if (options.replace) {
            return nextComments;
          }

          const existingIds = new Set(current.map((comment) => comment.id));
          return [
            ...current,
            ...nextComments.filter((comment) => !existingIds.has(comment.id)),
          ];
        });
        setTotalCount(nextTotalCount);
        setNextPage(resolvedPage + 1);
        setHasMore(resolvedPage * PAGE_SIZE < nextTotalCount);
      } catch {
        if (options.replace) {
          setComments([]);
          setTotalCount(0);
          setHasMore(false);
        }
      } finally {
        fetchingRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, sort],
  );

  useEffect(() => {
    void loadComments(1, { replace: true });
  }, [loadComments]);

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

      void loadComments(nextPage);
    };

    window.addEventListener("orange-scroll-area-near-end", handleNearEnd);

    return () => {
      window.removeEventListener("orange-scroll-area-near-end", handleNearEnd);
    };
  }, [hasMore, loadComments, loading, loadingMore, nextPage]);

  useEffect(() => {
    if (comments.length === 0) {
      return;
    }

    const nextComment =
      typeof targetCommentId === "number"
        ? comments.find((comment) => comment.id === targetCommentId)
        : typeof targetPostId === "number"
          ? comments.find((comment) => comment.post_id === targetPostId)
          : null;

    if (!nextComment) {
      return;
    }

    setHighlightedCommentId(nextComment.id);
  }, [comments, targetCommentId, targetPostId]);

  useEffect(() => {
    if (typeof highlightedCommentId !== "number") {
      return;
    }

    const visible = comments.some(
      (comment) => comment.id === highlightedCommentId,
    );
    if (!visible) {
      return;
    }

    const scrollTimeout = window.setTimeout(() => {
      const element = document.getElementById(
        `mypage-comment-${highlightedCommentId}`,
      );
      element?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    const highlightTimeout = window.setTimeout(() => {
      setHighlightedCommentId((current) =>
        current === highlightedCommentId ? null : current,
      );
    }, 2600);

    return () => {
      window.clearTimeout(scrollTimeout);
      window.clearTimeout(highlightTimeout);
    };
  }, [comments, highlightedCommentId]);

  const headingContent = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="truncate">내 댓글</span>
      <span className="text-sm font-medium text-muted-foreground">
        {totalCount}
      </span>
    </span>
  );

  if (loading)
    return (
      <section className="space-y-4">
        <MyPageHeadingPortal>{headingContent}</MyPageHeadingPortal>
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </section>
    );

  return (
    <section className="space-y-4">
      <MyPageHeadingPortal>{headingContent}</MyPageHeadingPortal>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">작성한 댓글이 없습니다.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {comments.map(
              ({
                id,
                content,
                created_at,
                post_id,
                post_title,
                is_post_deleted,
                is_notice_post,
                notice_category_name,
              }) => (
                <li
                  key={id}
                  id={`mypage-comment-${id}`}
                  className="scroll-mt-28 rounded-lg transition-colors"
                >
                  {is_post_deleted ? (
                    <div
                      className={`block rounded-lg border p-4 text-sm opacity-70 ${
                        highlightedCommentId === id
                          ? "border-primary bg-primary/5"
                          : "card-hover-scale mypage-comment-hover-scale bg-background"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <p className="line-clamp-2 text-sm text-foreground">
                          {content}
                        </p>
                        <p className="shrink-0">
                          {formatSeoulDate(created_at)}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {post_title}
                      </p>
                    </div>
                  ) : (
                    (() => {
                      const postHref =
                        is_notice_post && notice_category_name === "FAQ"
                          ? `${getLogFaqPath(post_id)}&commentId=${id}`
                          : `${
                              is_notice_post
                                ? getLogNoticePath(post_id)
                                : getLogFeedPostPath(post_id)
                            }?commentId=${id}`;

                      return (
                        <Link
                          href={postHref}
                          className={`card-hover-scale mypage-comment-hover-scale block rounded-lg border bg-background px-4 py-3 text-sm ${
                            highlightedCommentId === id
                              ? "border-primary bg-primary/5"
                              : ""
                          }`}
                        >
                          <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                            <p className="line-clamp-2 text-sm text-foreground">
                              {content}
                            </p>
                            <p className="shrink-0">
                              {formatSeoulDate(created_at)}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {post_title}에 달린 댓글
                          </p>
                        </Link>
                      );
                    })()
                  )}
                </li>
              ),
            )}
          </ul>
          {hasMore ? <div className="h-12 w-full" /> : null}
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
