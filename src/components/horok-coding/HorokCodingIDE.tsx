"use client";

import { Check, Clock, Copy, Play, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import type {
  ConditionCheck,
  HorokCodingCondition,
  HorokCodingProblem,
} from "@/lib/horok-coding-shared";
import { cn } from "@/lib/utils";

function parseDurationToSeconds(durationStr: string): number {
  if (!durationStr) return 0;
  let totalSeconds = 0;
  const hourMatch = durationStr.match(/(\d+)\s*시간/);
  const minMatch = durationStr.match(/(\d+)\s*분/);
  const secMatch = durationStr.match(/(\d+)\s*초/);

  if (hourMatch) {
    totalSeconds += Number.parseInt(hourMatch[1], 10) * 3600;
  }
  if (minMatch) {
    totalSeconds += Number.parseInt(minMatch[1], 10) * 60;
  }
  if (secMatch) {
    totalSeconds += Number.parseInt(secMatch[1], 10);
  }

  if (!hourMatch && !minMatch && !secMatch) {
    const rawNumber = durationStr.replace(/[^\d]/g, "");
    if (rawNumber) {
      totalSeconds += Number.parseInt(rawNumber, 10) * 60;
    }
  }
  return totalSeconds;
}

function evaluateCondition(check: ConditionCheck, output: string): boolean {
  const trimmed = output.trim();
  switch (check.type) {
    case "output_not_empty":
      return trimmed.length > 0;
    case "output_equals":
      return trimmed === check.value.trim();
    case "output_contains":
      return trimmed.includes(check.value);
    case "output_matches":
      try {
        return new RegExp(check.pattern).test(trimmed);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

function ConditionList({
  conditions,
  isOpen,
  conditionResults,
  currentConditionIndex,
  currentConditionProgress,
}: {
  conditions: HorokCodingCondition[];
  isOpen: boolean;
  conditionResults?: Array<ConditionResult | undefined>;
  currentConditionIndex?: number | null;
  currentConditionProgress?: number;
}) {
  const [visibleCount, setVisibleCount] = useState(0);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    if (!isOpen) {
      setVisibleCount(0);
      return;
    }
    setVisibleCount(0);
    const timeoutIds: number[] = [];
    conditions.forEach((_, i) => {
      timeoutIds.push(
        window.setTimeout(() => {
          setVisibleCount((prev) => {
            const next = Math.max(prev, i + 1);
            // scroll this item into view
            window.setTimeout(() => {
              itemRefs.current[i]?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
              });
            }, 0);
            return next;
          });
        }, i * 180),
      );
    });
    return () => {
      for (const id of timeoutIds) {
        window.clearTimeout(id);
      }
    };
  }, [isOpen, conditions]);

  useEffect(() => {
    if (currentConditionIndex === null || currentConditionIndex === undefined) {
      return;
    }

    itemRefs.current[currentConditionIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [currentConditionIndex]);

  return (
    <ol className="space-y-1.5">
      {conditions.map((cond, i) => {
        const condResult = conditionResults?.[i];
        const showResult = condResult !== undefined;
        const isChecking = currentConditionIndex === i && !showResult;
        const isPassed = condResult === "passed";
        const progress = Math.max(
          0,
          Math.min(100, isChecking ? (currentConditionProgress ?? 0) : 0),
        );
        const ringRadius = 7;
        const ringCircumference = 2 * Math.PI * ringRadius;
        return (
          <li
            key={cond.text}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className={cn(
              "flex items-start gap-2 transition-all duration-300",
              i < visibleCount
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-1 pointer-events-none",
            )}
          >
            <span
              className={cn(
                "shrink-0 mt-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold transition-colors duration-200",
                isChecking
                  ? "bg-[#06923E]/10 text-[#06923E] dark:bg-[#46c86f]/15 dark:text-[#46c86f]"
                  : showResult
                    ? isPassed
                      ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400",
              )}
            >
              {isChecking ? (
                <svg
                  viewBox="0 0 18 18"
                  className="size-4 -rotate-90"
                  aria-hidden="true"
                >
                  <circle
                    cx="9"
                    cy="9"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.18"
                    strokeWidth="2"
                  />
                  <circle
                    cx="9"
                    cy="9"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringCircumference * (1 - progress / 100)}
                    className="transition-[stroke-dashoffset] duration-75"
                  />
                </svg>
              ) : showResult ? (
                isPassed ? (
                  <Check className="size-2.5 stroke-[3]" />
                ) : (
                  <X className="size-2.5 stroke-[3]" />
                )
              ) : (
                i + 1
              )}
            </span>
            <span
              className={cn(
                "text-slate-600 dark:text-slate-300 leading-relaxed transition-colors duration-200",
                showResult &&
                  (isPassed
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-rose-700 dark:text-rose-300"),
                isChecking && "font-medium text-[#06923E] dark:text-[#46c86f]",
              )}
            >
              {cond.text}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type RunResult = "idle" | "success" | "failure";
type Language = "python" | "java" | "cpp" | "javascript";
type ConditionResult = "passed" | "failed";
type TestCaseResult = "passed" | "failed" | "pending";
type TestCaseRunResult = {
  caseResult: TestCaseResult;
  conditionResults: Array<ConditionResult | undefined>;
};

type HorokCodingIDEProps = {
  problem: HorokCodingProblem;
  onSolved?: () => void;
  elapsedSeconds?: number;
};

type SubmissionRecord = {
  id: string;
  language: Language;
  sourceCode: string;
  status: string;
  elapsedSeconds: number | null;
  createdAt: string;
};

type ExecutionState = {
  status: RunResult;
  output: string;
};

function getConditionPassRate(
  conditionResults: Array<ConditionResult | undefined> | undefined,
  fallbackPassed: boolean,
) {
  if (!conditionResults || conditionResults.length === 0) {
    return fallbackPassed ? 100 : 0;
  }

  const passedCount = conditionResults.filter(
    (result) => result === "passed",
  ).length;

  return Math.round((passedCount / conditionResults.length) * 100);
}

function getTestCaseConditions(
  testCase: HorokCodingProblem["testCases"][number],
) {
  if (testCase.conditions && testCase.conditions.length > 0) {
    return testCase.conditions;
  }

  const expected = testCase.expected.trim();

  if (!expected) {
    return [
      {
        text: "출력 결과가 비어 있어야 합니다.",
        check: {
          type: "output_equals" as const,
          value: "",
        },
      },
      {
        text: "불필요한 문자나 공백이 출력되지 않아야 합니다.",
        check: {
          type: "output_matches" as const,
          pattern: "^\\s*$",
        },
      },
    ];
  }

  return [
    {
      text: "콘솔 출력이 비어 있지 않아야 합니다.",
      check: {
        type: "output_not_empty" as const,
      },
    },
    {
      text: `대소문자가 정확하게 구분되게 '${expected}'와 완전히 일치해야 합니다.`,
      check: {
        type: "output_equals" as const,
        value: expected,
      },
    },
    {
      text: "추가 문자, 누락 문자, 대소문자 차이 없이 예상 출력 형식과 완전히 같아야 합니다.",
      check: {
        type: "output_matches" as const,
        pattern: `^\\s*${escapeRegExp(expected)}\\s*$`,
      },
    },
  ];
}

const EMPTY_STARTER_CODES = {
  python: "",
  java: "",
  cpp: "",
  javascript: "",
};
const RESULT_PANEL_DEFAULT_RATIO = 0.38;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
  javascript: {
    label: "JavaScript",
    runtime: "javascript",
    fileName: "index.js",
  },
};

export default function HorokCodingIDE({
  problem,
  onSolved,
  elapsedSeconds = 0,
}: HorokCodingIDEProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>("python");
  const [editedCodes, setEditedCodes] = useState(EMPTY_STARTER_CODES);
  const [isRunning, setIsRunning] = useState(false);
  const [runningCaseIndex, setRunningCaseIndex] = useState(0);
  const [runningConditionIndex, setRunningConditionIndex] = useState<
    number | null
  >(null);
  const [runningConditionProgress, setRunningConditionProgress] = useState(0);
  const [caseProgress, setCaseProgress] = useState(0);
  const [testResults, setTestResults] = useState<TestCaseRunResult[]>([]);

  const [activeTab, setActiveTab] = useState<"result" | "submissions">(
    "result",
  );
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [openSubmissionCodeId, setOpenSubmissionCodeId] = useState<
    string | null
  >(null);
  const [copiedSubId, setCopiedSubId] = useState<string | null>(null);
  const [openTestCaseIndex, setOpenTestCaseIndex] = useState<number | null>(
    null,
  );

  const handleCopyCode = useCallback(
    async (subId: string, codeText: string) => {
      try {
        await navigator.clipboard.writeText(codeText);
        setCopiedSubId(subId);
        setTimeout(() => {
          setCopiedSubId((current) => (current === subId ? null : current));
        }, 2000);
      } catch (error) {
        console.error("Failed to copy code:", error);
      }
    },
    [],
  );

  const fetchSubmissions = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/horok-coding/submissions?problemSlug=${encodeURIComponent(problem.slug)}`,
        { cache: "no-store" },
      );
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      } else {
        console.error("Failed to fetch submissions:", response.status);
      }
    } catch (error) {
      console.error("Failed to fetch submissions:", error);
    }
  }, [problem.slug]);

  function formatElapsedTime(totalSeconds: number) {
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(
      2,
      "0",
    );
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  const testCasesToRun = useMemo(() => {
    return problem.testCases || [];
  }, [problem]);

  const totalProgress = useMemo(() => {
    if (!isRunning || testCasesToRun.length === 0) return 0;
    const completedWeight = runningCaseIndex * 100;
    const currentWeight = caseProgress;
    return (
      ((completedWeight + currentWeight) / (testCasesToRun.length * 100)) * 100
    );
  }, [isRunning, runningCaseIndex, caseProgress, testCasesToRun.length]);

  const lineNumberRef = useRef<HTMLDivElement | null>(null);
  const currentLanguage = languageMeta[selectedLanguage];
  const code = editedCodes[selectedLanguage];
  const lineNumbers = useMemo(
    () =>
      Array.from({ length: code.split("\n").length }, (_, index) => index + 1),
    [code],
  );

  const [executionState, setExecutionState] = useState<ExecutionState>({
    status: "idle",
    output: "",
  });
  const [resultModal, setResultModal] = useState<{
    open: boolean;
    status: "success" | "failure";
  }>({ open: false, status: "success" });

  // Resizable panel state: resultPanelHeight in px
  const [resultPanelHeight, setResultPanelHeight] = useState<number | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  const handleResultPanelMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const panelTop = e.currentTarget.getBoundingClientRect().top;
      if (e.clientY - panelTop > 8) {
        return;
      }

      e.preventDefault();
      isDraggingRef.current = true;
      startYRef.current = e.clientY;
      const container = containerRef.current;
      if (!container) return;
      // Measure the current result panel height from the DOM
      const containerH = container.getBoundingClientRect().height;
      const defaultHeight = containerH * RESULT_PANEL_DEFAULT_RATIO;
      const ratio = resultPanelHeight ?? defaultHeight;
      startHeightRef.current = ratio;

      const onMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const delta = startYRef.current - moveEvent.clientY;
        const containerH2 = container.getBoundingClientRect().height;
        const minH = containerH2 * RESULT_PANEL_DEFAULT_RATIO;
        const maxH = Math.max(minH, containerH2 - 120);
        const newH = Math.min(
          maxH,
          Math.max(minH, startHeightRef.current + delta),
        );
        setResultPanelHeight(newH);
      };
      const onUp = () => {
        isDraggingRef.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [resultPanelHeight],
  );

  useEffect(() => {
    if (!resultModal.open) return;

    const timeoutId = window.setTimeout(() => {
      setResultModal((prev) => ({ ...prev, open: false }));
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [resultModal.open]);

  useEffect(() => {
    setEditedCodes(EMPTY_STARTER_CODES);
    setSelectedLanguage("python");
    setExecutionState({
      status: "idle",
      output: "",
    });
    setResultModal({
      open: false,
      status: "success",
    });
    setIsRunning(false);
    setRunningCaseIndex(0);
    setRunningConditionIndex(null);
    setRunningConditionProgress(0);
    setCaseProgress(0);
    setTestResults([]);
    fetchSubmissions();
    setActiveTab("result");
    setOpenSubmissionCodeId(null);
    setOpenTestCaseIndex(null);

    const loadSavedCodes = async () => {
      try {
        const response = await fetch(
          `/api/horok-coding/saved-code?problemSlug=${encodeURIComponent(problem.slug)}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data) {
            setEditedCodes({
              python: data.python ?? "",
              java: data.java ?? "",
              cpp: data.cpp ?? "",
              javascript: data.javascript ?? "",
            });
          }
        }
      } catch (error) {
        console.error("Failed to load saved codes:", error);
      }
    };

    loadSavedCodes();
  }, [problem.slug, fetchSubmissions]);

  function getSimulatedOutput(language: Language, source: string) {
    const patterns: Record<Language, RegExp[]> = {
      python: [/print\s*\(\s*["'`]([\s\S]*?)["'`]\s*\)/],
      java: [/System\.out\.println\s*\(\s*"([\s\S]*?)"\s*\)/],
      cpp: [/cout\s*<<\s*"([\s\S]*?)"\s*<<\s*['"]\\n['"]/],
      javascript: [/console\.log\s*\(\s*["'`]([\s\S]*?)["'`]\s*\)/],
    };

    const matched = patterns[language]
      .map((pattern) => source.match(pattern)?.[1])
      .find((value) => typeof value === "string");

    return matched?.replace(/\\n/g, "\n").trimEnd() ?? "";
  }

  async function handleRun() {
    if (isRunning) return;

    setIsRunning(true);
    setRunningCaseIndex(0);
    setRunningConditionIndex(null);
    setRunningConditionProgress(0);
    setCaseProgress(0);
    const initialResults: TestCaseRunResult[] = testCasesToRun.map(() => ({
      caseResult: "pending",
      conditionResults: [],
    }));
    setTestResults(initialResults);

    const output = getSimulatedOutput(selectedLanguage, code);

    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const finalResults = [...initialResults];

    for (let i = 0; i < testCasesToRun.length; i++) {
      setRunningCaseIndex(i);
      setOpenTestCaseIndex(i);
      setRunningConditionIndex(null);
      setRunningConditionProgress(0);
      setCaseProgress(0);

      const tc = testCasesToRun[i];
      const conditions = getTestCaseConditions(tc);
      const conditionResults: Array<ConditionResult | undefined> = [];

      finalResults[i] = {
        caseResult: "pending",
        conditionResults,
      };
      setTestResults([...finalResults]);

      for (
        let conditionIndex = 0;
        conditionIndex < conditions.length;
        conditionIndex++
      ) {
        const condition = conditions[conditionIndex];
        setRunningConditionIndex(conditionIndex);
        setRunningConditionProgress(0);
        setCaseProgress((conditionIndex / conditions.length) * 100);

        const progressSteps = 12;
        for (let step = 1; step <= progressSteps; step++) {
          await delay(28);
          const nextConditionProgress = (step / progressSteps) * 100;
          setRunningConditionProgress(nextConditionProgress);
          setCaseProgress(
            ((conditionIndex + nextConditionProgress / 100) /
              conditions.length) *
              100,
          );
        }

        conditionResults[conditionIndex] = condition.check
          ? evaluateCondition(condition.check, output)
            ? "passed"
            : "failed"
          : output.trim() === tc.expected.trim()
            ? "passed"
            : "failed";

        finalResults[i] = {
          caseResult: "pending",
          conditionResults: [...conditionResults],
        };
        setTestResults([...finalResults]);
        setCaseProgress(((conditionIndex + 1) / conditions.length) * 100);
        setRunningConditionProgress(100);
        await delay(180);
      }

      setRunningConditionIndex(null);
      setRunningConditionProgress(0);

      const overallPassed =
        conditionResults.length > 0
          ? conditionResults.every((r) => r === "passed")
          : output.trim() === tc.expected.trim();

      finalResults[i] = {
        caseResult: overallPassed ? "passed" : "failed",
        conditionResults,
      };
      setTestResults([...finalResults]);
    }

    const isSuccess = finalResults.every((r) => r.caseResult === "passed");
    setIsRunning(false);
    setRunningConditionIndex(null);
    setRunningConditionProgress(0);

    if (isSuccess) {
      onSolved?.();
    }

    setExecutionState({
      status: isSuccess ? "success" : "failure",
      output,
    });

    setResultModal({
      open: true,
      status: isSuccess ? "success" : "failure",
    });

    void fetch("/api/horok-coding/saved-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        problemSlug: problem.slug,
        problemNumber: problem.number,
        language: selectedLanguage,
        sourceCode: code,
      }),
    })
      .then(() => null)
      .catch(() => {
        return null;
      });

    void fetch("/api/horok-coding/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        problemSlug: problem.slug,
        problemNumber: problem.number,
        language: selectedLanguage,
        sourceCode: code,
        status: isSuccess ? "solved" : "failed",
        elapsedSeconds: elapsedSeconds,
      }),
    })
      .then((res) => {
        if (res.ok) {
          fetchSubmissions();
        }
      })
      .catch(() => {
        return null;
      });
  }

  return (
    <>
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,#111827_0%,#0f172a_100%)]">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800 sm:px-5">
          <div className="scrollbar-green flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap">
            {(["python", "java", "cpp", "javascript"] as Language[]).map(
              (language) => {
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
              },
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 sm:text-xs">
              {currentLanguage.fileName}
            </span>
          </div>
        </div>

        <div
          ref={containerRef}
          className="grid min-h-0 flex-1 flex-col"
          style={{
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            className="relative min-h-0 overflow-hidden bg-white dark:bg-slate-950"
            style={{ flex: "1 1 0", minHeight: 0 }}
          >
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
                  lineNumberRef.current.scrollTop =
                    event.currentTarget.scrollTop;
                }
              }}
              spellCheck={false}
              className="scrollbar-green h-full min-h-0 w-full overflow-y-auto overflow-x-auto resize-none bg-transparent py-4 pl-10 pr-4 font-mono text-[15px] leading-7 text-slate-800 outline-none dark:text-slate-100 sm:text-base"
              aria-label={`${currentLanguage.label} 코드 에디터`}
            />
          </div>

          <div
            className="relative flex min-h-0 flex-col border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
            style={
              resultPanelHeight !== null
                ? { height: resultPanelHeight, flex: "none" }
                : { flex: `0 0 ${RESULT_PANEL_DEFAULT_RATIO * 100}%` }
            }
          >
            <div
              onMouseDown={handleResultPanelMouseDown}
              className="group absolute inset-x-0 top-0 z-20 h-2 cursor-row-resize"
              aria-hidden="true"
            >
              <span className="absolute inset-x-0 top-0 h-px bg-transparent transition-colors group-hover:bg-[#06923E]/55 dark:group-hover:bg-[#46c86f]/60" />
            </div>
            <div className="relative flex select-none items-center justify-between gap-3 px-4 py-2 sm:px-5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => setActiveTab("result")}
                  className={cn(
                    "cursor-pointer rounded-md px-1.5 py-1.5 text-sm font-semibold transition outline-none",
                    activeTab === "result"
                      ? "text-slate-900 dark:text-slate-50"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
                  )}
                >
                  실행 결과
                </button>
                <button
                  type="button"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => setActiveTab("submissions")}
                  className={cn(
                    "cursor-pointer rounded-md px-1.5 py-1.5 text-sm font-semibold transition outline-none",
                    activeTab === "submissions"
                      ? "text-slate-900 dark:text-slate-50"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200",
                  )}
                >
                  제출 이력
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={handleRun}
                  disabled={isRunning}
                  className="bg-[#06923E] text-white hover:bg-[#047a33] disabled:opacity-50"
                >
                  <Play className="size-4" />
                  {isRunning ? "실행 중..." : "실행"}
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                {activeTab === "result" ? (
                  <div className="scrollbar-green min-h-0 flex-1 overflow-auto px-5 py-4 space-y-4">
                    {isRunning && (
                      <div className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#06923E] h-full transition-all duration-100"
                          style={{ width: `${totalProgress}%` }}
                        />
                      </div>
                    )}
                    <div className="space-y-2.5">
                      {testCasesToRun.map((tc, index) => {
                        const isCurrent =
                          isRunning && runningCaseIndex === index;
                        const isCompleted =
                          executionState.status !== "idle" && !isRunning;
                        const isDoneCase =
                          isCompleted ||
                          (isRunning && index < runningCaseIndex);
                        const isCasePassed =
                          testResults[index]?.caseResult === "passed";
                        const isCaseFailed =
                          testResults[index]?.caseResult === "failed";
                        const conditionResults =
                          testResults[index]?.conditionResults;
                        const conditions = getTestCaseConditions(tc);
                        const casePassRate = getConditionPassRate(
                          conditionResults,
                          isCasePassed,
                        );
                        const isOpen = openTestCaseIndex === index;

                        return (
                          <div
                            key={tc.name}
                            className="rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 overflow-hidden"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setOpenTestCaseIndex(isOpen ? null : index)
                              }
                              className="flex w-full items-center justify-between p-3 text-sm hover:bg-slate-100/30 dark:hover:bg-slate-800/10 transition text-left outline-none"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {tc.name}
                                </span>
                                {isCurrent && (
                                  <span className="text-xs text-slate-400 dark:text-slate-500 animate-pulse">
                                    실행 중...
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {isCurrent && (
                                  <>
                                    <div className="w-20 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className="bg-emerald-500 h-full transition-all duration-100"
                                        style={{ width: `${caseProgress}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                      {Math.round(caseProgress)}%
                                    </span>
                                  </>
                                )}
                                {isDoneCase && isCasePassed && (
                                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                    <Check className="size-3.5 stroke-[3]" />{" "}
                                    성공 {casePassRate}%
                                  </span>
                                )}
                                {isDoneCase && isCaseFailed && (
                                  <span className="flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                                    <X className="size-3.5 stroke-[3]" /> 실패{" "}
                                    {casePassRate}%
                                  </span>
                                )}
                                {!isDoneCase && !isCurrent && null}
                              </div>
                            </button>
                            {isOpen && (
                              <div className="px-3 pb-3 pt-2 border-t border-slate-200/40 dark:border-slate-800/40">
                                <p className="font-bold text-[10px] text-slate-400 dark:text-slate-500 mb-2 tracking-wider uppercase">
                                  검증 요구 조건
                                </p>
                                <div className="space-y-2">
                                  <ConditionList
                                    conditions={conditions}
                                    isOpen={isOpen}
                                    conditionResults={
                                      isDoneCase || isCurrent
                                        ? conditionResults
                                        : undefined
                                    }
                                    currentConditionIndex={
                                      isCurrent ? runningConditionIndex : null
                                    }
                                    currentConditionProgress={
                                      isCurrent
                                        ? runningConditionProgress
                                        : undefined
                                    }
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {executionState.status !== "idle" && !isRunning && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1.5">
                          출력값
                        </p>
                        <pre className="font-mono text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/60 overflow-x-auto">
                          {executionState.output || "(출력 없음)"}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="scrollbar-green min-h-0 flex-1 overflow-auto p-4 space-y-3 bg-white dark:bg-slate-950">
                    {submissions.length === 0 ? (
                      <div className="flex items-center justify-center h-full min-h-[120px] text-sm text-slate-400 dark:text-slate-500">
                        제출 이력이 없습니다.
                      </div>
                    ) : (
                      submissions.map((sub) => {
                        const isCodeOpen = openSubmissionCodeId === sub.id;
                        const dateStr = new Date(
                          sub.createdAt,
                        ).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        return (
                          // biome-ignore lint/a11y/useSemanticElements: wraps nested button
                          <div
                            key={sub.id}
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              setOpenSubmissionCodeId(
                                isCodeOpen ? null : sub.id,
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setOpenSubmissionCodeId(
                                  isCodeOpen ? null : sub.id,
                                );
                              }
                            }}
                            className="group rounded-xl border border-slate-100 dark:border-slate-800/60 p-3.5 bg-slate-50/50 dark:bg-slate-900/30 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/30 transition duration-150 ease-in-out"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium group-hover:text-slate-600 dark:group-hover:text-slate-400 transition-colors">
                                {dateStr}
                              </span>
                              <span
                                className={cn(
                                  "font-bold text-sm",
                                  sub.status === "solved"
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-rose-600 dark:text-rose-400",
                                )}
                              >
                                {sub.status === "solved" ? "성공" : "실패"}
                              </span>
                            </div>
                            {isCodeOpen && (
                              <div
                                role="none"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="mt-3 pt-3 border-t border-slate-200/50 dark:border-slate-800/50 space-y-3 cursor-default"
                              >
                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                    {languageMeta[sub.language]?.label ||
                                      sub.language}
                                  </span>
                                  {sub.elapsedSeconds !== null && (
                                    <div
                                      className={cn(
                                        "flex items-center gap-1.5 font-mono text-sm font-semibold",
                                        problem.duration
                                          ? sub.elapsedSeconds >
                                            parseDurationToSeconds(
                                              problem.duration,
                                            )
                                            ? "text-rose-600 dark:text-rose-400"
                                            : "text-blue-600 dark:text-blue-400"
                                          : "text-slate-500 dark:text-slate-400",
                                      )}
                                    >
                                      <Clock className="size-4" />
                                      <span>
                                        {formatElapsedTime(sub.elapsedSeconds)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-start gap-2.5 p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-lg">
                                  <pre className="scrollbar-green m-0 flex-1 overflow-auto text-[13px] font-mono leading-6 text-slate-700 dark:text-slate-300 max-h-48 overflow-x-auto whitespace-pre">
                                    {sub.sourceCode}
                                  </pre>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyCode(sub.id, sub.sourceCode)
                                    }
                                    className="shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                                    aria-label="코드 복사"
                                    title="코드 복사"
                                  >
                                    {copiedSubId === sub.id ? (
                                      <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                    ) : (
                                      <Copy className="size-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {resultModal.open &&
        createPortal(
          <div className="fixed left-1/2 top-32 z-[200] w-[min(340px,calc(100vw-40px))] -translate-x-1/2 transition-all duration-250 ease-out animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="relative flex items-center gap-3 rounded-md border border-transparent bg-white px-5 py-4 text-zinc-500 shadow-[0_12px_28px_rgba(0,0,0,0.16)] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-[0_16px_32px_rgba(0,0,0,0.42)]">
              {resultModal.status === "success" ? (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#13c51b] text-white">
                  <Check className="h-5.5 w-5.5 stroke-[3]" />
                </span>
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white">
                  <X className="h-5.5 w-5.5 stroke-[3]" />
                </span>
              )}
              <p className="min-w-0 truncate pr-5 text-base font-medium tracking-normal text-slate-900 dark:text-slate-50">
                {resultModal.status === "success"
                  ? "문제를 풀었습니다!"
                  : "문제를 틀렸습니다!"}
              </p>
              <button
                type="button"
                onClick={() =>
                  setResultModal((prev) => ({ ...prev, open: false }))
                }
                className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                aria-label="결과 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
