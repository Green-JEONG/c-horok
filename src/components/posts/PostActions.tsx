"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import PostEditor from "@/components/posts/PostEditor";
import PostHeader from "@/components/posts/PostHeader";
import type { DbCopiedPost, DbPost, DbPostSeriesItem } from "@/lib/db";
import {
  getStorageObjectPathFromPublicUrl,
  POST_THUMBNAIL_BUCKET,
} from "@/lib/post-thumbnails";
import { supabase } from "@/lib/supabase";

type Props = {
  postId: number;
  initialTitle: string;
  initialContent: string;
  initialCategoryName: string;
  initialCategoryNames?: string[];
  initialThumbnail: string | null;
  initialIsHidden: boolean;
  initialIsSecret?: boolean;
  initialIsBanner?: boolean;
  initialCopiedFromPost?: DbCopiedPost | null;
  seriesItems?: DbPostSeriesItem[];
  isOwner: boolean;
  headerPost?: DbPost;
  headerTitleAddon?: ReactNode;
  redirectPath?: string;
  categoryLocked?: boolean;
  fixedTagOptions?: string[];
  inquiryTagOptions?: string[];
  showBannerOption?: boolean;
  allowNoticeBannerForAllCategories?: boolean;
  children?: ReactNode;
};

export default function PostActions({
  postId,
  initialTitle,
  initialContent,
  initialCategoryName,
  initialCategoryNames,
  initialThumbnail,
  initialIsHidden,
  initialIsSecret = false,
  initialIsBanner = false,
  initialCopiedFromPost = null,
  seriesItems = [],
  isOwner,
  headerPost,
  headerTitleAddon,
  redirectPath = "/horok-log/feeds",
  categoryLocked = false,
  fixedTagOptions,
  inquiryTagOptions,
  showBannerOption = true,
  allowNoticeBannerForAllCategories = false,
  children,
}: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHidden, setIsHidden] = useState(initialIsHidden);
  const [isTogglingHidden, setIsTogglingHidden] = useState(false);

  async function removeThumbnailFromStorage(path?: string | null) {
    if (!path) return;
    await supabase.storage.from(POST_THUMBNAIL_BUCKET).remove([path]);
  }

  async function handleDelete() {
    const confirmed = window.confirm("이 게시글을 삭제할까요?");
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? "게시글 삭제에 실패했습니다.");
        return;
      }

      const storagePath = getStorageObjectPathFromPublicUrl(initialThumbnail);
      if (storagePath) {
        await removeThumbnailFromStorage(storagePath);
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError("게시글 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleToggleHidden() {
    const nextHidden = !isHidden;
    const confirmed = window.confirm(
      nextHidden
        ? "이 게시글을 숨김 처리할까요? 숨김 처리하면 다른 사용자는 볼 수 없습니다."
        : "이 게시글을 다시 공개할까요?",
    );
    if (!confirmed) return;

    setIsTogglingHidden(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isHidden: nextHidden }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? "게시글 숨김 상태 변경에 실패했습니다.");
        return;
      }

      setIsHidden(nextHidden);
      router.refresh();
    } catch {
      setError("게시글 숨김 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setIsTogglingHidden(false);
    }
  }

  const actionSlot = isOwner ? (
    <div className="flex flex-wrap justify-end gap-2 text-xs">
      <button
        type="button"
        disabled={isDeleting || isTogglingHidden}
        onClick={() => {
          setIsEditing((prev) => !prev);
          setError(null);
        }}
        className="box-border inline-flex h-7 items-center justify-center rounded-md border px-3 py-1.5 leading-none transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isEditing ? "닫기" : "수정"}
      </button>

      <button
        type="button"
        disabled={isDeleting || isTogglingHidden}
        onClick={handleToggleHidden}
        className="box-border inline-flex h-7 items-center justify-center rounded-md border px-3 py-1.5 leading-none transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isTogglingHidden
          ? isHidden
            ? "공개 중..."
            : "숨김 중..."
          : isHidden
            ? "숨김 해제"
            : "숨김"}
      </button>

      <button
        type="button"
        disabled={isDeleting || isTogglingHidden}
        onClick={handleDelete}
        className="box-border inline-flex h-7 items-center justify-center rounded-md border border-red-500 bg-red-500 px-3 py-1.5 leading-none text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? "삭제 중..." : "삭제"}
      </button>
    </div>
  ) : null;

  return (
    <div className="space-y-3">
      {headerPost ? (
        <PostHeader
          post={headerPost}
          actionSlot={actionSlot}
          titleAddon={headerTitleAddon}
          seriesItems={seriesItems}
          isOwner={isOwner}
        />
      ) : null}

      {isOwner && isEditing ? (
        <div className="mb-3 rounded-xl border bg-muted/20 p-4">
          <PostEditor
            mode="edit"
            postId={postId}
            initialTitle={initialTitle}
            initialContent={initialContent}
            initialCategoryName={initialCategoryName}
            initialCategoryNames={initialCategoryNames}
            initialThumbnail={initialThumbnail}
            initialIsBanner={initialIsBanner}
            initialIsSecret={initialIsSecret}
            copiedFromPost={initialCopiedFromPost}
            categoryLocked={categoryLocked}
            fixedTagOptions={fixedTagOptions}
            inquiryTagOptions={inquiryTagOptions}
            showBannerOption={showBannerOption}
            allowNoticeBannerForAllCategories={
              allowNoticeBannerForAllCategories
            }
            onCancel={() => {
              setIsEditing(false);
              setError(null);
            }}
            onSuccess={() => {
              setIsEditing(false);
              setError(null);
            }}
          />
        </div>
      ) : (
        children
      )}

      {!isEditing && error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : null}
    </div>
  );
}
