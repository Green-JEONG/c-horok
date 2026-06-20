"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import OrangeScrollArea from "@/components/common/OrangeScrollArea";
import MyPageHeaderControls, {
  type MyPageControlOption,
} from "@/components/mypage/MyPageHeaderControls";
import MyPageHeadingActionsPortal from "@/components/mypage/MyPageHeadingActionsPortal";
import {
  countSyncedPostDrafts,
  getLogPostDraftStorageKey,
} from "@/lib/post-drafts";
import MyAdminAnswersSection from "./sections/MyAdminAnswersSection";
import MyAdminPostsSection from "./sections/MyAdminPostsSection";
import MyCommentsSection from "./sections/MyCommentsSection";
import MyFriendsSection from "./sections/MyFriendsSection";
import MyPostsSection from "./sections/MyPostsSection";
import MyQnaSection from "./sections/MyQnaSection";

type MyPageTab =
  | "posts"
  | "comments"
  | "following"
  | "followers"
  | "qna"
  | "adminNotices"
  | "adminFaqs"
  | "adminAnswers";

type MyPageStats = {
  posts: number;
  comments: number;
  following: number;
  followers: number;
  qna: number;
  adminNotices: number;
  adminFaqs: number;
  adminAnswers: number;
};

const TAB_ITEMS: {
  key: MyPageTab;
  label: string;
  countKey: keyof MyPageStats;
}[] = [
  { key: "posts", label: "내 글", countKey: "posts" },
  { key: "comments", label: "내 댓글", countKey: "comments" },
  { key: "following", label: "팔로잉", countKey: "following" },
  { key: "followers", label: "팔로워", countKey: "followers" },
  { key: "qna", label: "내 질문", countKey: "qna" },
];
const ADMIN_TAB_ITEMS: {
  key: MyPageTab;
  label: string;
  countKey: keyof MyPageStats;
}[] = [
  { key: "adminNotices", label: "내 공지", countKey: "adminNotices" },
  { key: "adminFaqs", label: "내 FAQ", countKey: "adminFaqs" },
  { key: "adminAnswers", label: "내 답변", countKey: "adminAnswers" },
];

const DEFAULT_STATS: MyPageStats = {
  posts: 0,
  comments: 0,
  following: 0,
  followers: 0,
  qna: 0,
  adminNotices: 0,
  adminFaqs: 0,
  adminAnswers: 0,
};

