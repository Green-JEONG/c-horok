"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import HorokCodingCreateProblemModal from "@/components/horok-coding/HorokCodingCreateProblemModal";
import HorokCodingLevelDropdown from "@/components/horok-coding/HorokCodingLevelDropdown";
import HorokCodingProblemQuickSearch from "@/components/horok-coding/HorokCodingProblemQuickSearch";
import HeaderActions from "@/components/layout/HeaderActions";
import ThemeToggle from "@/components/layout/ThemeToggle";
import {
  HOROK_CODING_LEVELS,
  type HorokCodingProblem,
} from "@/lib/horok-coding-shared";
import HorokCodingProblemBrowser from "./HorokCodingProblemBrowser";

const ALL_LEVEL = "전체";

type HorokCodingCatalogProps = {
  problems: HorokCodingProblem[];
  initialSelectedLevel: string;
  initialTab?: string;
  userProgress?: {
    solvedSlugs: string[];
    failedSlugs: string[];
    bookmarkedSlugs: string[];
  };
};

export default function HorokCodingCatalog({
  problems,
  initialSelectedLevel,
  initialTab,
  userProgress,
}: HorokCodingCatalogProps) {
  const [selectedLevel, setSelectedLevel] = useState(initialSelectedLevel);
  const [activeTab, setActiveTab] = useState(initialTab ?? "all");
  const router = useRouter();
  const searchParams = useSearchParams();
  const levelCounts = HOROK_CODING_LEVELS.reduce<Record<string, number>>(
    (counts, level) => {
      counts[level] = problems.filter(
        (problem) => problem.level === level,
      ).length;
      return counts;
    },
    {},
  );
  const solvedSlugSet = new Set(userProgress?.solvedSlugs ?? []);
  const unsolvedCount = problems.filter(
    (problem) => !solvedSlugSet.has(problem.slug),
  ).length;

  useEffect(() => {
    const tab = searchParams.get("tab");
    const level = searchParams.get("level");
    setActiveTab(tab || "all");
    setSelectedLevel(
      HOROK_CODING_LEVELS.find((candidateLevel) => candidateLevel === level) ??
        ALL_LEVEL,
    );
  }, [searchParams]);

  const updateCatalogUrl = (nextLevel: string, nextTab = activeTab) => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (nextLevel === ALL_LEVEL) {
      params.delete("level");
    } else {
      params.set("level", nextLevel);
    }

    if (nextTab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", nextTab);
    }

    router.replace(`/horok-coding?${params.toString()}`);
  };

  const handleLevelChange = (level: string) => {
    setSelectedLevel(level);
    setActiveTab("all");
    updateCatalogUrl(level, "all");
  };

  const handleDropdownTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSelectedLevel(ALL_LEVEL);
    updateCatalogUrl(ALL_LEVEL, tabId);
  };

  let filteredProblems = problems;
  let emptyMessage = "준비중입니다.";
  if (activeTab === "solved" && userProgress) {
    filteredProblems = problems.filter((p) =>
      userProgress.solvedSlugs.includes(p.slug),
    );
    emptyMessage = "맞은 문제가 없습니다.";
  } else if (activeTab === "unsolved") {
    filteredProblems = problems.filter((p) => !solvedSlugSet.has(p.slug));
    emptyMessage = "안 푼 문제가 없습니다.";
  } else if (activeTab === "failed" && userProgress) {
    filteredProblems = problems.filter((p) =>
      userProgress.failedSlugs.includes(p.slug),
    );
    emptyMessage = "틀린 문제가 없습니다.";
  } else if (activeTab === "bookmarked" && userProgress) {
    filteredProblems = problems.filter((p) =>
      userProgress.bookmarkedSlugs.includes(p.slug),
    );
    emptyMessage = "찜한 문제가 없습니다.";
  }

  return (
    <>
      <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden text-sm text-slate-500 dark:text-slate-400">
            <Link
              href="/horok-coding"
              className="flex shrink-0 items-center gap-1.5 font-bold text-slate-950 transition hover:opacity-80 dark:text-slate-50"
            >
              <Image
                src="/logo.png"
                alt="horok-coding"
                width={36}
                height={36}
                priority
              />
              <span className="flex flex-col items-center text-sm leading-none">
                <span>horok</span>
                <span>coding</span>
              </span>
            </Link>
            <ChevronRight className="size-4 text-slate-300 dark:text-slate-600" />
            <HorokCodingLevelDropdown
              levels={HOROK_CODING_LEVELS}
              value={
                activeTab === "solved"
                  ? "맞은 문제"
                  : activeTab === "unsolved"
                    ? "안 푼 문제"
                    : activeTab === "failed"
                      ? "틀린 문제"
                      : activeTab === "bookmarked"
                        ? "찜한 문제"
                        : selectedLevel
              }
              onChange={handleLevelChange}
              topItem={{
                label: ALL_LEVEL,
                value: ALL_LEVEL,
                count: problems.length,
              }}
              levelCounts={levelCounts}
              bottomItems={[
                {
                  label: "맞은 문제",
                  value: "solved",
                  count: userProgress?.solvedSlugs.length ?? 0,
                },
                {
                  label: "틀린 문제",
                  value: "failed",
                  count: userProgress?.failedSlugs.length ?? 0,
                },
                {
                  label: "안 푼 문제",
                  value: "unsolved",
                  count: unsolvedCount,
                },
                {
                  label: "찜한 문제",
                  value: "bookmarked",
                  count: userProgress?.bookmarkedSlugs.length ?? 0,
                },
              ]}
              onBottomItemSelect={handleDropdownTabChange}
            />
            <ChevronRight className="hidden size-4 text-slate-300 dark:text-slate-600 sm:block" />
            <div className="hidden min-w-[180px] flex-1 sm:block">
              <HorokCodingProblemQuickSearch problems={problems} alwaysExpanded />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <HorokCodingCreateProblemModal />
            <HeaderActions />
            <ThemeToggle />
          </div>
        </div>
        <div className="mt-3 w-full sm:hidden">
          <HorokCodingProblemQuickSearch problems={problems} alwaysExpanded />
        </div>
      </div>

      <HorokCodingProblemBrowser
        problems={filteredProblems}
        selectedLevel={selectedLevel}
        onSelectedLevelChange={setSelectedLevel}
        showLevelTabs={false}
        emptyMessage={emptyMessage}
      />
    </>
  );
}
