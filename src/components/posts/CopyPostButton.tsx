"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { getLogFeedNewPostPath } from "@/lib/routes";

type Props = {
  postId: number;
  initialCount: number;
  disabled?: boolean;
};

export default function CopyPostButton({
  postId,
  initialCount,
  disabled = false,
}: Props) {
  const router = useRouter();

  function handleClick() {
    if (disabled) {
      window.alert("로그인 후 이용 가능합니다.");
      return;
    }

    router.push(`${getLogFeedNewPostPath()}?copyPostId=${postId}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-disabled={disabled}
      aria-label={`게시글 복사 ${initialCount}`}
      className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-background px-2 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
    >
      <Copy className="h-3.5 w-3.5" />
      <span className="font-semibold">{initialCount}</span>
    </button>
  );
}
