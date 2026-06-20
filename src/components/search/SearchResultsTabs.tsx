"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import OrangeScrollArea from "@/components/common/OrangeScrollArea";
import SectionPagination from "@/components/mypage/sections/SectionPagination";
import PostListInfinite from "@/components/posts/PostListInfinite";
import PostSortButton from "@/components/posts/PostSortButton";
import UserSearchGrid from "@/components/users/UserSearchGrid";
import UserSearchSortButton from "@/components/users/UserSearchSortButton";
import type { SortType } from "@/lib/post-sort";
import type { DbPost, DbUserSearchResult } from "@/lib/queries";

type SearchTabKey = "users" | "posts" | "notice" | "faq" | "qna";

type Props = {
  keyword: string;
  searchTarget: string;
  users: DbUserSearchResult[];
  postGroups: Record<Exclude<SearchTabKey, "users">, DbPost[]>;
  counts: Record<SearchTabKey, number>;
  initialSort: SortType;
};

const TAB_LABEL: Record<SearchTabKey, string> = {
  users: "유저",
  posts: "게시물",
  notice: "공지",
  faq: "FAQ",
  qna: "문의",
};

const POST_TAB_KEYS: Exclude<SearchTabKey, "users">[] = [
  "posts",
  "notice",
  "faq",
  "qna",
];
const TABLE_TAB_KEYS = new Set<SearchTabKey>(["notice", "faq", "qna"]);
const PAGE_SIZE = 12;

function getEndpoint(keyword: string, searchTarget: string, group: string) {
  const params = new URLSearchParams({
    q: keyword,
    group,
  });

  if (searchTarget !== "all") {
    params.set("searchTarget", searchTarget);
  }

  return `/api/search?${params.toString()}`;
}

export default function SearchResultsTabs({
  keyword,
  searchTarget,
  users,
  postGroups,
  counts,
  initialSort,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pagedPostGroups, setPagedPostGroups] = useState(postGroups);
  const [pageByGroup, setPageByGroup] = useState<
    Record<Exclude<SearchTabKey, "users">, number>
  >({
    posts: 1,
    notice: 1,
    faq: 1,
    qna: 1,
  });
  const [loadingPageGroup, setLoadingPageGroup] = useState<Exclude<
    SearchTabKey,
    "users"
  > | null>(null);
  const availableTabs = (["users", ...POST_TAB_KEYS] as SearchTabKey[]).filter(
    (key) => counts[key] > 0,
  );
  const requestedTab = searchParams.get("resultTab") as SearchTabKey | null;
  const activeTab =
    requestedTab && availableTabs.includes(requestedTab)
      ? requestedTab
      : availableTabs[0];
  const activePostGroup =
    !activeTab || activeTab === "users"
      ? null
      : (activeTab as Exclude<SearchTabKey, "users">);
  const activeTableGroup =
    activePostGroup && TABLE_TAB_KEYS.has(activePostGroup)
      ? activePostGroup
      : null;

  useEffect(() => {
    setPagedPostGroups(postGroups);
    setPageByGroup({
      posts: 1,
      notice: 1,
      faq: 1,
      qna: 1,
    });
  }, [postGroups]);

  if (!activeTab) {
    return (
      <p className="text-sm text-muted-foreground">
        “{keyword}”에 대한 검색 결과가 없습니다.
      </p>
    );
  }

  function setActiveTab(tab: SearchTabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("resultTab", tab);
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`);
  }

  const activeCount = counts[activeTab];

  async function setTablePage(
    group: Exclude<SearchTabKey, "users">,
    page: number,
  ) {
    if (page < 1 || page === pageByGroup[group]) {
      return;
    }

    setLoadingPageGroup(group);
    setPageByGroup((current) => ({ ...current, [group]: page }));

    if (page === 1) {
      setPagedPostGroups((current) => ({
        ...current,
        [group]: postGroups[group],
      }));
      setLoadingPageGroup(null);
      return;
    }

    const url = new URL(
      getEndpoint(keyword, searchTarget, group),
      window.location.origin,
    );
    const currentParams = new URLSearchParams(searchParams.toString());

    for (const [key, value] of currentParams.entries()) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("page", String(page));

    try {
      const response = await fetch(url.toString());
      const data = await response.json();
      setPagedPostGroups((current) => ({
        ...current,
        [group]: Array.isArray(data) ? (data as DbPost[]) : [],
      }));
    } finally {
      setLoadingPageGroup(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="검색 결과 카테고리"
          className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
        >
          {availableTabs.map((tab) => {
            const selected = tab === activeTab;

            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveTab(tab)}
                className={`flex h-8 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span>{TAB_LABEL[tab]}</span>
                <span
                  className={
                    selected
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground"
                  }
                >
                  ({counts[tab]})
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex justify-end">
          {activeTab === "users" ? (
            <UserSearchSortButton />
          ) : activeTab === "faq" ? (
            <PostSortButton sortOptions={["latest", "oldest", "views"]} />
          ) : (
            <PostSortButton />
          )}
        </div>
      </div>

      <OrangeScrollArea
        className="max-h-[calc(100dvh-260px)] min-h-80 sm:max-h-[calc(100dvh-220px)]"
        showScrollDownHint
      >
        {activeTab === "users" ? (
          <UserSearchGrid
            users={users}
            hideHeading
            infinite
            endpoint={`/api/search/users?q=${encodeURIComponent(keyword)}`}
            totalCount={counts.users}
          />
        ) : activePostGroup ? (
          <>
            <PostListInfinite
              key={activePostGroup}
              initialPosts={pagedPostGroups[activePostGroup]}
              endpoint={getEndpoint(keyword, searchTarget, activePostGroup)}
              initialSort={initialSort}
              syncSortWithSearchParams
              disableInfinite={Boolean(activeTableGroup)}
              noticeTableLabel={
                activePostGroup === "notice"
                  ? "공지"
                  : activePostGroup === "faq"
                    ? "FAQ"
                    : activePostGroup === "qna"
                      ? "문의"
                      : undefined
              }
              noticeTableDateWithoutWeekday
              gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              emptyMessage="검색 결과가 없습니다."
            />
            {activeTableGroup ? (
              <>
                {loadingPageGroup === activeTableGroup ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">
                    불러오는 중...
                  </p>
                ) : null}
                <SectionPagination
                  currentPage={pageByGroup[activeTableGroup]}
                  totalPages={Math.max(
                    1,
                    Math.ceil(counts[activeTableGroup] / PAGE_SIZE),
                  )}
                  onPageChange={(page) =>
                    void setTablePage(activeTableGroup, page)
                  }
                />
              </>
            ) : null}
          </>
        ) : null}

        {activeCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            선택한 카테고리에 검색 결과가 없습니다.
          </p>
        ) : null}
      </OrangeScrollArea>
    </section>
  );
}
