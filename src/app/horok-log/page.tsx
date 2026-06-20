import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import ContributionGrid from "@/components/contributions/ContributionGrid";
import MyPostList from "@/components/posts/MyPostList";
import PostCard from "@/components/posts/PostCard";
import PostListHeader from "@/components/posts/PostListHeader";
import { Button } from "@/components/ui/button";
import { horokLogTitle } from "@/lib/page-titles";
import { getRandomPosts } from "@/lib/queries";

export const dynamic = "force-dynamic";

function getPreviewVisibilityClassName(index: number) {
  if (index < 4) {
    return "";
  }

  if (index < 6) {
    return "hidden sm:block";
  }

  if (index < 8) {
    return "hidden lg:block";
  }

  if (index < 10) {
    return "hidden xl:block";
  }

  return "hidden";
}

function HorokLogPageFallback() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">마이홈</h1>
      <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      <div className="h-40 animate-pulse rounded-md bg-muted/60" />
    </div>
  );
}

export const metadata: Metadata = {
  title: horokLogTitle("호록 블로그"),
  description: "호록 기술 블로그 메인 페이지",
  alternates: {
    canonical: "/horok-log",
  },
};

export default function HorokLogPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  return (
    <Suspense fallback={<HorokLogPageFallback />}>
      <HorokLogPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function HorokLogPageContent({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const session = await auth();
  const viewerUserId =
    typeof session?.user?.id === "string" ? Number(session.user.id) : null;
  const randomPosts = await getRandomPosts(10, {
    viewerUserId:
      typeof viewerUserId === "number" && !Number.isNaN(viewerUserId)
        ? viewerUserId
        : null,
    isAdmin: session?.user?.role === "ADMIN",
  });

  const randomPostsSection =
    randomPosts.length > 0 ? (
      <section className="mt-15 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            추천글
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/horok-log/feeds">더보기</Link>
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {randomPosts.map((post, index) => (
            <div key={post.id} className={getPreviewVisibilityClassName(index)}>
              <PostCard
                id={post.id}
                title={post.title}
                description={post.content}
                thumbnail={post.thumbnail}
                thumbnailCrop={post.thumbnail_crop ?? null}
                category={post.category_name}
                author={post.author_name}
                authorImage={post.author_image}
                likes={post.likes_count}
                reactions={post.reactions_count}
                comments={post.comments_count}
                views={post.view_count}
                createdAt={post.created_at}
                postRouteSection="feeds"
                thumbnailLoading={index < 10 ? "eager" : "lazy"}
                thumbnailPriority={index === 0}
              />
            </div>
          ))}
        </div>
      </section>
    ) : null;

  const unauthenticatedState = (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        로그인 후 게시글을 볼 수 있습니다.
      </p>
      {randomPostsSection}
    </div>
  );
  const emptyState = (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        아직 작성한 게시글이 없습니다.
      </p>
      {randomPostsSection}
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">마이홈</h1>
      <Suspense
        fallback={<div className="h-6 w-32 animate-pulse rounded bg-muted" />}
      >
        <ContributionGrid />
        <PostListHeader
          showSortButton={false}
          titleAction={
            session?.user ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/mypage?tab=posts">더보기</Link>
              </Button>
            ) : null
          }
        />
      </Suspense>
      <MyPostList
        sort={sort}
        limit={10}
        emptyState={emptyState}
        unauthenticatedState={unauthenticatedState}
      />
    </div>
  );
}
