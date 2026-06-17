import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import OrangeScrollArea from "@/components/common/OrangeScrollArea";
import LikedPostList from "@/components/posts/LikedPostList";
import PostListHeader from "@/components/posts/PostListHeader";
import { getUserIdByEmail } from "@/lib/db";
import { parsePostSearchTarget } from "@/lib/post-search-target";
import { countLikedPosts } from "@/lib/queries";
import { horokLogTitle } from "@/lib/page-titles";

export const metadata: Metadata = {
  title: horokLogTitle("북마크"),
  description: "북마크 페이지",
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: "/horok-log/likes",
  },
};

export default async function HorokLogLikesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; searchTarget?: string }>;
}) {
  const session = await auth();
  const { q, sort, searchTarget } = await searchParams;
  const parsedSearchTarget = parsePostSearchTarget(searchTarget);
  const userId = session?.user?.email
    ? await getUserIdByEmail(session.user.email)
    : null;
  const likedCount = userId
    ? await countLikedPosts(userId, q, parsedSearchTarget)
    : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="shrink-0">
        <Suspense
          fallback={<div className="h-6 w-32 rounded bg-muted animate-pulse" />}
        >
          <PostListHeader
            titleAction={
              <span className="text-sm font-medium text-muted-foreground">
                {likedCount}
              </span>
            }
            searchPlaceholder="북마크한 글 검색"
            searchTargetParam="searchTarget"
          />
        </Suspense>
      </div>

      <OrangeScrollArea className="min-h-0 flex-1 pr-3">
        <LikedPostList
          query={q}
          searchTarget={parsedSearchTarget}
          sort={sort}
        />
      </OrangeScrollArea>
    </div>
  );
}
