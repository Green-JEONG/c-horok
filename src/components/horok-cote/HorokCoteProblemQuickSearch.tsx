"use client";

import { Bookmark, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { HorokCoteProblem } from "@/lib/horok-cote-shared";
import { cn } from "@/lib/utils";

type HorokCoteProblemQuickSearchProps = {
  number?: number;
  title?: string;
  problems: HorokCoteProblem[];
  alwaysExpanded?: boolean;
};

const HOROK_COTE_SEARCH_MIN_WIDTH = 220;

export default function HorokCoteProblemQuickSearch({
  number,
  title,
  problems,
  alwaysExpanded = false,
}: HorokCoteProblemQuickSearchProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const currentProblem = useMemo(() => {
    if (number === undefined) {
      return null;
    }
    return problems.find((p) => p.number === number) || null;
  }, [problems, number]);

  const fetchBookmarkStatus = useCallback(async () => {
    if (!currentProblem || !session?.user) {
      setIsBookmarked(false);
      return;
    }
    try {
      const response = await fetch(
        `/api/horok-cote/saved-code?problemSlug=${encodeURIComponent(
          currentProblem.slug,
        )}`,
      );
      if (response.ok) {
        const data = await response.json();
        setIsBookmarked(!!data.isBookmarked);
      }
    } catch (error) {
      console.error("Failed to fetch bookmark status:", error);
    }
  }, [currentProblem, session?.user]);

  useEffect(() => {
    fetchBookmarkStatus();
  }, [fetchBookmarkStatus]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchBookmarkStatus();
    };
    window.addEventListener("cote-bookmark-updated", handleUpdate);
    return () => {
      window.removeEventListener("cote-bookmark-updated", handleUpdate);
    };
  }, [fetchBookmarkStatus]);

  const handleBookmarkToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session?.user) {
      alert("로그인이 필요한 기능입니다.");
      return;
    }

    if (!currentProblem) {
      return;
    }

    try {
      if (isBookmarked) {
        const response = await fetch(
          `/api/horok-cote/saved-code?problemSlug=${encodeURIComponent(
            currentProblem.slug,
          )}`,
          { method: "DELETE" },
        );
        if (response.ok) {
          setIsBookmarked(false);
          window.dispatchEvent(new Event("cote-bookmark-updated"));
          router.refresh();
        } else {
          alert("북마크 해제에 실패했습니다.");
        }
      } else {
        const response = await fetch("/api/horok-cote/saved-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            problemSlug: currentProblem.slug,
            problemNumber: currentProblem.number,
            language: "bookmark",
            sourceCode: "",
            isBookmarked: true,
          }),
        });
        if (response.ok) {
          setIsBookmarked(true);
          window.dispatchEvent(new Event("cote-bookmark-updated"));
          router.refresh();
        } else {
          alert("북마크 등록에 실패했습니다.");
        }
      }
    } catch (error) {
      console.error("Failed to toggle bookmark:", error);
      alert("오류가 발생했습니다.");
    }
  };

  const suggestions = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      return [];
    }

    return problems
      .filter((problem) => {
        const fullLabel = `${problem.number} ${problem.title}`.toLowerCase();
        return (
          String(problem.number).includes(trimmedQuery) ||
          problem.title.toLowerCase().includes(trimmedQuery) ||
          fullLabel.includes(trimmedQuery)
        );
      })
      .slice(0, 6);
  }, [problems, query]);

  useEffect(() => {
    if (!isEditing) {
      setOverlayWidth(null);
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();

    const updateOverlayWidth = () => {
      const wrapper = wrapperRef.current;

      if (!wrapper) {
        return;
      }

      const rect = wrapper.getBoundingClientRect();
      const viewportMargin = 16;
      const nextWidth = Math.max(
        HOROK_COTE_SEARCH_MIN_WIDTH,
        window.innerWidth - rect.left - viewportMargin,
      );

      setOverlayWidth(nextWidth);
    };

    updateOverlayWidth();

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsEditing(false);
        setQuery("");
      }
    };

    window.addEventListener("resize", updateOverlayWidth);
    window.addEventListener("scroll", updateOverlayWidth, true);

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", updateOverlayWidth);
      window.removeEventListener("scroll", updateOverlayWidth, true);
    };
  }, [isEditing]);

  const handleSelectProblem = (slug: string) => {
    const selectedProblem = problems.find((problem) => problem.slug === slug);

    if (!selectedProblem) {
      return;
    }

    setIsEditing(false);
    setQuery("");
    router.push(`/horok-cote/${selectedProblem.number}`);
  };

  if (!isEditing && !alwaysExpanded) {
    return (
      <div className="relative z-30 min-w-0 flex-1">
        <div className="flex min-h-10 min-w-0 items-center gap-2 overflow-hidden border border-transparent">
          {number !== undefined && (
            <button
              type="button"
              onClick={handleBookmarkToggle}
              className={cn(
                "shrink-0 flex items-center justify-center p-1 rounded-md transition hover:bg-slate-100 dark:hover:bg-slate-800",
                isBookmarked
                  ? "text-[#06923E] dark:text-[#46c86f]"
                  : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400",
              )}
              title={isBookmarked ? "찜하기 해제" : "찜하기"}
              aria-label={isBookmarked ? "찜하기 해제" : "찜하기"}
            >
              <Bookmark
                className={cn(
                  "size-4.5",
                  isBookmarked && "fill-[#06923E] dark:fill-[#46c86f]",
                )}
              />
            </button>
          )}
          <button
            type="button"
            onDoubleClick={() => setIsEditing(true)}
            className="shrink-0 cursor-pointer text-sm font-semibold text-slate-950 outline-none dark:text-slate-50"
          >
            {number}번
          </button>
          <button
            type="button"
            onDoubleClick={() => setIsEditing(true)}
            className="min-w-0 truncate cursor-pointer text-sm text-slate-600 outline-none dark:text-slate-300"
            title={title}
          >
            {title}
          </button>
        </div>
        {showTooltip ? (
          <div className="pointer-events-none absolute left-10.5 top-9 z-40">
            <button
              type="button"
              onClick={() => setShowTooltip(false)}
              onDoubleClick={() => setIsEditing(true)}
              className="group pointer-events-auto relative whitespace-nowrap rounded-2xl bg-[#06923E] px-2.5 py-1 text-[11px] font-medium text-white shadow-lg transition hover:bg-[#047a33]"
            >
              더블클릭해 검색
              <span className="absolute bottom-full left-3 h-0 w-0 border-x-[6px] border-b-[8px] border-x-transparent border-b-[#06923E] transition-colors group-hover:border-b-[#047a33]" />
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={cn(
        "relative min-w-0 flex-1",
        alwaysExpanded ? "z-30" : "z-[80]",
      )}
    >
      <div
        className="inline-flex w-full min-w-0 items-center gap-2 rounded-[999px] border border-slate-200 bg-white px-4 py-2 shadow-[0_12px_28px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_20px_36px_rgba(2,6,23,0.5)]"
        style={overlayWidth ? { maxWidth: overlayWidth } : undefined}
      >
        <Search className="size-4 text-slate-400 dark:text-slate-500" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              if (alwaysExpanded) {
                setQuery("");
                return;
              }

              setIsEditing(false);
              setQuery("");
            }

            if (event.key === "Enter" && suggestions[0]) {
              handleSelectProblem(suggestions[0].slug);
            }
          }}
          placeholder="문제 번호 또는 제목 입력"
          className="w-full border-0 bg-transparent text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400 dark:text-slate-50 dark:placeholder:text-slate-500"
        />
      </div>

      {query.trim() ? (
        <div
          className="absolute left-0 top-[calc(100%+8px)] w-full rounded-[24px] border border-slate-200 bg-white p-2 shadow-[0_12px_28px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_20px_36px_rgba(2,6,23,0.5)]"
          style={overlayWidth ? { maxWidth: overlayWidth } : undefined}
        >
          {suggestions.length > 0 ? (
            <div className="space-y-1">
              {suggestions.map((problem) => (
                <button
                  key={problem.slug}
                  type="button"
                  onClick={() => handleSelectProblem(problem.slug)}
                  className="flex w-full items-center justify-between rounded-[18px] px-3 py-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {problem.number}번
                  </span>
                  <span className="ml-3 flex-1 truncate text-sm text-slate-600 dark:text-slate-300">
                    {problem.title}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] px-3 py-2 text-sm font-medium text-slate-400 dark:text-slate-500">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
