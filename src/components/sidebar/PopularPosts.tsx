"use client";

import { ChevronLeft, ChevronRight, History } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  RECENT_POSTS_STORAGE_KEY,
  RECENT_POSTS_UPDATED_EVENT,
  type RecentPost,
} from "@/components/posts/PostViewTracker";
import { getLogFeedPostPath, isLogMyPagePath } from "@/lib/routes";

type PopularPost = {
  id: number;
  title: string;
  viewCount: number;
};

type SidebarPostView = "popular" | "recent";

function readRecentPosts() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(RECENT_POSTS_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const posts = JSON.parse(stored) as RecentPost[];
    return Array.isArray(posts)
      ? posts
          .sort(
            (a, b) =>
              new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime(),
          )
          .slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

export default function PopularPosts() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [posts, setPosts] = useState<PopularPost[]>([]);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [view, setView] = useState<SidebarPostView>("popular");
  const isRecentView = view === "recent";

  useEffect(() => {
    const userPageMatch = pathname.match(/^\/users\/(\d+)$/);
    const currentUserId = session?.user?.id;
    const endpoint = userPageMatch
      ? `/api/posts/popular?userId=${userPageMatch[1]}`
      : isLogMyPagePath(pathname) && currentUserId
        ? `/api/posts/popular?userId=${currentUserId}`
        : "/api/posts/popular";

    fetch(endpoint)
      .then((res) => res.json())
      .then(setPosts);
  }, [pathname, session?.user?.id]);

  useEffect(() => {
    function syncRecentPosts() {
      setRecentPosts(readRecentPosts());
    }

    syncRecentPosts();
    window.addEventListener("storage", syncRecentPosts);
    window.addEventListener(RECENT_POSTS_UPDATED_EVENT, syncRecentPosts);

    return () => {
      window.removeEventListener("storage", syncRecentPosts);
      window.removeEventListener(RECENT_POSTS_UPDATED_EVENT, syncRecentPosts);
    };
  }, []);

  const visiblePosts = isRecentView ? recentPosts : posts;
  const emptyMessage = isRecentView
    ? "아직 최근 본 글이 없습니다."
    : "아직 인기 글이 없습니다.";

  function switchView() {
    setView((currentView) =>
      currentView === "popular" ? "recent" : "popular",
    );
  }

  return (
    <section className="-mx-6 px-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {isRecentView ? (
            <History className="h-[18px] w-[18px] text-muted-foreground" />
          ) : (
            <Image
              src="/fire.svg"
              alt="thumb"
              width={18}
              height={18}
              style={{ width: "auto", height: "auto" }}
            />
          )}
          <h3 className="truncate text-lg font-bold tracking-tight">
            {isRecentView ? "최근 본 글" : "인기"}
          </h3>
        </div>
        <div className="inline-flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={switchView}
            className="rounded-full border border-border bg-background p-1 text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
            aria-label="이전 사이드바 글 목록"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={switchView}
            className="rounded-full border border-border bg-background p-1 text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
            aria-label="다음 사이드바 글 목록"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {visiblePosts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {visiblePosts.map((post, index) => (
            <li key={post.id}>
              <Link
                href={"href" in post ? post.href : getLogFeedPostPath(post.id)}
                className="flex items-start gap-1 overflow-hidden text-muted-foreground hover:text-foreground"
              >
                <span className="min-w-4 text-sm font-semibold tabular-nums text-foreground/80">
                  {index + 1}
                </span>
                <span className="block truncate">{post.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
