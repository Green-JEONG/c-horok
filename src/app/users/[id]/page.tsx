import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import ContributionGrid from "@/components/contributions/ContributionGrid";
import MyPageHeaderControls, {
  type MyPageControlOption,
} from "@/components/mypage/MyPageHeaderControls";
import MyPostList from "@/components/posts/MyPostList";
import PostListHeader from "@/components/posts/PostListHeader";
import UserFollowersSection from "@/components/users/UserFollowersSection";
import { getCategoryBySlug } from "@/lib/categories";
import { findUserById } from "@/lib/db";
import { getLogMyPagePath } from "@/lib/routes";
import { horokLogTitle } from "@/lib/page-titles";
import { prisma } from "@/lib/prisma";
import { countUserPosts } from "@/lib/queries";

export const dynamic = "force-dynamic";

const POST_SEARCH_TARGETS: MyPageControlOption[] = [
  { value: "text", label: "제목 및 본문" },
  { value: "category", label: "카테고리" },
];
const USER_SEARCH_TARGETS: MyPageControlOption[] = [
  { value: "user", label: "유저명" },
];
const POST_SORT_OPTIONS: MyPageControlOption[] = [
  { value: "latest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
  { value: "views", label: "조회순" },
  { value: "likes", label: "북마크순" },
  { value: "comments", label: "댓글순" },
  { value: "category", label: "카테고리순 (오름차)" },
  { value: "categoryDesc", label: "카테고리순 (내림차)" },
];
const USER_SORT_OPTIONS: MyPageControlOption[] = [
  { value: "latest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
  { value: "nameAsc", label: "이름순" },
  { value: "followers", label: "팔로워순" },
  { value: "posts", label: "글 많은순" },
];

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sort?: string;
    q?: string;
    searchTarget?: string;
    category?: string;
    tab?: string;
  }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    return {
      title: horokLogTitle("유저"),
    };
  }

  const user = await findUserById(id);

  return {
    title: horokLogTitle(user?.name ?? "유저"),
    description: `${user?.name ?? "유저"}의 잔디와 작성한 글`,
  };
}

export default async function UserPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { sort, q, searchTarget, category, tab } = await searchParams;

  if (!/^\d+$/.test(id)) {
    notFound();
  }

  const session = await auth();
  const viewerUserId =
    typeof session?.user?.id === "string" ? Number(session.user.id) : null;

  if (viewerUserId === Number(id)) {
    redirect(getLogMyPagePath());
  }

  const user = await findUserById(id);

  if (!user) {
    notFound();
  }

  const activeTab =
    tab === "following" || tab === "followers" ? "following" : "posts";
  const [postCount, followingCount, selectedCategory] = await Promise.all([
    countUserPosts(Number(id), {
      viewerUserId:
        typeof viewerUserId === "number" && !Number.isNaN(viewerUserId)
          ? viewerUserId
          : null,
      query: activeTab === "posts" ? q : undefined,
      searchTarget: searchTarget === "category" ? "category" : "text",
      categorySlug: category,
    }),
    prisma.friend.count({
      where: {
        userId: BigInt(id),
      },
    }),
    category?.trim() ? getCategoryBySlug(category.trim()) : null,
  ]);
  const displayName = user.name ?? "이 유저";
  const tabItems = [
    {
      key: "posts",
      label: "작성한 글",
      count: postCount,
      href: `/users/${id}?tab=posts`,
    },
    {
      key: "following",
      label: "팔로잉",
      count: followingCount,
      href: `/users/${id}?tab=following`,
    },
  ] as const;

  return (
    <div className="space-y-6">
      {selectedCategory ? (
        <h1 className="inline-flex min-w-0 items-center gap-1 text-lg font-semibold">
          <span className="truncate">{displayName}님의 홈</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="shrink-0">카테고리</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{selectedCategory.name}</span>
        </h1>
      ) : (
        <h1 className="text-lg font-semibold">{displayName}님의 홈</h1>
      )}
      {selectedCategory ? null : <ContributionGrid userId={Number(id)} />}
      {selectedCategory ? null : (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label={`${displayName}님의 홈 카테고리`}
            className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
          >
            {tabItems.map((item) => {
              const selected = item.key === activeTab;

              return (
                <Link
                  key={item.key}
                  role="tab"
                  aria-selected={selected}
                  href={item.href}
                  className={`flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={
                      selected
                        ? "text-primary-foreground/80"
                        : "text-muted-foreground"
                    }
                  >
                    ({item.count})
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
            <MyPageHeaderControls
              searchTargets={
                activeTab === "following"
                  ? USER_SEARCH_TARGETS
                  : POST_SEARCH_TARGETS
              }
              sortOptions={
                activeTab === "following"
                  ? USER_SORT_OPTIONS
                  : POST_SORT_OPTIONS
              }
            />
          </div>
        </div>
      )}
      {selectedCategory || activeTab === "posts" ? (
        <section id="user-posts" className="scroll-mt-24 space-y-4">
          {selectedCategory ? (
            <PostListHeader
              title="게시물"
              showWriteButton={false}
              titleAction={
                <span className="text-sm font-medium text-muted-foreground">
                  {postCount}
                </span>
              }
            />
          ) : null}
          <MyPostList
            sort={sort}
            query={activeTab === "posts" ? q : undefined}
            searchTarget={searchTarget}
            categorySlug={category}
            userId={Number(id)}
            infiniteEndpoint={`/api/users/${id}/posts`}
            emptyMessage="아직 작성한 게시글이 없습니다."
          />
        </section>
      ) : (
        <UserFollowersSection
          userId={Number(id)}
          initialCount={followingCount}
          query={q}
          sort={sort}
        />
      )}
    </div>
  );
}
