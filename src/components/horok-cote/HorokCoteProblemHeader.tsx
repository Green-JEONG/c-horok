"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import HorokCoteCreateProblemModal from "@/components/horok-cote/HorokCoteCreateProblemModal";
import HorokCoteLevelDropdown from "@/components/horok-cote/HorokCoteLevelDropdown";
import HorokCoteProblemQuickSearch from "@/components/horok-cote/HorokCoteProblemQuickSearch";
import HeaderActions from "@/components/layout/HeaderActions";
import ThemeToggle from "@/components/layout/ThemeToggle";
import {
  HOROK_COTE_LEVELS,
  type HorokCoteProblem,
} from "@/lib/horok-cote-shared";

type HorokCoteProblemHeaderProps = {
  level: string;
  number: number;
  title: string;
  problems: HorokCoteProblem[];
  userProgress?: {
    solvedSlugs: string[];
    failedSlugs: string[];
    bookmarkedSlugs: string[];
  };
};

export default function HorokCoteProblemHeader({
  level,
  number,
  title,
  problems,
  userProgress,
}: HorokCoteProblemHeaderProps) {
  const router = useRouter();
  const levelCounts = HOROK_COTE_LEVELS.reduce<Record<string, number>>(
    (counts, candidateLevel) => {
      counts[candidateLevel] = problems.filter(
        (problem) => problem.level === candidateLevel,
      ).length;
      return counts;
    },
    {},
  );
  const solvedSlugSet = new Set(userProgress?.solvedSlugs ?? []);
  const unsolvedCount = problems.filter(
    (problem) => !solvedSlugSet.has(problem.slug),
  ).length;

  return (
    <div className="border-b border-slate-200 pb-3 dark:border-slate-800">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link
            href="/horok-cote"
            className="flex shrink-0 items-center gap-1.5 font-bold text-slate-950 transition hover:opacity-80 dark:text-slate-50"
          >
            <Image
              src="/logo.png"
              alt="horok-cote"
              width={36}
              height={36}
              priority
            />
            <span className="flex flex-col items-center text-sm leading-none">
              <span>horok</span>
              <span>cote</span>
            </span>
          </Link>
          <ChevronRight className="size-4 shrink-0 text-slate-300 dark:text-slate-600" />
          <HorokCoteLevelDropdown
            levels={HOROK_COTE_LEVELS}
            value={level}
            onChange={(nextLevel) => {
              if (nextLevel === "전체") {
                router.push("/horok-cote");
                return;
              }

              router.push(`/horok-cote?level=${encodeURIComponent(nextLevel)}`);
            }}
            topItem={{
              label: "전체",
              value: "전체",
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
            onBottomItemSelect={(tabId) => {
              router.push(`/horok-cote?tab=${encodeURIComponent(tabId)}`);
            }}
          />
          <ChevronRight className="hidden size-4 text-slate-300 dark:text-slate-600 sm:block" />
          <div className="hidden min-w-[180px] flex-1 sm:block">
            <HorokCoteProblemQuickSearch
              number={number}
              title={title}
              problems={problems}
            />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <HorokCoteCreateProblemModal />
          <HeaderActions />
          <ThemeToggle />
        </div>
      </div>
      <div className="mt-3 w-full sm:hidden">
        <HorokCoteProblemQuickSearch
          number={number}
          title={title}
          problems={problems}
        />
      </div>
    </div>
  );
}
