"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import HorokCoteCreateProblemModal from "@/components/horok-cote/HorokCoteCreateProblemModal";
import HorokCoteLevelDropdown from "@/components/horok-cote/HorokCoteLevelDropdown";
import HorokCoteProblemQuickSearch from "@/components/horok-cote/HorokCoteProblemQuickSearch";
import HeaderActions from "@/components/layout/HeaderActions";
import ThemeToggle from "@/components/layout/ThemeToggle";
import {
  HOROK_COTE_LEVELS,
  type HorokCoteProblem,
} from "@/lib/horok-cote-shared";
import HorokCoteProblemBrowser from "./HorokCoteProblemBrowser";

type HorokCoteCatalogProps = {
  problems: HorokCoteProblem[];
  initialSelectedLevel: string;
};

export default function HorokCoteCatalog({
  problems,
  initialSelectedLevel,
}: HorokCoteCatalogProps) {
  const [selectedLevel, setSelectedLevel] = useState(initialSelectedLevel);

  return (
    <>
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-hidden text-sm text-slate-500 dark:text-slate-400">
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
            <ChevronRight className="size-4 text-slate-300 dark:text-slate-600" />
            <HorokCoteLevelDropdown
              levels={HOROK_COTE_LEVELS}
              value={selectedLevel}
              onChange={setSelectedLevel}
            />
            <ChevronRight className="hidden size-4 text-slate-300 dark:text-slate-600 sm:block" />
            <div className="hidden min-w-0 max-w-[280px] flex-1 sm:block">
              <HorokCoteProblemQuickSearch problems={problems} alwaysExpanded />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <HorokCoteCreateProblemModal />
            <HeaderActions />
            <div className="rounded-full border border-slate-200 bg-slate-50 p-1 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <ThemeToggle />
            </div>
          </div>
        </div>
        <div className="mt-3 w-full sm:hidden">
          <HorokCoteProblemQuickSearch problems={problems} alwaysExpanded />
        </div>
      </div>
      <HorokCoteProblemBrowser
        problems={problems}
        selectedLevel={selectedLevel}
        onSelectedLevelChange={setSelectedLevel}
        showLevelTabs={false}
      />
    </>
  );
}