const POST_SEARCH_TARGETS: MyPageControlOption[] = [
  { value: "text", label: "제목 및 본문" },
  { value: "category", label: "카테고리" },
];
const TEXT_SEARCH_TARGETS: MyPageControlOption[] = [
  { value: "text", label: "내용" },
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
const DATE_SORT_OPTIONS: MyPageControlOption[] = [
  { value: "latest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
];
const USER_SORT_OPTIONS: MyPageControlOption[] = [
  { value: "latest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
  { value: "nameAsc", label: "이름순" },
  { value: "followers", label: "팔로워순" },
  { value: "posts", label: "글 많은순" },
];

function getControlConfig(tab: MyPageTab) {
  if (tab === "comments" || tab === "adminAnswers") {
    return {
      searchTargets: TEXT_SEARCH_TARGETS,
      sortOptions: DATE_SORT_OPTIONS,
    };
  }

  if (tab === "following" || tab === "followers") {
    return {
      searchTargets: USER_SEARCH_TARGETS,
      sortOptions: USER_SORT_OPTIONS,
    };
  }

  return {
    searchTargets: POST_SEARCH_TARGETS,
    sortOptions: POST_SORT_OPTIONS,
  };
}

function getActiveTab(
  tab: string | null,
  friendType: string | null,
  isAdmin: boolean,
): MyPageTab {
  if (tab === "friends") {
    return friendType === "followers" ? "followers" : "following";
  }

  const availableTabs = isAdmin
    ? [...TAB_ITEMS, ...ADMIN_TAB_ITEMS]
    : TAB_ITEMS;

  return availableTabs.some((item) => item.key === tab)
    ? (tab as MyPageTab)
    : "posts";
}

export default function MyPageSection() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user?.email);
  const isAdmin = session?.user?.role === "ADMIN";
  const router = useRouter();
  const activeTab = getActiveTab(
    searchParams.get("tab"),
    searchParams.get("friendType"),
    isAdmin,
  );
  const isCategoryView = Boolean(searchParams.get("category")?.trim());
  const [stats, setStats] = useState<MyPageStats>(DEFAULT_STATS);

  useEffect(() => {
    if (isCategoryView) {
      return;
    }

    const loadStats = async () => {
      try {
        const response = await fetch("/api/mypage/stats?platform=log");
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const draftCount = isLoggedIn
          ? await countSyncedPostDrafts(getLogPostDraftStorageKey())
          : 0;
        setStats({
          posts: (typeof data.posts === "number" ? data.posts : 0) + draftCount,
          comments: typeof data.comments === "number" ? data.comments : 0,
          following: typeof data.following === "number" ? data.following : 0,
          followers: typeof data.followers === "number" ? data.followers : 0,
          qna: typeof data.qna === "number" ? data.qna : 0,
          adminNotices:
            typeof data.adminNotices === "number" ? data.adminNotices : 0,
          adminFaqs: typeof data.adminFaqs === "number" ? data.adminFaqs : 0,
          adminAnswers:
            typeof data.adminAnswers === "number" ? data.adminAnswers : 0,
        });
      } catch (error) {
        console.error("마이페이지 카운트 로드 실패", error);
      }
    };

    void loadStats();
  }, [isCategoryView, isLoggedIn]);

  useEffect(() => {
    const handleFriendCountChange = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { listKey?: unknown; delta?: unknown }
        | undefined;
      const listKey = detail?.listKey;
      const delta = typeof detail?.delta === "number" ? detail.delta : 0;

      if ((listKey !== "followers" && listKey !== "following") || delta === 0) {
        return;
      }

      setStats((current) => ({
        ...current,
        [listKey]: Math.max(0, current[listKey] + delta),
      }));
    };

    window.addEventListener(
      "mypage-friend-count-change",
      handleFriendCountChange,
    );

    return () => {
      window.removeEventListener(
        "mypage-friend-count-change",
        handleFriendCountChange,
      );
    };
  }, []);

  const selectTab = (tab: MyPageTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    params.delete("postId");
    params.delete("qnaPostId");
    params.delete("commentId");
    params.delete("friendId");
    params.delete("friendType");
    if (tab === "following" || tab === "followers") {
      params.set("friendType", tab);
    }
    router.push(`/mypage?${params.toString()}`);
  };

  if (isCategoryView) {
    return <MyPostsSection />;
  }

  const visibleTabs = isAdmin ? [...TAB_ITEMS, ...ADMIN_TAB_ITEMS] : TAB_ITEMS;
  const controlConfig = getControlConfig(activeTab);
  const activeSection =
    activeTab === "posts" ? (
      <MyPostsSection />
    ) : activeTab === "comments" ? (
      <MyCommentsSection />
    ) : activeTab === "following" ? (
      <MyFriendsSection listType="following" />
    ) : activeTab === "followers" ? (
      <MyFriendsSection listType="followers" />
    ) : activeTab === "adminNotices" ? (
      <MyAdminPostsSection
        category="공지"
        title="내 공지"
        emptyMessage="작성한 공지가 없습니다."
      />
    ) : activeTab === "adminFaqs" ? (
      <MyAdminPostsSection
        category="FAQ"
        title="내 FAQ"
        emptyMessage="작성한 FAQ가 없습니다."
      />
    ) : activeTab === "adminAnswers" ? (
      <MyAdminAnswersSection />
    ) : (
      <MyQnaSection />
    );

  return (
    <section className="flex h-full min-h-0 flex-col gap-6">
      <MyPageHeadingActionsPortal>
        <MyPageHeaderControls
          searchTargets={controlConfig.searchTargets}
          sortOptions={controlConfig.sortOptions}
        />
      </MyPageHeadingActionsPortal>

      <div
        role="tablist"
        aria-label="마이페이지 카테고리"
        className="flex shrink-0 flex-wrap gap-2"
      >
        {visibleTabs.map((item) => {
          const selected = item.key === activeTab;

          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => selectTab(item.key)}
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
                ({stats[item.countKey]})
              </span>
            </button>
          );
        })}
      </div>

      <OrangeScrollArea className="h-full min-h-0" showScrollDownHint>
        {activeSection}
      </OrangeScrollArea>
    </section>
  );
}
