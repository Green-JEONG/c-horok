import { PenSquare } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import PostEditor from "@/components/posts/PostEditor";

export const metadata: Metadata = {
  title: "New Post | c.horok",
  description: "글 작성 페이지",
};

export default function HorokTechWritePostPage() {
  return (
    <main className="w-full">
      <div className="mb-6 flex items-center gap-2">
        <PenSquare className="h-[18px] w-[18px]" />
        <h1 className="text-lg font-bold tracking-tight">글 작성</h1>
      </div>
      <Suspense
        fallback={
          <div className="text-sm text-muted-foreground">에디터 로딩 중...</div>
        }
      >
        <PostEditor />
      </Suspense>
    </main>
  );
}
