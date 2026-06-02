"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
};

export default function HorokCoteProblemHeader({
  level,
  number,
  title,
  problems,
}: HorokCoteProblemHeaderProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Link
            href="/horok-cote"
            className="flex shrink-0 items-center gap-1.5 font-bold text-slate-950 transition hover:opacity-80 dark:text-slate-50"
          >
            <Image src="/logo.png" alt="horok-cote" width={36} height={36} />
            <span className="flex flex-col items-center text-sm leading-none">
              <span>horok</span>
              <span>cote</span>
            </span>
          </Link>
          <ChevronRight className="size-4 shrink-0 text-slate-300 dark:text-slate-600" />
          <HorokCoteLevelDropdown
            levels={HOROK_COTE_LEVELS}
            value={level}
            onChange={(nextLevel) =>
              router.push(`/horok-cote?level=${encodeURIComponent(nextLevel)}`)
            }
          />
          <ChevronRight className="hidden size-4 shrink-0 text-slate-300 dark:text-slate-600 md:block" />
          <div className="hidden md:block">
            <HorokCoteProblemQuickSearch
              number={number}
              title={title}
              problems={problems}
            />
          </div>
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-1">
          <HeaderActions />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 md:hidden">
        <ChevronRight className="size-4 shrink-0 text-slate-300 dark:text-slate-600" />
        <HorokCoteProblemQuickSearch
          number={number}
          title={title}
          problems={problems}
        />
      </div>
    </div>
  );
}
