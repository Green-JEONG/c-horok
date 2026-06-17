"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type HorokCodingLevelDropdownProps = {
  levels: readonly string[];
  value: string;
  onChange: (level: string) => void;
  topItem?: {
    label: string;
    value: string;
    count?: number;
  };
  levelCounts?: Record<string, number>;
  bottomItems?: Array<{
    label: string;
    value: string;
    count?: number;
  }>;
  onBottomItemSelect?: (value: string) => void;
};

export default function HorokCodingLevelDropdown({
  levels,
  value,
  onChange,
  topItem,
  levelCounts = {},
  bottomItems = [],
  onBottomItemSelect,
}: HorokCodingLevelDropdownProps) {
  const [open, setOpen] = useState(false);
  const renderDropdownItemContent = (label: string, count?: number) => (
    <>
      <span>{label}</span>
      {count !== undefined ? (
        <span className="ml-3 text-slate-400 dark:text-slate-500">{count}</span>
      ) : null}
    </>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex min-w-[80px] items-center gap-1.5 rounded-[999px] border border-slate-200 bg-white py-2 pl-4 pr-2 text-sm font-semibold text-slate-950 outline-none transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:hover:border-slate-600"
        >
          <span>{value}</span>
          <ChevronDown className="size-4 text-slate-400 dark:text-slate-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        collisionPadding={16}
        className="w-max min-w-0 rounded-[24px] border-slate-200 bg-white p-2 shadow-[0_12px_28px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_20px_36px_rgba(2,6,23,0.5)]"
      >
        {topItem ? (
          <DropdownMenuItem
            className="justify-between whitespace-nowrap rounded-[999px] px-3 py-2 text-right text-sm font-semibold text-slate-700 focus:bg-slate-100 focus:text-slate-950 dark:text-slate-200 dark:focus:bg-slate-800 dark:focus:text-slate-50"
            onSelect={() => {
              onChange(topItem.value);
              setOpen(false);
            }}
          >
            {renderDropdownItemContent(topItem.label, topItem.count)}
          </DropdownMenuItem>
        ) : null}
        {levels.map((level) => (
          <DropdownMenuItem
            key={level}
            className="justify-between whitespace-nowrap rounded-[999px] px-3 py-2 text-right text-sm font-semibold text-slate-700 focus:bg-slate-100 focus:text-slate-950 dark:text-slate-200 dark:focus:bg-slate-800 dark:focus:text-slate-50"
            onSelect={() => {
              onChange(level);
              setOpen(false);
            }}
          >
            {renderDropdownItemContent(level, levelCounts[level])}
          </DropdownMenuItem>
        ))}
        {bottomItems.length > 0 ? (
          <div className="my-1 border-t border-slate-100 pt-1 dark:border-slate-800">
            {bottomItems.map((item) => (
              <DropdownMenuItem
                key={item.value}
                className="justify-between whitespace-nowrap rounded-[999px] px-3 py-2 text-right text-sm font-semibold text-slate-700 focus:bg-slate-100 focus:text-slate-950 dark:text-slate-200 dark:focus:bg-slate-800 dark:focus:text-slate-50"
                onSelect={() => {
                  onBottomItemSelect?.(item.value);
                  setOpen(false);
                }}
              >
                {renderDropdownItemContent(item.label, item.count)}
              </DropdownMenuItem>
            ))}
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
