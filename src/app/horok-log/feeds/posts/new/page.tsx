import { PenSquare } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import PostEditor from "@/components/posts/PostEditor";
import { getDbUserIdFromSession } from "@/lib/auth-db";
import { findPostById } from "@/lib/db";
import { horokLogTitle } from "@/lib/page-titles";

export const metadata: Metadata = {
  title: horokLogTitle("글 작성"),
  description: "글 작성 페이지",
};

type Props = {
  searchParams: Promise<{ copyPostId?: string }>;
};

export default async function HorokLogWritePostPage({ searchParams }: Props) {
  const { copyPostId } = await searchParams;
  const parsedCopyPostId = Number(copyPostId ?? "");
  const dbUserId = await getDbUserIdFromSession();
  const session = await auth();
  const copiedPost =
    Number.isInteger(parsedCopyPostId) && parsedCopyPostId > 0
      ? await findPostById(parsedCopyPostId, {
          includeHiddenForUserId: dbUserId,
          includeHiddenForAdmin: session?.user?.role === "ADMIN",
        })
      : null;
  const canCopyPost = copiedPost?.can_view_secret;
  const copiedFromPost = canCopyPost
    ? {
        id: copiedPost.id,
        title: copiedPost.title,
        content: copiedPost.content,
        thumbnail: copiedPost.thumbnail,
        author_name: copiedPost.author_name,
        author_image: copiedPost.author_image,
        created_at: copiedPost.created_at,
      }
    : null;

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
        <PostEditor
          initialTitle={canCopyPost ? copiedPost.title : ""}
          initialContent={canCopyPost ? copiedPost.content : ""}
          initialCategoryName={canCopyPost ? copiedPost.category_name : ""}
          initialCategoryNames={canCopyPost ? copiedPost.category_names : []}
          initialThumbnail={canCopyPost ? copiedPost.thumbnail : null}
          initialIsSecret={canCopyPost ? copiedPost.is_secret : false}
          copiedFromPostId={canCopyPost ? copiedPost.id : null}
          copiedFromPost={copiedFromPost}
        />
      </Suspense>
    </main>
  );
}
