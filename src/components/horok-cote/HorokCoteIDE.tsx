"use client";

import { Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { HorokCoteProblem } from "@/lib/horok-cote-shared";
import { cn } from "@/lib/utils";

type Language = "python" | "java" | "cpp";

type RunResult = "idle" | "success" | "failure";

type HorokCoteIDEProps = {
  problem: HorokCoteProblem;
  onSolved?: () => void;
};

type ExecutionState = {
  status: RunResult;
  output: string;
};

const EMPTY_STARTER_CODES = {
  python: "",
  java: "",
  cpp: "",
} as const;

const languageMeta: Record<
  Language,
  {
    label: string;
    runtime: string;
    fileName: string;
  }
> = {
  python: {
    label: "Python 3",
    runtime: "python3",
    fileName: "main.py",
  },
  java: {
    label: "Java 21",
    runtime: "java",
    fileName: "Main.java",
  },
  cpp: {
    label: "C++17",
    runtime: "cpp17",
    fileName: "main.cpp",
  },
};

export default function HorokCoteIDE({ problem, onSolved }: HorokCoteIDEProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("python");
  const [editedCodes, setEditedCodes] = useState(EMPTY_STARTER_CODES);
  const [executionState, setExecutionState] = useState<ExecutionState>({
    status: "idle",
    output: "",
  });
  const lineNumberRef = useRef<HTMLDivElement | null>(null);
  const currentLanguage = languageMeta[selectedLanguage];
  const code = editedCodes[selectedLanguage];
  const lineNumbers = useMemo(
    () =>
      Array.from({ length: code.split("\n").length }, (_, index) => index + 1),
    [code],
  );

  useEffect(() => {
    void problem.slug;
    setEditedCodes(EMPTY_STARTER_CODES);
    setSelectedLanguage("python");
    setExecutionState({
      status: "idle",
      output: "",
    });
  }, [problem.slug]);

  function getSimulatedOutput(language: Language, source: string) {
    const patterns: Record<Language, RegExp[]> = {
      python: [/print\s*\(\s*["'`]([\s\S]*?)["'`]\s*\)/],
      java: [/System\.out\.println\s*\(\s*"([\s\S]*?)"\s*\)/],
      cpp: [/cout\s*<<\s*"([\s\S]*?)"\s*<<\s*['"]\\n['"]/],
    };

    const matched = patterns[language]
      .map((pattern) => source.match(pattern)?.[1])
      .find((value) => typeof value === "string");

    return matched?.replace(/\\n/g, "\n").trimEnd() ?? "";
  }

  function handleRun() {
    const output = getSimulatedOutput(selectedLanguage, code);
    const expected = problem.examples[0]?.output ?? "";
    const isSuccess = output === expected;

    if (isSuccess) {
      onSolved?.();
    }

    setExecutionState({
      status: isSuccess ? "success" : "failure",
      output,
    });
  }

  return (
    <section className="scrollbar-green flex h-full min-h-0 flex-col overflow-x-hidden overflow-y-auto rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,#111827_0%,#0f172a_100%)]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800 sm:px-5">
        <div className="scrollbar-green flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap">
          {(["python", "java", "cpp"] as Language[]).map((language) => {
            const meta = languageMeta[language];
            const isActive = selectedLanguage === language;

            return (
              <button
                key={language}
                type="button"
                onClick={() => {
                  setSelectedLanguage(language);
                  setExecutionState({
                    status: "idle",
                    output: "",
                  });
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition",
                  isActive
                    ? "border-[#06923E] text-[#06923E] dark:border-[#46c86f] dark:text-[#46c86f]"
                    : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100",
                )}
              >
                {meta.label}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-slate-400 dark:text-slate-500 sm:text-xs">
            {currentLanguage.fileName}
          </span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.7fr)_minmax(0,0.65fr)] sm:grid-rows-[minmax(0,1.2fr)_minmax(0,0.72fr)]">
        <div className="relative min-h-0 overflow-hidden bg-white dark:bg-slate-950">
          <div
            ref={lineNumberRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 scrollbar-hide flex w-7 flex-col overflow-y-hidden pr-2 py-4 text-right font-mono text-[13px] leading-7 text-slate-400 dark:text-slate-500 sm:w-8 sm:text-sm"
          >
            {lineNumbers.map((lineNumber) => (
              <span key={lineNumber}>{lineNumber}</span>
            ))}
          </div>
          <textarea
            value={code}
            onChange={(event) => {
              setEditedCodes((current) => ({
                ...current,
                [selectedLanguage]: event.target.value,
              }));
              setExecutionState({
                status: "idle",
                output: "",
              });
            }}
            onScroll={(event) => {
              if (lineNumberRef.current) {
                lineNumberRef.current.scrollTop = event.currentTarget.scrollTop;
              }
            }}
            spellCheck={false}
            className="scrollbar-green h-full min-h-0 w-full overflow-y-auto overflow-x-auto resize-none bg-transparent py-4 pl-10 pr-4 font-mono text-[15px] leading-7 text-slate-800 outline-none dark:text-slate-100 sm:text-base"
            aria-label={`${currentLanguage.label} 코드 에디터`}
          />
        </div>

        <div className="flex min-h-0 flex-col border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
              실행 결과
            </p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  executionState.status === "success" &&
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
                  executionState.status === "failure" &&
                    "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
                  executionState.status === "idle" &&
                    "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                )}
              >
                {executionState.status === "success"
                  ? "성공"
                  : executionState.status === "failure"
                    ? "실패"
                    : "대기"}
              </span>
              <Button
                size="sm"
                onClick={handleRun}
                className="bg-[#06923E] text-white hover:bg-[#047a33]"
              >
                <Play className="size-4" />
                실행
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-5 sm:pb-5">
            <div className="flex min-h-[96px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 sm:h-full sm:min-h-[160px]">
              <pre className="scrollbar-green min-h-0 flex-1 overflow-auto px-4 py-4 font-mono text-[15px] leading-7 text-slate-800 dark:text-slate-100 sm:text-base">
                {executionState.output || "(출력 없음)"}
              </pre>
            </div>
            <div className="h-5 shrink-0" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
