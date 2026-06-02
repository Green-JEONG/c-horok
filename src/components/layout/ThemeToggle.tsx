"use client";

import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);
  const pathname = usePathname();
  const isCote = pathname?.startsWith("/horok-cote");

  useEffect(() => {
    const root = document.documentElement;
    const savedTheme = window.localStorage.getItem("theme");
    const nextIsDark = savedTheme
      ? savedTheme === "dark"
      : root.classList.contains("dark");

    root.classList.toggle("dark", nextIsDark);
    root.style.colorScheme = nextIsDark ? "dark" : "light";
    setIsDark(nextIsDark);
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    const nextIsDark = !root.classList.contains("dark");

    root.classList.toggle("dark", nextIsDark);
    root.style.colorScheme = nextIsDark ? "dark" : "light";
    window.localStorage.setItem("theme", nextIsDark ? "dark" : "light");
    setIsDark(nextIsDark);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "라이트 모드로 변경" : "다크 모드로 변경"}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-950",
        isCote
          ? "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-50"
          : "dark:border-border dark:bg-background dark:text-foreground dark:hover:border-border dark:hover:bg-muted dark:hover:text-foreground",
      )}
    >
      {isDark ? (
        <Moon className="size-[18px]" />
      ) : (
        <Sun className="size-[18px]" />
      )}
    </button>
  );
}
