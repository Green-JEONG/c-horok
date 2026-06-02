"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HorokCoteProblem } from "@/lib/horok-cote-shared";
import { cn } from "@/lib/utils";

type HorokCoteProblemQuickSearchProps = {
  number?: number;
  title?: string;
  problems: HorokCoteProblem[];
  alwaysExpanded?: boolean;
};

const HOROK_COTE_SEARCH_WIDTH = 280;

export default function HorokCoteProblemQuickSearch({
  number,
  title,
  problems,
  alwaysExpanded = false,
}: HorokCoteProblemQuickSearchProps) {
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [overlayWidth, setOverlayWidth] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(true);

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
      const nextWidth = Math.min(
        HOROK_COTE_SEARCH_WIDTH,
        Math.max(220, window.innerWidth - rect.left - viewportMargin),
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
        <div className="flex min-w-0 items-center gap-2 overflow-hidden border border-transparent py-2">
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
          <div className="pointer-events-none absolute left-2.5 top-9 z-40">
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
