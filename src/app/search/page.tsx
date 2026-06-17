import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import PostListHeader from "@/components/posts/PostListHeader";
import PostListInfinite from "@/components/posts/PostListInfinite";
import SearchResultsTabs from "@/components/search/SearchResultsTabs";
import {
  POST_SEARCH_TARGET_LABEL,
  parseGlobalPostSearchTarget,
} from "@/lib/post-search-target";
import { parseSortType } from "@/lib/post-sort";
import {
  countSearchPostsByPreviewGroup,
  countUsersByName,
  getPostsByCategorySlug,
  type SearchPostGroup,
  searchPosts,
  searchUsersByName,
} from "@/lib/queries";
import { parseUserSearchSort } from "@/lib/user-search-sort";
import { horokLogTitle } from "@/lib/page-titles";

export const metadata: Metadata = {
  title: horokLogTitle("검색"),
  description: "게시글 검색 결과 페이지",
  robots: {
    index: false,
    follow: true,
  },
};

type Props = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    searchTarget?: string;
    userSort?: string;
  }>;
};

export default async function SearchPage({ searchParams }: Props) {
  const { q, category, sort, searchTarget, userSort } = await searchParams;
  const categorySlug = category?.trim();
  const keyword = q?.trim();
  const parsedSort = parseSortType(sort);
  const parsedSearchTarget = parseGlobalPostSearchTarget(searchTarget);
  const parsedUserSort = parseUserSearchSort(userSort);
  const session = await auth();
  const viewerUserId =
    typeof session?.user?.id === "string" ? Number(session.user.id) : null;

  if (!keyword && !categorySlug) {
    return (
      <p className="text-sm text-muted-foreground">검색어를 입력해주세요.</p>
    );
  }

  if (categorySlug) {
    const { categoryName, posts } = await getPostsByCategorySlug(
      categorySlug,
      12,
      0,
      parsedSort,
      {
        viewerUserId:
          typeof viewerUserId === "number" && !Number.isNaN(viewerUserId)
            ? viewerUserId
            : null,
        isAdmin: session?.user?.role === "ADMIN",
      },
    );

    if (!categoryName) {
      return (
        <p className="text-sm text-muted-foreground">
          선택한 카테고리를 찾을 수 없습니다.
        </p>
      );
    }

    if (posts.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          “#{categoryName}”에 대한 게시글이 없습니다.
        </p>
      );
    }

    return (
      <div className="space-y-4">
        <PostListHeader
          title="홈"
          titleAction={
            <span className="inline-flex min-w-0 items-center gap-1 text-lg font-bold tracking-tight text-foreground">
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="shrink-0">카테고리</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{categoryName}</span>
            </span>
          }
          showWriteButton={false}
        />

        <PostListInfinite
          initialPosts={posts}
          endpoint={`/api/categories/${categorySlug}/posts`}
          initialSort={parsedSort}
          responseKey="posts"
          syncSortWithSearchParams
          gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          emptyMessage={`“#${categoryName}”에 대한 게시글이 없습니다.`}
        />
      </div>
    );
  }

  const viewerOptions = {
    viewerUserId:
      typeof viewerUserId === "number" && !Number.isNaN(viewerUserId)
        ? viewerUserId
        : null,
    isAdmin: session?.user?.role === "ADMIN",
    searchTarget: parsedSearchTarget,
  };
  const searchPostGroups = {
    posts: "posts",
    notice: "notice",
    faq: "faq",
    qna: "qna",
  } as const satisfies Record<string, SearchPostGroup>;

  const [
    users,
    userCount,
    postCounts,
    postResults,
    noticeResults,
    faqResults,
    qnaResults,
  ] = await Promise.all([
    parsedSearchTarget === "all" || parsedSearchTarget === "author"
      ? searchUsersByName(keyword ?? "", 12, parsedUserSort, viewerUserId)
      : [],
    parsedSearchTarget === "all" || parsedSearchTarget === "author"
      ? countUsersByName(keyword ?? "")
      : 0,
    countSearchPostsByPreviewGroup(keyword ?? "", {
      searchTarget: parsedSearchTarget,
    }),
    searchPosts(keyword ?? "", 12, 0, parsedSort, {
      ...viewerOptions,
      includeNotices: true,
      postGroup: searchPostGroups.posts,
    }),
    searchPosts(keyword ?? "", 12, 0, parsedSort, {
      ...viewerOptions,
      includeNotices: true,
      postGroup: searchPostGroups.notice,
    }),
    searchPosts(keyword ?? "", 12, 0, parsedSort, {
      ...viewerOptions,
      includeNotices: true,
      postGroup: searchPostGroups.faq,
    }),
    searchPosts(keyword ?? "", 12, 0, parsedSort, {
      ...viewerOptions,
      includeNotices: true,
      postGroup: searchPostGroups.qna,
    }),
  ]);

  const totalPostCount =
    postCounts.posts + postCounts.notice + postCounts.faq + postCounts.qna;
  const hasResults = userCount > 0 || totalPostCount > 0;
  const totalResultCount = userCount + totalPostCount;

  return (
    <div className="space-y-8">
      <PostListHeader
        title="검색"
        titleAction={
          <span className="inline-flex min-w-0 items-center gap-1 text-lg font-bold tracking-tight text-foreground">
            {parsedSearchTarget === "all" ? null : (
              <>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="shrink-0">
                  {POST_SEARCH_TARGET_LABEL[parsedSearchTarget]}
                </span>
              </>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{keyword}</span>
            <span className="ml-1 shrink-0 text-sm font-medium text-muted-foreground">
              {totalResultCount}
            </span>
          </span>
        }
        showWriteButton={false}
        showSortButton={false}
      />

      {!hasResults ? (
        <p className="text-sm text-muted-foreground">
          “{keyword}”에 대한 검색 결과가 없습니다.
        </p>
      ) : null}

      {hasResults ? (
        <SearchResultsTabs
          keyword={keyword ?? ""}
          searchTarget={parsedSearchTarget}
          users={users}
          postGroups={{
            posts: postResults,
            notice: noticeResults,
            faq: faqResults,
            qna: qnaResults,
          }}
          counts={{
            users: userCount,
            posts: postCounts.posts,
            notice: postCounts.notice,
            faq: postCounts.faq,
            qna: postCounts.qna,
          }}
          initialSort={parsedSort}
        />
      ) : null}
    </div>
  );
}
