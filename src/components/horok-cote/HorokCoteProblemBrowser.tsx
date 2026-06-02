"use client";

import { ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HorokCoteProblem } from "@/lib/horok-cote-shared";
import { cn } from "@/lib/utils";

type HorokCoteProblemBrowserProps = {
  problems: HorokCoteProblem[];
  selectedLevel?: string;
  onSelectedLevelChange?: (level: string) => void;
  showLevelTabs?: boolean;
  emptyMessage?: string;
};

const PROBLEMS_PER_PAGE = 6;
const ALL_LEVEL = "전체";
const SORT_OPTIONS = [
  { label: "번호순", value: "number-asc" },
  { label: "추가된 날짜순", value: "created-desc" },
  { label: "정답률 높은 순", value: "acceptance-desc" },
  { label: "정답률 낮은 순", value: "acceptance-asc" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

function parseAcceptanceRate(rate: string) {
  const parsedRate = Number.parseFloat(rate.replace("%", ""));
  return Number.isFinite(parsedRate) ? parsedRate : 0;
}

function parseCreatedAt(problem: HorokCoteProblem) {
  const parsedTime = problem.createdAt ? Date.parse(problem.createdAt) : NaN;
  return Number.isFinite(parsedTime) ? parsedTime : problem.number;
}

export default function HorokCoteProblemBrowser({
  problems,
  selectedLevel: selectedLevelProp,
  onSelectedLevelChange,
  showLevelTabs = true,
  emptyMessage = "준비중입니다.",
}: HorokCoteProblemBrowserProps) {
  const [sortValue, setSortValue] = useState<SortValue>("number-asc");
  const problemsByLevel = Object.entries(
    problems.reduce<Record<string, HorokCoteProblem[]>>((groups, problem) => {
      if (!groups[problem.level]) {
        groups[problem.level] = [];
      }

      groups[problem.level].push(problem);
      return groups;
    }, {}),
  ).sort(([levelA], [levelB]) =>
    levelA.localeCompare(levelB, undefined, { numeric: true }),
  );

  const [internalSelectedLevel, setInternalSelectedLevel] = useState(
    problemsByLevel[0]?.[0] ?? "",
  );
  const selectedLevel = selectedLevelProp ?? internalSelectedLevel;

  const handleLevelChange = (level: string) => {
    if (!selectedLevelProp) {
      setInternalSelectedLevel(level);
    }

    onSelectedLevelChange?.(level);
  };

  const selectedProblems =
    selectedLevel === ALL_LEVEL
      ? problems
      : (problemsByLevel.find(([level]) => level === selectedLevel)?.[1] ?? []);
  const [currentPage, setCurrentPage] = useState(1);
  const sortedProblems = [...selectedProblems].sort((problemA, problemB) => {
    if (sortValue === "acceptance-desc") {
      return (
        parseAcceptanceRate(problemB.acceptanceRate) -
        parseAcceptanceRate(problemA.acceptanceRate)
      );
    }

    if (sortValue === "acceptance-asc") {
      return (
        parseAcceptanceRate(problemA.acceptanceRate) -
        parseAcceptanceRate(problemB.acceptanceRate)
      );
    }

    if (sortValue === "created-desc") {
      return parseCreatedAt(problemB) - parseCreatedAt(problemA);
    }

    return problemA.number - problemB.number;
  });
  const selectedSortLabel =
    SORT_OPTIONS.find((option) => option.value === sortValue)?.label ??
    "번호순";
  const sortDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-slate-50"
        >
          <span>{selectedSortLabel}</span>
          <ChevronUp className="size-4 text-slate-400 dark:text-slate-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={16}
        className="w-max min-w-0 rounded-[20px] border-slate-200 bg-white p-2 shadow-[0_12px_28px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900"
      >
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="justify-end whitespace-nowrap rounded-[999px] px-3 py-2 text-right text-sm font-semibold text-slate-700 focus:bg-slate-100 focus:text-slate-950 dark:text-slate-200 dark:focus:bg-slate-800 dark:focus:text-slate-50"
            onSelect={() => {
              setSortValue(option.value);
              setCurrentPage(1);
            }}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const totalPages = Math.max(
    1,
    Math.ceil(sortedProblems.length / PROBLEMS_PER_PAGE),
  );
  const activePage = Math.min(currentPage, totalPages);
  const paginatedProblems = sortedProblems.slice(
    (activePage - 1) * PROBLEMS_PER_PAGE,
    activePage * PROBLEMS_PER_PAGE,
  );

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
      {showLevelTabs ? (
        <div className="flex flex-wrap gap-3">
          {problemsByLevel.map(([level, levelProblems]) => {
            const isActive = level === selectedLevel;

            return (
              <button
                key={level}
                type="button"
                onClick={() => handleLevelChange(level)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  isActive
                    ? "border-slate-950 bg-slate-950 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-950"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-50",
                )}
              >
                {level}
                <span
                  className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-xs",
                    isActive
                      ? "bg-white/15 text-white dark:bg-slate-200 dark:text-slate-900"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300",
                  )}
                >
                  {levelProblems.length}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="scrollbar-green min-h-0 flex-1 overflow-y-auto px-1 py-1">
          {paginatedProblems.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {paginatedProblems.map((problem) => (
                <Link
                  key={problem.number}
                  href={`/horok-cote/${problem.number}`}
                  className="group relative origin-center min-w-0 rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 transition duration-200 hover:z-10 hover:scale-[1.01] md:odd:origin-left md:even:origin-right hover:border-slate-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,#111827_0%,#0f172a_100%)] dark:hover:border-slate-700 dark:hover:shadow-[0_18px_45px_rgba(2,6,23,0.5)]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#44bb68]">
                      {problem.number}번
                    </p>
                    <h4 className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
                      {problem.title}
                    </h4>
                  </div>

                  <p className="mt-3 truncate text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {problem.summary}
                  </p>

                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                    <span>{problem.level}</span>
                    <span>•</span>
                    <span>{problem.category}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center px-6 text-center">
              <p className="text-base font-semibold text-slate-500 dark:text-slate-400">
                {emptyMessage}
              </p>
            </div>
          )}
        </div>

        {sortedProblems.length > 0 ? (
          <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-900">
            <div />
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={activePage === 1}
                className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-50"
              >
                <ChevronLeft className="size-4" />
              </button>

              {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                (page) => {
                  const isActive = page === activePage;

                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm font-semibold transition",
                        isActive
                          ? "border-[#06923E] text-[#06923E] dark:border-[#46c86f] dark:text-[#46c86f]"
                          : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-50",
                      )}
                    >
                      {page}
                    </button>
                  );
                },
              )}

              <button
                type="button"
                onClick={() =>
                  setCurrentPage((page) => Math.min(totalPages, page + 1))
                }
                disabled={activePage === totalPages}
                className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:text-slate-50"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="justify-self-end">{sortDropdown}</div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
