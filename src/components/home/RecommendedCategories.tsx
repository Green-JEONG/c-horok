"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type Category = {
  id: number;
  name: string;
  slug: string;
  postCount: number;
};

const CATEGORY_PAGE_SIZE = 10;

export default function RecommendedCategories() {
  const pathname = usePathname();
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  useEffect(() => {
    const userPageMatch = pathname.match(/^\/users\/(\d+)$/);
    const currentUserId = session?.user?.id;
    const endpoint = userPageMatch
      ? `/api/categories/recommended?userId=${userPageMatch[1]}`
      : pathname === "/mypage" && currentUserId
        ? `/api/categories/recommended?userId=${currentUserId}`
        : "/api/categories/recommended";

    fetch(endpoint)
      .then((res) => res.json())
      .then((nextCategories) => {
        setCategories(nextCategories);
        setPage(0);
      })
      .catch(console.error);
  }, [pathname, session?.user?.id]);

  const pageCount = Math.max(
    1,
    Math.ceil(categories.length / CATEGORY_PAGE_SIZE),
  );
  const normalizedPage = page % pageCount;
  const visibleCategories = categories.slice(
    normalizedPage * CATEGORY_PAGE_SIZE,
    normalizedPage * CATEGORY_PAGE_SIZE + CATEGORY_PAGE_SIZE,
  );
  const canPageCategories = categories.length > CATEGORY_PAGE_SIZE;

  function showPreviousCategories() {
    setPage((currentPage) => (currentPage - 1 + pageCount) % pageCount);
  }

  function showNextCategories() {
    setPage((currentPage) => (currentPage + 1) % pageCount);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Image src="/thumb.svg" alt="thumb" width={18} height={18} />
          <h3 className="truncate text-lg font-bold tracking-tight">
            카테고리
          </h3>
        </div>
        {canPageCategories ? (
          <div className="inline-flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={showPreviousCategories}
              className="rounded-full border border-border bg-background p-1 text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
              aria-label="이전 카테고리 목록"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={showNextCategories}
              className="rounded-full border border-border bg-background p-1 text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
              aria-label="다음 카테고리 목록"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {categories.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          아직 작성된 게시글 태그가 없습니다.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                const userPageMatch = pathname.match(/^\/users\/(\d+)$/);

                if (userPageMatch) {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("category", c.slug);
                  router.push(
                    `/users/${userPageMatch[1]}?${params.toString()}`,
                  );
                  return;
                }

                if (pathname === "/mypage" && session?.user?.id) {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("category", c.slug);
                  router.push(`/mypage?${params.toString()}`);
                  return;
                }

                router.push(`/search?category=${encodeURIComponent(c.slug)}`);
              }}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
            >
              #{c.name.toLocaleLowerCase()}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
