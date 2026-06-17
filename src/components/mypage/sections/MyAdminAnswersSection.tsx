"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import MyPageHeadingPortal from "@/components/mypage/MyPageHeadingPortal";
import SectionPagination from "@/components/mypage/sections/SectionPagination";
import { getLogNoticePath } from "@/lib/routes";
import { formatSeoulDate } from "@/lib/utils";

const PAGE_SIZE = 5;

type AdminAnswer = {
  id: number;
  content: string;
  created_at: string;
  post_id: number;
  post_title: string;
};

export default function MyAdminAnswersSection() {
  const searchParams = useSearchParams();
  const [answers, setAnswers] = useState<AdminAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const sort = searchParams.get("sort") ?? "latest";
  const filterKey = `${query}:${sort}`;
  const previousFilterKeyRef = useRef(filterKey);

  useEffect(() => {
    fetch("/api/mypage/admin-answers")
      .then((res) => res.json())
      .then(setAnswers)
      .finally(() => setLoading(false));
  }, []);

  const sortedAnswers = useMemo(() => {
    const filteredAnswers = answers.filter((answer) => {
      if (!query) {
        return true;
      }

      return (
        answer.content.toLowerCase().includes(query) ||
        answer.post_title.toLowerCase().includes(query)
      );
    });

    return [...filteredAnswers].sort((a, b) => {
      const dateDiff =
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

      return sort === "oldest" ? -dateDiff : dateDiff;
    });
  }, [answers, query, sort]);
  const totalPages = Math.max(1, Math.ceil(sortedAnswers.length / PAGE_SIZE));
  const pagedAnswers = sortedAnswers.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  useEffect(() => {
    if (previousFilterKeyRef.current === filterKey) {
      return;
    }

    previousFilterKeyRef.current = filterKey;
    setPage(1);
  }, [filterKey]);
  const headingContent = (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span className="truncate">내 답변</span>
      <span className="text-sm font-medium text-muted-foreground">
        {sortedAnswers.length}
      </span>
    </span>
  );

  if (loading) {
    return (
      <section className="space-y-4">
        <MyPageHeadingPortal>{headingContent}</MyPageHeadingPortal>
        <p className="text-sm text-muted-foreground">불러오는 중…</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <MyPageHeadingPortal>{headingContent}</MyPageHeadingPortal>

      {sortedAnswers.length === 0 ? (
        <p className="text-sm text-muted-foreground">작성한 답변이 없습니다.</p>
      ) : (
        <>
          <ul className="space-y-3">
            {pagedAnswers.map(
              ({ id, content, created_at, post_id, post_title }) => (
                <li
                  key={id}
                  id={`mypage-admin-answer-${id}`}
                  className="scroll-mt-28 rounded-lg transition-colors"
                >
                  <Link
                    href={`${getLogNoticePath(post_id)}?commentId=${id}`}
                    className="block rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-muted"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <p className="line-clamp-2 text-sm text-foreground">
                        {content}
                      </p>
                      <p className="shrink-0">{formatSeoulDate(created_at)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {post_title}에 남긴 답변
                    </p>
                  </Link>
                </li>
              ),
            )}
          </ul>
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
