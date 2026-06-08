"use client";

import { Crown, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useState } from "react";
import CommentForm from "@/components/posts/CommentForm";
import { cn } from "@/lib/utils";

type Props = {
  postId: number;
  buttonLabel?: string;
  placeholder?: string;
  requiresLogin?: boolean;
  submitLabel?: string;
  showSecretOption?: boolean;
  align?: "center" | "start";
  className?: string;
  iconVariant?: "plus" | "graph-card";
  showGraphTail?: boolean;
  currentUserName?: string | null;
  currentUserImage?: string | null;
  currentUserRole?: "USER" | "ADMIN" | null;
  graphTailColor?: string | null;
};

export default function InquiryAnswerComposer({
  postId,
  buttonLabel = "추가 답변하기",
  placeholder = "답변을 작성하세요",
  requiresLogin = false,
  submitLabel = "답변 등록",
  showSecretOption = false,
  align = "center",
  className,
  iconVariant = "plus",
  showGraphTail = false,
  currentUserName = null,
  currentUserImage = null,
  currentUserRole = null,
  graphTailColor = null,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const isGraphCard = iconVariant === "graph-card";

  if (isGraphCard) {
    return (
      <div
        className={cn("relative mt-4 pl-8", className)}
        style={
          {
            "--composer-graph-tail-color": graphTailColor ?? "rgb(161 161 170)",
          } as CSSProperties
        }
      >
        {showGraphTail ? (
          <>
            <span className="absolute left-2 top-12 bottom-0 w-0.5 bg-border transition" />
            <span className="absolute left-2 top-full -bottom-6 w-0.5 bg-[var(--composer-graph-tail-color)] transition" />
          </>
        ) : null}
        <span className="absolute left-px top-12 size-4 -translate-y-1/2 rounded-full border-4 border-border bg-background transition" />
        <span className="absolute left-[17px] top-12 h-0.5 w-[15px] -translate-y-1/2 bg-border transition" />

        {requiresLogin ? (
          <div className="rounded-md border bg-background p-4">
            <div className="mb-2 flex items-center gap-3 text-2xl font-medium leading-9">
              <Image
                src="/logo.png"
                alt="로그인 필요 프로필"
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-full border object-cover"
              />
              <span>로그인 필요</span>
            </div>
            <button
              type="button"
              onClick={() => window.alert("로그인 후 이용 가능합니다.")}
              className="min-h-7 w-full bg-transparent text-left text-base leading-7 text-muted-foreground outline-none"
            >
              {placeholder}
            </button>
          </div>
        ) : (
          <CommentForm
            postId={postId}
            placeholder={placeholder}
            submitLabel={submitLabel}
            variant="answer"
            showSecretOption={showSecretOption}
            showHiddenOption
            framed={false}
            controlsPlacement="below-card"
            simpleEditor
            cardHeader={
              <div className="flex items-center gap-3 text-2xl font-medium leading-9">
                <Link
                  href="/mypage"
                  className="inline-flex min-w-0 items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label="마이페이지로 이동"
                >
                  <Image
                    src={currentUserImage ?? "/logo.png"}
                    alt={`${currentUserName ?? "사용자"} 프로필`}
                    width={36}
                    height={36}
                    className={`h-9 w-9 shrink-0 rounded-full border object-cover ${!currentUserImage ? "grayscale" : ""}`}
                  />
                  <span className="truncate">
                    {currentUserName ?? "사용자"}
                  </span>
                </Link>
                {currentUserRole === "ADMIN" ? (
                  <Crown
                    aria-label="관리자"
                    className="h-5 w-5 shrink-0 fill-amber-300 text-amber-500"
                  />
                ) : null}
              </div>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("mt-4", className)}>
      <button
        type="button"
        onClick={() => {
          if (requiresLogin) {
            window.alert("로그인 후 이용 가능합니다.");
            return;
          }

          setIsOpen((current) => !current);
        }}
        className={cn(
          "group flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground",
          isGraphCard ? "relative w-full pl-8" : "gap-2",
          align === "center" ? "mx-auto" : "mr-auto",
        )}
        aria-expanded={isOpen}
      >
        {isGraphCard ? (
          <>
            {showGraphTail ? (
              <span className="absolute left-2 top-1/2 -bottom-16 w-0.5 bg-zinc-500 transition group-hover:bg-zinc-600 dark:bg-zinc-400 dark:group-hover:bg-zinc-300" />
            ) : null}
            <span className="absolute left-px top-1/2 size-4 -translate-y-1/2 rounded-full border-4 border-zinc-500 bg-background transition group-hover:border-zinc-600 dark:border-zinc-400 dark:group-hover:border-zinc-300" />
            <span className="absolute left-[17px] top-1/2 h-0.5 w-[15px] -translate-y-1/2 bg-zinc-500 transition group-hover:bg-zinc-600 dark:bg-zinc-400 dark:group-hover:bg-zinc-300" />
          </>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background transition hover:border-primary/30 hover:bg-primary/10">
            <Plus
              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-45" : ""}`}
              aria-hidden="true"
            />
          </span>
        )}
        {isGraphCard ? (
          <span className="w-full rounded-md border border-border bg-background px-4 py-3 transition group-hover:border-muted-foreground/50">
            {buttonLabel}
          </span>
        ) : (
          <span>{buttonLabel}</span>
        )}
      </button>

      {isOpen ? (
        <div className={cn("mt-3", isGraphCard ? "pl-8" : "")}>
          <CommentForm
            postId={postId}
            placeholder={placeholder}
            submitLabel={submitLabel}
            variant="answer"
            showSecretOption={showSecretOption}
          />
        </div>
      ) : null}
    </div>
  );
}
