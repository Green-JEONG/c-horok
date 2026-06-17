"use client";

import { EyeOff, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import MyPageHeadingPortal from "@/components/mypage/MyPageHeadingPortal";
import SectionPagination from "@/components/mypage/sections/SectionPagination";
import { getLogNoticePath } from "@/lib/routes";
import { formatSeoulDate } from "@/lib/utils";

const DEFAULT_PREVIEW_PAGE_SIZE = 4;

function getResponsivePageSize() {
  if (typeof window === "undefined") {
    return DEFAULT_PREVIEW_PAGE_SIZE;
  }

  if (window.innerWidth >= 1280) {
    return 10;
  }

  if (window.innerWidth >= 1024) {
    return 8;
  }

  if (window.innerWidth >= 640) {
    return 6;
  }

  return 4;
}

type MyQnaPost = {
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
  comments_count: number;
  is_resolved?: boolean;
  has_admin_answer?: boolean;
  is_hidden: boolean;
  is_secret: boolean;
};

type MyQnaResponse = {
  posts: MyQnaPost[];
  totalCount: number;
  resolvedPage?: number;
};

export default function MyQnaSection() {
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<MyQnaPost[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(DEFAULT_PREVIEW_PAGE_SIZE);
  const [highlightedPostId, setHighlightedPostId] = useState<number | null>(
    null,
  );
  const targetPostId = useMemo(() => {
    const value = Number(searchParams.get("qnaPostId") ?? "");
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [searchParams]);
  const sort = searchParams.get("sort")?.trim() || null;
  const query = searchParams.get("q")?.trim() || null;
  const searchTarget = searchParams.get("searchTarget")?.trim() || null;
  const listKey = `${sort ?? ""}:${query ?? ""}:${searchTarget ?? ""}`;
  const previousListKeyRef = useRef(listKey);

  useEffect(() => {
    if (previousListKeyRef.current === listKey) {
      return;
    }

    previousListKeyRef.current = listKey;
    setPage(1);
  }, [listKey]);

  useEffect(() => {
    const updatePageSize = () => {
      setPageSize((current) => {
        const next = getResponsivePageSize();
        if (current !== next) {
          setPage(1);
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
    let cancelled = false;

    const loadPosts = async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
        });
        if (typeof targetPostId === "number") {
          params.set("targetPostId", String(targetPostId));
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

        const response = await fetch(`/api/mypage/qna?${params.toString()}`);
        const data: MyQnaResponse = await response.json();

        if (cancelled) return;

        if (
          typeof data.resolvedPage === "number" &&
          data.resolvedPage > 0 &&
          data.resolvedPage !== page
        ) {
          setPage(data.resolvedPage);
        }
        setPosts(Array.isArray(data.posts) ? data.posts : []);
        setTotalCount(
          typeof data.totalCount === "number" ? data.totalCount : 0,
        );
      } catch {
        if (cancelled) return;
        setPosts([]);
        setTotalCount(0);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, query, searchTarget, sort, targetPostId]);

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
      const element = document.getElementById(`mypage-qna-${targetPostId}`);
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

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const headingContent = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="truncate">내 질문</span>
      <span className="text-sm font-medium text-muted-foreground">
        {totalCount}
      </span>
    </span>
  );
  const getStatusLabel = (post: MyQnaPost) => {
    if (post.is_resolved) {
      return "답변 완료";
    }

    return post.has_admin_answer ? "확인 중" : "접수 완료";
  };
  const getStatusClassName = (post: MyQnaPost) => {
    if (post.is_resolved) {
      return "text-green-500";
    }

    return post.has_admin_answer ? "text-blue-500" : "text-red-500";
  };

  return (
    <section className="space-y-4" id="mypage-qna">
      <MyPageHeadingPortal>{headingContent}</MyPageHeadingPortal>

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">작성한 문의가 없습니다.</p>
      ) : (
        <>
          <div className="overflow-hidden border-y bg-background">
            <div className="hidden grid-cols-[48px_minmax(0,1fr)_88px_92px_56px_56px] items-center gap-3 border-b bg-muted/40 px-5 py-3 text-center text-xs font-semibold text-muted-foreground md:grid">
              <span>번호</span>
              <span>제목</span>
              <span>작성자</span>
              <span>작성일</span>
              <span>조회</span>
              <span>상태</span>
            </div>
            {posts.map((post, index) => {
              const postNumber = totalCount - (page - 1) * pageSize - index;
              const statusLabel = getStatusLabel(post);
              const statusClassName = getStatusClassName(post);

              return (
                <Link
                  href={getLogNoticePath(post.id)}
                  key={post.id}
                  id={`mypage-qna-${post.id}`}
                  className={`flex flex-col gap-3 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/30 md:grid md:grid-cols-[48px_minmax(0,1fr)_88px_92px_56px_56px] md:items-center md:gap-3 md:px-5 ${
                    highlightedPostId === post.id
                      ? "border-primary bg-primary/5"
                      : ""
                  }`}
                >
                  <span className="hidden text-center text-sm font-semibold tabular-nums text-muted-foreground md:block">
                    {postNumber}
                  </span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground md:hidden">
                        {postNumber}
                      </span>
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
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground md:hidden">
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
                      <span>{formatSeoulDate(post.created_at)}</span>
                      <span>조회 {post.view_count ?? 0}</span>
                      <span className={`font-semibold ${statusClassName}`}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                  <div className="hidden min-w-0 items-center justify-center gap-2 md:flex">
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
                  <span className="hidden text-center text-sm text-muted-foreground md:block">
                    {formatSeoulDate(post.created_at)}
                  </span>
                  <span className="hidden text-center text-sm text-muted-foreground md:block">
                    {post.view_count ?? 0}
                  </span>
                  <span
                    className={`hidden text-center text-sm font-semibold md:block ${statusClassName}`}
                  >
                    {statusLabel}
                  </span>
                </Link>
              );
            })}
          </div>
          <SectionPagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
