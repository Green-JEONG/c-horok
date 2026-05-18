"use client";

import {
  ChevronDown,
  ChevronsUpDown,
  ChevronUp,
  EyeOff,
  Lock,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import SectionPagination from "@/components/mypage/sections/SectionPagination";
import MarkdownRenderer from "@/components/posts/MarkdownRenderer";
import PostEditor from "@/components/posts/PostEditor";
import { getTechNoticePath } from "@/lib/routes";

type NoticeListItem = {
  id: number;
  title: string;
  categoryName: string;
  summary: string;
  content: string;
  thumbnail: string | null;
  publishedAt: string;
  authorName: string;
  authorImage: string | null;
  isPinned: boolean;
  isLocked: boolean;
  isSecret: boolean;
  isHidden?: boolean;
  canViewSecret: boolean;
  isBanner: boolean;
  isOwner: boolean;
  canManageBanner: boolean;
  isResolved: boolean;
  hasAdminAnswer: boolean;
  likesCount: number;
  commentsCount: number;
  viewCount: number;
};

type Props = {
  notices: NoticeListItem[];
  emptyMessage?: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  isQnaCategory?: boolean;
  isFaqCategory?: boolean;
  noticeNumberById?: Record<number, number>;
};

type NoticeTableSortKey =
  | "number"
  | "title"
  | "author"
  | "date"
  | "views"
  | "status";
type NoticeTableSortOrder = "asc" | "desc";

function compareNoticeListItems(
  sortKey: NoticeTableSortKey,
  a: NoticeListItem,
  b: NoticeListItem,
  noticeNumberById: Record<number, number>,
) {
  switch (sortKey) {
    case "number":
      return (noticeNumberById[a.id] ?? 0) - (noticeNumberById[b.id] ?? 0);
    case "title":
      return a.title.localeCompare(b.title, "ko");
    case "author":
      return a.authorName.localeCompare(b.authorName, "ko");
    case "views":
      return a.viewCount - b.viewCount;
    case "status":
      return getInquiryStatusRank(a) - getInquiryStatusRank(b);
    default:
      return a.publishedAt.localeCompare(b.publishedAt);
  }
}

function getInquiryStatusRank(notice: {
  isResolved: boolean;
  hasAdminAnswer: boolean;
}) {
  if (notice.isResolved) {
    return 2;
  }

  return notice.hasAdminAnswer ? 1 : 0;
}

function getInquiryStatusLabel(notice: {
  isResolved: boolean;
  hasAdminAnswer: boolean;
}) {
  if (notice.isResolved) {
    return "답변 완료";
  }

  return notice.hasAdminAnswer ? "확인 중" : "접수 완료";
}

function getInquiryStatusClassName(notice: {
  isResolved: boolean;
  hasAdminAnswer: boolean;
}) {
  if (notice.isResolved) {
    return "text-green-500";
  }

  return notice.hasAdminAnswer ? "text-blue-500" : "text-red-500";
}

export default function NoticeListInfinite({
  notices,
  emptyMessage = "등록된 공지사항이 없습니다.",
  currentPage,
  totalPages,
  totalCount,
  isQnaCategory = false,
  isFaqCategory = false,
  noticeNumberById = {},
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialOpenFaqId = Number(searchParams.get("open") ?? "");
  const targetNoticeId = Number(searchParams.get("target") ?? "");
  const [openFaqIds, setOpenFaqIds] = useState<number[]>(
    Number.isFinite(initialOpenFaqId) ? [initialOpenFaqId] : [],
  );
  const [highlightedNoticeId, setHighlightedNoticeId] = useState<number | null>(
    Number.isFinite(targetNoticeId) ? targetNoticeId : null,
  );
  const [sortKey, setSortKey] = useState<NoticeTableSortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<NoticeTableSortOrder>("asc");
  const [sortedPage, setSortedPage] = useState(1);
  const [viewCounts, setViewCounts] = useState<Record<number, number>>(() =>
    Object.fromEntries(notices.map((notice) => [notice.id, notice.viewCount])),
  );
  const isSorted = sortKey !== null;
  const pageSize = 10;
  const sortedNotices = useMemo(() => {
    if (!sortKey) {
      return notices;
    }

    return [...notices].sort((a, b) => {
      const result =
        compareNoticeListItems(sortKey, a, b, noticeNumberById) ||
        (noticeNumberById[a.id] ?? 0) - (noticeNumberById[b.id] ?? 0);

      return sortOrder === "asc" ? result : -result;
    });
  }, [noticeNumberById, notices, sortKey, sortOrder]);
  const activePage = isSorted ? sortedPage : currentPage;
  const activeTotalPages = Math.max(
    1,
    Math.ceil(sortedNotices.length / pageSize),
  );
  const visibleNotices = sortedNotices.slice(
    (Math.min(activePage, activeTotalPages) - 1) * pageSize,
    Math.min(activePage, activeTotalPages) * pageSize,
  );

  useEffect(() => {
    setViewCounts(
      Object.fromEntries(
        notices.map((notice) => [notice.id, notice.viewCount]),
      ),
    );
  }, [notices]);

  const trackFaqView = useCallback(async (id: number) => {
    setViewCounts((current) => ({
      ...current,
      [id]: (current[id] ?? 0) + 1,
    }));

    try {
      const response = await fetch(`/api/posts/${id}/view`, {
        method: "POST",
      });

      if (!response.ok) {
        setViewCounts((current) => ({
          ...current,
          [id]: Math.max((current[id] ?? 1) - 1, 0),
        }));
      }
    } catch {
      setViewCounts((current) => ({
        ...current,
        [id]: Math.max((current[id] ?? 1) - 1, 0),
      }));
    }
  }, []);

  useEffect(() => {
    if (!isFaqCategory) {
      return;
    }

    const openFaqId = Number(searchParams.get("open") ?? "");

    if (!Number.isFinite(openFaqId)) {
      setOpenFaqIds([]);
      return;
    }

    setOpenFaqIds([openFaqId]);
    void trackFaqView(openFaqId);

    const element = document.getElementById(`faq-notice-${openFaqId}`);
    if (element) {
      requestAnimationFrame(() => {
        element.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [isFaqCategory, searchParams, trackFaqView]);

  useEffect(() => {
    if (isFaqCategory || !Number.isFinite(targetNoticeId)) {
      return;
    }

    const element = document.getElementById(`notice-${targetNoticeId}`);
    if (!element) {
      return;
    }

    setHighlightedNoticeId(targetNoticeId);

    const scrollTimeout = window.setTimeout(() => {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    const highlightTimeout = window.setTimeout(() => {
      setHighlightedNoticeId((current) =>
        current === targetNoticeId ? null : current,
      );
    }, 2600);

    return () => {
      window.clearTimeout(scrollTimeout);
      window.clearTimeout(highlightTimeout);
    };
  }, [isFaqCategory, targetNoticeId]);

  function buildPageHref(page: number) {
    const params = new URLSearchParams(searchParams.toString());

    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function buildCurrentListHref() {
    const params = new URLSearchParams(searchParams.toString());
    const page = Math.min(activePage, activeTotalPages);

    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function buildDetailHref(noticeId: number) {
    const params = new URLSearchParams({
      from: buildCurrentListHref(),
    });

    return `${getTechNoticePath(noticeId)}?${params.toString()}`;
  }

  function updateSort(nextSortKey: NoticeTableSortKey) {
    setSortOrder((currentOrder) =>
      sortKey === nextSortKey && currentOrder === "asc" ? "desc" : "asc",
    );
    setSortKey(nextSortKey);
    setSortedPage(1);
  }

  function renderSortableHeader(
    label: string,
    nextSortKey: NoticeTableSortKey,
  ) {
    const isActive = sortKey === nextSortKey;
    const activeSortOrder = isActive ? sortOrder : null;
    const nextSortOrder = activeSortOrder === "asc" ? "desc" : "asc";
    const SortIcon = isActive
      ? sortOrder === "asc"
        ? ChevronUp
        : ChevronDown
      : ChevronsUpDown;

    return (
      <button
        type="button"
        onClick={() => updateSort(nextSortKey)}
        className={`inline-flex min-w-0 items-center justify-center rounded-sm py-0.5 transition-colors hover:text-foreground ${
          nextSortKey === "number" ? "gap-0.5" : "gap-1 px-1"
        }`}
        aria-label={`${label} ${nextSortOrder === "asc" ? "오름차순" : "내림차순"} 정렬`}
      >
        <span
          className={
            nextSortKey === "number"
              ? "whitespace-nowrap tracking-tighter"
              : "truncate"
          }
        >
          {label}
        </span>
        <SortIcon
          aria-hidden="true"
          className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-foreground" : "text-muted-foreground/70"}`}
        />
      </button>
    );
  }

  function getQnaStatusSizeClassName(isMobile: boolean) {
    return isMobile ? "text-xs" : "text-sm";
  }

  function toggleFaq(id: number) {
    const isOpening = !openFaqIds.includes(id);

    setOpenFaqIds((current) =>
      current.includes(id)
        ? current.filter((faqId) => faqId !== id)
        : [...current, id],
    );

    if (isOpening) {
      void trackFaqView(id);
    }
  }

  if (notices.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const showStatusColumn = isQnaCategory;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border-y bg-background">
        <div className={showStatusColumn ? "min-w-[640px]" : "min-w-[560px]"}>
          <div
            className={`grid items-center gap-3 border-b bg-muted/40 px-5 py-3 text-center text-xs font-semibold text-muted-foreground ${
              showStatusColumn
                ? "grid-cols-[40px_minmax(220px,1.6fr)_72px_84px_48px_68px]"
                : "grid-cols-[40px_minmax(220px,1.6fr)_72px_84px_48px]"
            }`}
          >
            {renderSortableHeader("번호", "number")}
            {renderSortableHeader("제목", "title")}
            {renderSortableHeader("작성자", "author")}
            {renderSortableHeader("작성일", "date")}
            {renderSortableHeader("조회", "views")}
            {showStatusColumn ? renderSortableHeader("상태", "status") : null}
          </div>

          {visibleNotices.map((notice, index) => {
            const isFaqOpen = openFaqIds.includes(notice.id);
            const noticeNumber =
              noticeNumberById[notice.id] ??
              totalCount - (activePage - 1) * pageSize - index;
            const titleNode = isFaqCategory ? (
              <button
                type="button"
                onClick={() => toggleFaq(notice.id)}
                className="flex w-full min-w-0 items-center gap-1.5 text-left"
                aria-expanded={isFaqOpen}
              >
                <span className="hidden shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {noticeNumber}
                </span>
                <span className="shrink-0 text-sm font-semibold text-primary">
                  Q.
                </span>
                <p className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-5 text-foreground">
                  {notice.title}
                </p>
                {notice.isLocked ? (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : null}
                {notice.isHidden ? (
                  <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : null}
                <ChevronDown
                  className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    isFaqOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            ) : (
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="hidden shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                  {noticeNumber}
                </span>
                <p className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-5 text-foreground">
                  {notice.title}
                </p>
                {notice.isLocked ? (
                  <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : null}
                {notice.isHidden ? (
                  <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : null}
              </div>
            );

            const rowContent = (
              <div
                className={`grid items-center gap-3 px-5 py-4 ${
                  showStatusColumn
                    ? "grid-cols-[40px_minmax(220px,1.6fr)_72px_84px_48px_68px]"
                    : "grid-cols-[40px_minmax(220px,1.6fr)_72px_84px_48px]"
                }`}
              >
                <span className="text-center text-sm font-semibold tabular-nums text-muted-foreground">
                  {noticeNumber}
                </span>
                <div className="min-w-0">
                  {titleNode}
                  <div className="hidden mt-2 items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Image
                        src={notice.authorImage ?? "/logo.png"}
                        alt={`${notice.authorName} 프로필`}
                        width={18}
                        height={18}
                        className="h-4.5 w-4.5 rounded-full border object-cover"
                      />
                      <span>{notice.authorName}</span>
                    </span>
                    <span>{notice.publishedAt}</span>
                    <span>조회 {viewCounts[notice.id] ?? notice.viewCount}</span>
                    {showStatusColumn ? (
                      <span
                        className={`${getQnaStatusSizeClassName(true)} font-semibold ${getInquiryStatusClassName(notice)}`}
                        title={getInquiryStatusLabel(notice)}
                      >
                        {getInquiryStatusLabel(notice)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex min-w-0 items-center justify-center gap-2">
                  <Image
                    src={notice.authorImage ?? "/logo.png"}
                    alt={`${notice.authorName} 프로필`}
                    width={24}
                    height={24}
                    className="h-6 w-6 rounded-full border object-cover"
                  />
                  <span className="truncate text-sm text-muted-foreground">
                    {notice.authorName}
                  </span>
                </div>
                <span className="text-center text-sm text-muted-foreground">
                  {notice.publishedAt}
                </span>
                <div className="text-center text-sm text-muted-foreground">
                  {viewCounts[notice.id] ?? notice.viewCount}
                </div>
                {showStatusColumn ? (
                  <div
                    className={`text-center font-semibold ${getQnaStatusSizeClassName(false)} ${getInquiryStatusClassName(notice)}`}
                    title={getInquiryStatusLabel(notice)}
                  >
                    {getInquiryStatusLabel(notice)}
                  </div>
                ) : null}
              </div>
            );

            if (!isFaqCategory) {
              return (
                <Link
                  key={notice.id}
                  href={buildDetailHref(notice.id)}
                  id={`notice-${notice.id}`}
                  className={`block transition-colors hover:bg-muted/30 ${
                    highlightedNoticeId === notice.id
                      ? "border border-primary bg-primary/5"
                      : "border-b last:border-b-0"
                  }`}
                >
                  {rowContent}
                </Link>
              );
            }

            return (
              <div
                key={notice.id}
                id={`faq-notice-${notice.id}`}
                className="border-b last:border-b-0 transition-colors hover:bg-muted/20"
              >
                {rowContent}
                {isFaqOpen ? (
                  <div className="border-t bg-muted/10 px-4 py-4 md:px-5">
                    <FaqInlineActions notice={notice} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <SectionPagination
        currentPage={Math.min(activePage, activeTotalPages)}
        totalPages={isSorted ? activeTotalPages : totalPages}
        onPageChange={(page) => {
          if (isSorted) {
            setSortedPage(page);
            return;
          }

          router.push(buildPageHref(page));
        }}
      />
    </div>
  );
}

function FaqInlineActions({ notice }: { notice: NoticeListItem }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingHidden, setIsTogglingHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm("이 게시글을 삭제할까요?");
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${notice.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? "게시글 삭제에 실패했습니다.");
        return;
      }

      router.refresh();
    } catch {
      setError("게시글 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleToggleHidden() {
    const confirmed = window.confirm(
      "이 게시글을 숨김 처리할까요? 숨김 처리하면 다른 사용자는 볼 수 없습니다.",
    );
    if (!confirmed) return;

    setIsTogglingHidden(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${notice.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isHidden: true }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? "게시글 숨김 처리에 실패했습니다.");
        return;
      }

      router.refresh();
    } catch {
      setError("게시글 숨김 처리 중 오류가 발생했습니다.");
    } finally {
      setIsTogglingHidden(false);
    }
  }

  return (
    <div className="space-y-4">
      {notice.isOwner && isEditing ? (
        <div className="rounded-xl border bg-background p-4">
          <div className="mb-4 flex flex-wrap items-start justify-end gap-2 text-sm">
            <button
              type="button"
              disabled={isDeleting || isTogglingHidden}
              onClick={() => {
                setIsEditing((prev) => !prev);
                setError(null);
              }}
              className="rounded-md border px-3 py-1 transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              닫기
            </button>
            <button
              type="button"
              disabled={isDeleting || isTogglingHidden}
              onClick={handleToggleHidden}
              className="rounded-md border px-3 py-1 transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTogglingHidden ? "숨김 중..." : "숨김"}
            </button>
            <button
              type="button"
              disabled={isDeleting || isTogglingHidden}
              onClick={handleDelete}
              className="rounded-md border border-red-500 bg-red-500 px-3 py-1 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </button>
          </div>
          <PostEditor
            mode="edit"
            postId={notice.id}
            initialTitle={notice.title}
            initialContent={notice.content}
            initialCategoryName={notice.categoryName}
            initialThumbnail={notice.thumbnail}
            initialIsBanner={notice.isBanner}
            initialIsSecret={notice.isSecret}
            categoryLocked
            fixedTagOptions={["FAQ"]}
            showBannerOption={notice.canManageBanner}
            allowNoticeBannerForAllCategories={notice.canManageBanner}
            onCancel={() => {
              setIsEditing(false);
              setError(null);
            }}
            onSuccess={() => {
              setIsEditing(false);
              setError(null);
              router.refresh();
            }}
          />
        </div>
      ) : (
        <div
          className={
            notice.isOwner
              ? "flex flex-col items-start gap-4 md:flex-row md:justify-between"
              : ""
          }
        >
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <span className="shrink-0 text-sm font-semibold leading-7 text-primary">
              A.
            </span>
            <MarkdownRenderer
              content={notice.content}
              className="min-w-0 flex-1 [&_blockquote:first-child]:mt-0 [&_h1:first-child]:mt-0 [&_h2:first-child]:mt-0 [&_h3:first-child]:mt-0 [&_ol:first-child]:mt-0 [&_p:first-child]:mt-0 [&_pre:first-child]:mt-0 [&_table:first-child]:mt-0 [&_ul:first-child]:mt-0"
            />
          </div>
          {notice.isOwner ? (
            <div className="flex shrink-0 flex-wrap items-start justify-end gap-2 self-start text-sm">
              <button
                type="button"
                disabled={isDeleting || isTogglingHidden}
                onClick={() => {
                  setIsEditing((prev) => !prev);
                  setError(null);
                }}
                className="rounded-md border px-3 py-1 transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                수정
              </button>
              <button
                type="button"
                disabled={isDeleting || isTogglingHidden}
                onClick={handleToggleHidden}
                className="rounded-md border px-3 py-1 transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTogglingHidden ? "숨김 중..." : "숨김"}
              </button>
              <button
                type="button"
                disabled={isDeleting || isTogglingHidden}
                onClick={handleDelete}
                className="rounded-md border border-red-500 bg-red-500 px-3 py-1 text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}
