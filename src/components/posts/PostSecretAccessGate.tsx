"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ErrorState from "@/components/common/ErrorState";
import { Button } from "@/components/ui/button";

type PostSecretAccessGateProps = {
  postId: number;
  message: string;
  hasPassword: boolean;
};

export default function PostSecretAccessGate({
  postId,
  message,
  hasPassword,
}: PostSecretAccessGateProps) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedPassword = password.trim();

    if (!trimmedPassword) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${postId}/verify-secret`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: trimmedPassword }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? "비밀번호 확인에 실패했습니다.");
        return;
      }

      router.refresh();
    } catch {
      setError("비밀번호 확인 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!hasPassword) {
    return <ErrorState code={403} message={message} />;
  }

  return (
    <ErrorState
      code={403}
      hideDefaultAction
      message={message}
      action={
        <form
          className="flex w-full max-w-sm flex-col gap-3"
          onSubmit={handleSubmit}
        >
          <label className="sr-only" htmlFor="post-secret-access-password">
            비밀글 비밀번호
          </label>
          <input
            id="post-secret-access-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호를 입력하세요"
            autoComplete="off"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full text-white dark:text-white"
          >
            {isSubmitting ? "확인 중..." : "확인"}
          </Button>
        </form>
      }
    />
  );
}
