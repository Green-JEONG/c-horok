"use client";

import { EyeOff, Lock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import MyPageHeadingPortal from "@/components/mypage/MyPageHeadingPortal";
import SectionPagination from "@/components/mypage/sections/SectionPagination";
import { getTechFaqPath, getTechNoticePath } from "@/lib/routes";
import { formatSeoulDate } from "@/lib/utils";

const PAGE_SIZE = 10;

type AdminPost = {
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
  is_hidden: boolean;
  is_secret: boolean;
};

type AdminPostsResponse = {
  posts: AdminPost[];
  totalCount: number;
  resolvedPage?: number;
};

type Props = {
  category: "공지" | "FAQ";
  title: string;
  emptyMessage: string;
};

export default function MyAdminPostsSection({
  category,
  title,
  emptyMessage,
}: Props) {
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const targetPostId = useMemo(() => {
    const value = Number(searchParams.get("postId") ?? "");
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [searchParams]);
  const sort = searchParams.get("sort")?.trim() || null;
  const query = searchParams.get("q")?.trim() || null;
  const searchTarget = searchParams.get("searchTarget")?.trim() || null;
  const listKey = `${category}:${sort ?? ""}:${query ?? ""}:${
    searchTarget ?? ""
  }`;
  const previousListKeyRef = useRef(listKey);

  useEffect(() => {
    if (previousListKeyRef.current === listKey) {
      return;
    }

    previousListKeyRef.current = listKey;
    setPage(1);
  }, [listKey]);

  useEffect(() => {
    let cancelled = false;

    const loadPosts = async () => {
      setLoading(true);

      try {
        const params = new URLSearchParams({
          category,
          page: String(page),
          limit: String(PAGE_SIZE),
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

        const response = await fetch(
          `/api/mypage/admin-posts?${params.toString()}`,
        );
        const data: AdminPostsResponse = await response.json();

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
  }, [category, page, query, searchTarget, sort, targetPostId]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const isFaqCategory = category === "FAQ";
  const headingContent = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="truncate">{title}</span>
      <span className="text-sm font-medium text-muted-foreground">
        {totalCount}
      </span>
    </span>
  );

  return (
    <section className="space-y-4">
      <MyPageHeadingPortal>{headingContent}</MyPageHeadingPortal>

      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      ) : posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <>
          <div className="overflow-hidden border-y bg-background">
            <div className="hidden grid-cols-[48px_minmax(0,1fr)_88px_92px_56px] items-center gap-3 border-b bg-muted/40 px-5 py-3 text-center text-xs font-semibold text-muted-foreground md:grid">
              <span>번호</span>
              <span>제목</span>
              <span>작성자</span>
              <span>작성일</span>
              <span>조회</span>
            </div>
            {posts.map((post, index) => {
              const postNumber = totalCount - (page - 1) * PAGE_SIZE - index;
              const href = isFaqCategory
                ? getTechFaqPath(post.id)
                : getTechNoticePath(post.id);

              return (
                <Link
                  key={post.id}
                  href={href}
                  className="flex flex-col gap-3 border-b px-4 py-4 transition-colors last:border-b-0 hover:bg-muted/30 md:grid md:grid-cols-[48px_minmax(0,1fr)_88px_92px_56px] md:items-center md:gap-3 md:px-5"
                >
                  <span className="hidden text-center text-sm font-semibold tabular-nums text-muted-foreground md:block">
                    {postNumber}
                  </span>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground md:hidden">
                        {postNumber}
                      </span>
                      {isFaqCategory ? (
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
