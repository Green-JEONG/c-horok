"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import PostEditor, {
  type PostEditorHandle,
} from "@/components/posts/PostEditor";
import PostHeader from "@/components/posts/PostHeader";
import { buttonVariants } from "@/components/ui/button";
import type { DbCopiedPost, DbPost, DbPostSeriesItem } from "@/lib/db";
import type { PostThumbnailCrop } from "@/lib/post-thumbnail-crop";
import { normalizePostStorageReference } from "@/lib/post-storage";
import { removePostMedia } from "@/lib/post-storage-client";
import { cn } from "@/lib/utils";

type SavedPostFlags = {
  is_secret?: boolean;
  is_hidden?: boolean;
};

function getSavedPostFlags(payload: unknown): SavedPostFlags {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const record = payload as SavedPostFlags;

  return {
    is_secret:
      typeof record.is_secret === "boolean" ? record.is_secret : undefined,
    is_hidden:
      typeof record.is_hidden === "boolean" ? record.is_hidden : undefined,
  };
}

type Props = {
  postId: number;
  initialTitle: string;
  initialContent: string;
  initialCategoryName: string;
  initialCategoryNames?: string[];
  initialThumbnail: string | null;
  initialThumbnailCrop?: PostThumbnailCrop | null;
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
  initialThumbnailCrop = null,
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
  const editorRef = useRef<PostEditorHandle>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditorSubmitting, setIsEditorSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [savedIsSecret, setSavedIsSecret] = useState(initialIsSecret);
  const [savedIsHidden, setSavedIsHidden] = useState(initialIsHidden);

  useEffect(() => {
    setSavedIsSecret(initialIsSecret);
    setSavedIsHidden(initialIsHidden);
  }, [initialIsHidden, initialIsSecret]);

  const displayHeaderPost = headerPost
    ? {
        ...headerPost,
        is_secret: savedIsSecret,
        is_hidden: savedIsHidden,
      }
    : undefined;

  function handleEditSuccess(payload: unknown) {
    const savedFlags = getSavedPostFlags(payload);

    if (typeof savedFlags.is_secret === "boolean") {
      setSavedIsSecret(savedFlags.is_secret);
    }

    if (typeof savedFlags.is_hidden === "boolean") {
      setSavedIsHidden(savedFlags.is_hidden);
    }

    setIsEditorSubmitting(false);
    setIsEditing(false);
    setError(null);
  }

  async function removeThumbnailFromStorage(path?: string | null) {
    await removePostMedia(normalizePostStorageReference(path));
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

      const storagePath = normalizePostStorageReference(initialThumbnail);
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

  function renderActionSlot(
    secretSection?: ReactNode,
    hiddenSection?: ReactNode,
  ) {
    if (!isOwner) {
      return null;
    }

    return (
      <div className="flex flex-wrap justify-end gap-2 text-xs">
        {isEditing ? secretSection : null}
        {isEditing ? hiddenSection : null}

        {isEditing ? (
          <button
            type="button"
            disabled={isEditorSubmitting || isDeleting}
            onClick={() => editorRef.current?.submit()}
            className={cn(
              buttonVariants({ variant: "default", size: "sm" }),
              "box-border h-7 px-3 py-1.5 text-xs leading-none text-white dark:text-white",
            )}
          >
            {isEditorSubmitting ? "저장 중..." : "저장"}
          </button>
        ) : null}

        <button
          type="button"
          disabled={isDeleting || isEditorSubmitting}
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
          disabled={isDeleting}
          onClick={handleDelete}
          className="box-border inline-flex h-7 items-center justify-center rounded-md border border-red-500 bg-red-500 px-3 py-1.5 leading-none text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? "삭제 중..." : "삭제"}
        </button>
      </div>
    );
  }

  const actionSlot = renderActionSlot();

  return (
    <div className="space-y-3">
      {isOwner && isEditing ? (
        <PostEditor
          ref={editorRef}
          mode="edit"
          layout="inline"
          postId={postId}
          initialTitle={initialTitle}
          initialContent={initialContent}
          initialCategoryName={initialCategoryName}
          initialCategoryNames={initialCategoryNames}
          initialThumbnail={initialThumbnail}
          initialThumbnailCrop={initialThumbnailCrop}
          initialAttachments={headerPost?.attachments}
          initialIsBanner={initialIsBanner}
          initialIsSecret={initialIsSecret}
          initialIsHidden={initialIsHidden}
          copiedFromPost={initialCopiedFromPost}
          categoryLocked={categoryLocked}
          fixedTagOptions={fixedTagOptions}
          inquiryTagOptions={inquiryTagOptions}
          showBannerOption={showBannerOption}
          allowNoticeBannerForAllCategories={allowNoticeBannerForAllCategories}
          onSubmittingChange={setIsEditorSubmitting}
          onCancel={() => {
            setIsEditorSubmitting(false);
            setIsEditing(false);
            setError(null);
          }}
          onSuccess={handleEditSuccess}
          renderInline={({
            titleSection,
            titleStatusSection,
            titleStatusIndent,
            tagsSection,
            contentSection,
            secretSection,
            hiddenSection,
            footerExtrasSection,
            errorSection,
          }) => (
            <>
              {displayHeaderPost ? (
                <PostHeader
                  post={displayHeaderPost}
                  actionSlot={renderActionSlot(secretSection, hiddenSection)}
                  titleAddon={headerTitleAddon}
                  seriesItems={seriesItems}
                  isOwner={isOwner}
                  titleSection={titleSection}
                  titleStatusSection={titleStatusSection}
                  titleStatusIndent={titleStatusIndent}
                  tagsSection={tagsSection}
                />
              ) : null}
              {contentSection}
              {footerExtrasSection ? (
                <div className="space-y-3">{footerExtrasSection}</div>
              ) : null}
              {errorSection}
            </>
          )}
        />
      ) : (
        <>
          {displayHeaderPost ? (
            <PostHeader
              post={displayHeaderPost}
              actionSlot={actionSlot}
              titleAddon={headerTitleAddon}
              seriesItems={seriesItems}
              isOwner={isOwner}
            />
          ) : null}
          {children}
        </>
      )}

      {!isEditing && error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : null}
    </div>
  );
}
