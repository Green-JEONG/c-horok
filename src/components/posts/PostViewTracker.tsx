"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type Props = {
  postId: number;
  title?: string;
  href?: string;
};

const RECENT_POSTS_STORAGE_KEY = "horok-log-recent-posts";
const RECENT_POSTS_UPDATED_EVENT = "horok-log-recent-posts-updated";
const MAX_RECENT_POSTS = 10;

export type RecentPost = {
  id: number;
  title: string;
  href: string;
  viewedAt: string;
};

export { RECENT_POSTS_STORAGE_KEY, RECENT_POSTS_UPDATED_EVENT };

export default function PostViewTracker({ postId, title, href }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    void fetch(`/api/posts/${postId}/view`, {
      method: "POST",
    });
  }, [postId]);

  useEffect(() => {
    if (!title?.trim() || typeof window === "undefined") {
      return;
    }

    const nextPost: RecentPost = {
      id: postId,
      title: title.trim(),
      href: href ?? pathname,
      viewedAt: new Date().toISOString(),
    };

    try {
      const stored = window.localStorage.getItem(RECENT_POSTS_STORAGE_KEY);
      const currentPosts = stored ? (JSON.parse(stored) as RecentPost[]) : [];
      const nextPosts = [
        nextPost,
        ...currentPosts.filter((post) => post.id !== postId),
      ]
        .sort(
          (a, b) =>
            new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime(),
        )
        .slice(0, MAX_RECENT_POSTS);

      window.localStorage.setItem(
        RECENT_POSTS_STORAGE_KEY,
        JSON.stringify(nextPosts),
      );
      window.dispatchEvent(new Event(RECENT_POSTS_UPDATED_EVENT));
    } catch {
      window.localStorage.setItem(
        RECENT_POSTS_STORAGE_KEY,
        JSON.stringify([nextPost]),
      );
      window.dispatchEvent(new Event(RECENT_POSTS_UPDATED_EVENT));
    }
  }, [href, pathname, postId, title]);

  return null;
}
