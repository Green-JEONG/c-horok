"use client";

import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type HorokCoteCreateProblemModalProps = {
  className?: string;
};

const LEVEL_OPTIONS = ["Lv.0", "Lv.1", "Lv.2", "Lv.3", "Lv.4", "Lv.5"] as const;

type FormState = {
  number: string;
  title: string;
  level: (typeof LEVEL_OPTIONS)[number];
  category: string;
  duration: string;
  acceptanceRate: string;
  summary: string;
  prompt: string;
  exampleInput: string;
  exampleOutput: string;
  exampleExplanation: string;
};

const INITIAL_FORM_STATE: FormState = {
  number: "",
  title: "",
  level: "Lv.0",
  category: "",
  duration: "",
  acceptanceRate: "",
  summary: "",
  prompt: "",
  exampleInput: "",
  exampleOutput: "",
  exampleExplanation: "",
};

export default function HorokCoteCreateProblemModal({
  className,
}: HorokCoteCreateProblemModalProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        setOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSubmitting, open]);

  if (!isAdmin) {
    return null;
  }

  const handleChange =
    (field: keyof FormState) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setFormState((current) => ({
        ...current,
        [field]: event.target.value,
      }));
      setMessage(null);
    };

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    setOpen(false);
    setMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/horok-cote/problems", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          number: Number(formState.number),
          title: formState.title,
          level: formState.level,
          category: formState.category,
          duration: formState.duration,
          acceptanceRate: formState.acceptanceRate,
          summary: formState.summary,
          prompt: formState.prompt,
          exampleInput: formState.exampleInput,
          exampleOutput: formState.exampleOutput,
          exampleExplanation: formState.exampleExplanation,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data.message ?? "문제 등록에 실패했습니다.");
      }

      setFormState(INITIAL_FORM_STATE);
      setOpen(false);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "문제 등록 중 오류가 발생했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className={cn(
          "h-10 w-10 shrink-0 rounded-full border-[#06923E]/30 bg-transparent text-[#06923E] hover:bg-[#06923E]/8 hover:text-[#047a33] dark:border-[#46c86f]/40 dark:text-[#46c86f] dark:hover:bg-[#46c86f]/10 dark:hover:text-[#7be39a]",
          className,
        )}
        aria-label="코딩 테스트 문제 추가"
      >
        <Plus className="size-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
          <div className="flex max-h-[min(92vh,860px)] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
                  코딩 테스트 문제 추가
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  메인 카드와 문제 설명 패널에 필요한 정보만 입력하면 됩니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-200"
                aria-label="모달 닫기"
              >
                <X className="size-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="scrollbar-green flex min-h-0 flex-1 flex-col overflow-y-auto"
            >
              <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    문제 번호
                  </span>
                  <input
                    required
                    inputMode="numeric"
                    value={formState.number}
                    onChange={handleChange("number")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#06923E] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
                    placeholder="예: 1000"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    제목
                  </span>
                  <input
                    required
                    value={formState.title}
                    onChange={handleChange("title")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#06923E] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
                    placeholder="예: 화면에 문장 출력하기"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    레벨
                  </span>
                  <select
                    value={formState.level}
                    onChange={handleChange("level")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#06923E] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
                  >
                    {LEVEL_OPTIONS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    카테고리
                  </span>
                  <input
                    required
                    value={formState.category}
                    onChange={handleChange("category")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#06923E] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
                    placeholder="예: 구현"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    예상 시간
                  </span>
                  <input
                    required
                    value={formState.duration}
                    onChange={handleChange("duration")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#06923E] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
                    placeholder="예: 10분"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    정답률
                  </span>
                  <input
                    required
                    value={formState.acceptanceRate}
                    onChange={handleChange("acceptanceRate")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#06923E] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
                    placeholder="예: 67%"
                  />
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    카드 요약
                  </span>
                  <input
                    required
                    value={formState.summary}
                    onChange={handleChange("summary")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#06923E] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
                    placeholder="문제 카드에 한 줄로 보일 요약을 입력해 주세요."
                  />
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    문제 설명
                  </span>
                  <textarea
                    required
                    rows={5}
                    value={formState.prompt}
                    onChange={handleChange("prompt")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-[#06923E] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
                    placeholder="문제 설명 패널에 노출될 내용을 입력해 주세요."
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    예제 입력
                  </span>
                  <textarea
                    required
                    rows={4}
                    value={formState.exampleInput}
                    onChange={handleChange("exampleInput")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-900 outline-none transition focus:border-[#06923E] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
                    placeholder="예: 1 2"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    예제 출력
                  </span>
                  <textarea
                    required
                    rows={4}
                    value={formState.exampleOutput}
                    onChange={handleChange("exampleOutput")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-900 outline-none transition focus:border-[#06923E] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
                    placeholder="예: 3"
                  />
                </label>

                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    예제 설명
                  </span>
                  <textarea
                    rows={3}
                    value={formState.exampleExplanation}
                    onChange={handleChange("exampleExplanation")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-[#06923E] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
                    placeholder="선택 사항입니다."
                  />
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
                <p className="min-h-[20px] text-sm text-rose-500">
                  {message ?? ""}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleClose}
                    disabled={isSubmitting}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-[#06923E] text-white hover:bg-[#047a33]"
                  >
                    {isSubmitting ? "등록 중..." : "문제 추가"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
