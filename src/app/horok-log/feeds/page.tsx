import type { Metadata } from "next";
import { Suspense } from "react";
import OrangeScrollArea from "@/components/common/OrangeScrollArea";
import PostList from "@/components/posts/PostList";
import PostListHeader from "@/components/posts/PostListHeader";
import { countFeedPosts } from "@/lib/db";
import { horokLogTitle } from "@/lib/page-titles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: horokLogTitle("피드"),
  description: "피드 페이지",
  alternates: {
    canonical: "/horok-log/feeds",
  },
};

export default async function HorokLogFeedsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const postCount = await countFeedPosts();

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
      <div className="shrink-0">
        <Suspense
          fallback={<div className="h-6 w-32 rounded bg-muted animate-pulse" />}
        >
          <PostListHeader
            titleAction={
              <span className="text-sm font-medium text-muted-foreground">
                {postCount}
              </span>
            }
          />
        </Suspense>
      </div>
      <OrangeScrollArea className="min-h-0 flex-1" showScrollDownHint>
        <PostList sort={sort} />
      </OrangeScrollArea>
    </div>
  );
}
