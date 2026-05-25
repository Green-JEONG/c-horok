"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  getPostDraftStorageKey,
  loadSyncedPostDrafts,
} from "@/lib/post-drafts";
import { getTechFeedNewPostPath } from "@/lib/routes";
import PostCard from "./PostCard";

type PreviewPost = {
  id: number;
  title: string;
  content: string;
  thumbnail: string | null;
  created_at: Date | string;
  author_name: string;
  author_image?: string | null;
  category_name: string;
  view_count?: number;
  likes_count: number;
  reactions_count?: number;
  comments_count: number;
  is_hidden: boolean;
  is_secret?: boolean;
  can_view_secret?: boolean;
};

type DraftPreviewPost = PreviewPost & {
  is_draft?: boolean;
  href_override?: string;
};

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

export default function MyPostPreviewGrid({
  posts,
  limit,
}: {
  posts: PreviewPost[];
  limit: number;
}) {
  const { data: session } = useSession();
  const [mergedPosts, setMergedPosts] = useState<DraftPreviewPost[]>(posts);

  useEffect(() => {
    const draftStorageKey = getPostDraftStorageKey({
      successPathPrefix: "/horok-tech/feeds/posts",
      fixedTagOptions: [],
      categoryLocked: false,
    });
    let cancelled = false;

    const loadDrafts = async () => {
      const draftPosts = (await loadSyncedPostDrafts(draftStorageKey)).map(
        (draft, index) => ({
          id: -1 - index,
          title: draft.title.trim() || "임시저장된 글",
          content: draft.content.trim() || "임시 저장된 글입니다.",
          thumbnail: draft.thumbnailUrl ?? null,
          created_at: draft.savedAt,
          author_name: session?.user?.name ?? "Unknown",
          author_image: session?.user?.image ?? null,
          category_name: "임시저장",
          view_count: 0,
          likes_count: 0,
          reactions_count: 0,
          comments_count: 0,
          is_hidden: false,
          is_draft: true,
          href_override: `${getTechFeedNewPostPath()}?draftId=${encodeURIComponent(
            draft.id ?? "",
          )}`,
        }),
      ) satisfies DraftPreviewPost[];

      if (cancelled) {
        return;
      }

      setMergedPosts(
        draftPosts.length > 0
          ? [...draftPosts, ...posts].slice(0, limit)
          : posts.slice(0, limit),
      );
    };

    void loadDrafts();

    return () => {
      cancelled = true;
    };
  }, [limit, posts, session?.user?.image, session?.user?.name]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {mergedPosts.map((post, index) => (
        <div key={post.id} className={getPreviewVisibilityClassName(index)}>
          <PostCard
            id={post.id}
            title={post.title}
            description={post.content}
            thumbnail={post.thumbnail}
            category={post.category_name}
            author={post.author_name}
            authorImage={post.author_image}
            likes={post.likes_count}
            reactions={post.reactions_count ?? 0}
            comments={post.comments_count}
            views={post.view_count}
            createdAt={new Date(post.created_at)}
            thumbnailLoading={index < 6 ? "eager" : "lazy"}
            isHidden={post.is_hidden}
            isSecret={post.is_secret}
            isDraft={post.is_draft}
            canViewSecret={post.can_view_secret}
            hrefOverride={post.href_override}
            showCategoryBadge={!post.is_draft}
          />
        </div>
      ))}
    </div>
  );
}
