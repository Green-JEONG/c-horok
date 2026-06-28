"use client";

import { Eye, EyeOff, ImagePlus, Lock, LockOpen, Video } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { PostReactionSummary } from "@/lib/post-reaction-options";
import { handleMarkdownEditorKeyDown } from "@/lib/markdown-editor-keydown";
import { uploadPostMedia } from "@/lib/post-storage-client";
import { getLogMyPagePath } from "@/lib/routes";
import { formatSeoulDateTime } from "@/lib/utils";
import CommentAuthorHeader from "./CommentAuthorHeader";
import CommentForm from "./CommentForm";
import CommentReactionButton from "./CommentReactionButton";
import MarkdownRenderer from "./MarkdownRenderer";

export type CommentNode = {
  id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  is_deleted: boolean;
  is_hidden: boolean;
  is_secret: boolean;
  can_view_secret: boolean;
  is_edited: boolean;
  created_at: string;
  author: string;
  author_image: string | null;
  author_role?: "USER" | "ADMIN" | null;
  reactions: PostReactionSummary[];
  replies: CommentNode[];
};

function resizeTextareaToContent(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;

  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export default function CommentItem({
  comment,
  postId,
  currentUserId,
  currentUserName = null,
  currentUserImage = null,
  currentUserRole = null,
  isLoggedIn,
  replyButtonLabel = "대댓글 달기",
  replyPlaceholder = "대댓글을 작성하세요",
  replySubmitLabel = "대댓글 등록",
  showReplyButton = true,
  depth = 0,
  graphColor = "#f97316",
  connectFromPrevious = false,
  connectToNext = false,
}: {
  comment: CommentNode;
  postId: number;
  currentUserId: number | null;
  currentUserName?: string | null;
  currentUserImage?: string | null;
  currentUserRole?: "USER" | "ADMIN" | null;
  isLoggedIn: boolean;
  replyButtonLabel?: string;
  replyPlaceholder?: string;
  replySubmitLabel?: string;
  showReplyButton?: boolean;
  depth?: number;
  graphColor?: string;
  connectFromPrevious?: boolean;
  connectToNext?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editingImageInputRef = useRef<HTMLInputElement>(null);
  const editingVideoInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [content, setContent] = useState(comment.content);
  const [isSecret, setIsSecret] = useState(comment.is_secret);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHidden, setIsHidden] = useState(comment.is_hidden);
  const [isTogglingHidden, setIsTogglingHidden] = useState(false);
  const [isFocusedComment, setIsFocusedComment] = useState(false);
  const [isUploadingEditMedia, setIsUploadingEditMedia] = useState(false);
  const canManage = comment.user_id === currentUserId && !comment.is_deleted;
  const showSecretLock = comment.is_secret && !comment.is_deleted;
  const canReply =
    showReplyButton &&
    isLoggedIn &&
    comment.parent_id === null &&
    !comment.is_deleted &&
    (!comment.is_secret || comment.can_view_secret);
  const targetCommentId = Number(searchParams.get("commentId") ?? "");
  const canReact =
    isLoggedIn && !comment.is_deleted && comment.can_view_secret && !isEditing;
  const hasGraphChildren = isReplying || comment.replies.length > 0;
  const authorHref =
    comment.user_id === currentUserId
      ? getLogMyPagePath()
      : `/users/${comment.user_id}`;

  const replyActionButton = canReply ? (
    <button
      type="button"
      onClick={() => {
        setIsReplying(true);
        setError(null);
      }}
      className="box-border inline-flex h-7 items-center justify-center rounded-md border px-3 py-1.5 leading-none transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
    >
      {replyButtonLabel}
    </button>
  ) : null;

  const manageActionButtons = canManage ? (
    <>
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
        onClick={handleDelete}
        className="box-border inline-flex h-7 items-center justify-center rounded-md border border-red-600 px-3 py-1.5 leading-none text-red-600 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isDeleting ? "삭제 중..." : "삭제"}
      </button>
    </>
  ) : null;
  const commentActionButtons =
    replyActionButton || manageActionButtons ? (
      <div className="inline-flex shrink-0 flex-wrap justify-end gap-2 text-xs text-muted-foreground">
        {replyActionButton}
        {manageActionButtons}
      </div>
    ) : null;

  useEffect(() => {
    if (!Number.isFinite(targetCommentId) || targetCommentId !== comment.id) {
      return;
    }

    const element = document.getElementById(`comment-${comment.id}`);
    if (!element) {
      return;
    }

    setIsFocusedComment(true);

    const scrollTimeout = window.setTimeout(() => {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    const highlightTimeout = window.setTimeout(() => {
      setIsFocusedComment(false);
    }, 2600);

    return () => {
      window.clearTimeout(scrollTimeout);
      window.clearTimeout(highlightTimeout);
    };
  }, [comment.id, targetCommentId]);

  useEffect(() => {
    if (!isEditing) return;

    requestAnimationFrame(() => {
      const textarea = editingTextareaRef.current;
      if (!textarea) return;

      textarea.focus();
      const cursorPosition = textarea.value.length;
      textarea.setSelectionRange(cursorPosition, cursorPosition);
      resizeTextareaToContent(textarea);
    });
  }, [isEditing]);

  async function handleUpdate() {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError("댓글 내용을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${comment.id}/comments`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: trimmedContent, isSecret }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? "댓글 수정에 실패했습니다.");
        return;
      }

      setIsEditing(false);
      router.refresh();
    } catch {
      setError("댓글 수정 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleEditContentKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    handleMarkdownEditorKeyDown(event);
  }

  function insertEditTextAtCursor(text: string) {
    const textarea = editingTextareaRef.current;

    if (!textarea) {
      setContent((prev) => `${prev}${prev ? "\n\n" : ""}${text}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
    const suffix = after && !after.startsWith("\n") ? "\n\n" : "";
    const nextContent = `${before}${prefix}${text}${suffix}${after}`;
    const nextCursorPosition = (before + prefix + text).length;

    setContent(nextContent);

    requestAnimationFrame(() => {
      const nextTextarea = editingTextareaRef.current;
      if (!nextTextarea) return;

      nextTextarea.focus();
      nextTextarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
      resizeTextareaToContent(nextTextarea);
    });
  }

  async function handleEditImageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setIsUploadingEditMedia(true);
    setError(null);

    try {
      const markdownImages: string[] = [];

      for (const file of files) {
        const uploaded = await uploadPostMedia(file, "content");

        markdownImages.push(`![${file.name}](${uploaded.signedUrl})`);
      }

      insertEditTextAtCursor(markdownImages.join("\n\n"));
      event.target.value = "";
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "댓글 이미지 업로드 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsUploadingEditMedia(false);
    }
  }

  async function handleEditVideoChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setIsUploadingEditMedia(true);
    setError(null);

    try {
      const markdownVideos: string[] = [];

      for (const file of files) {
        const uploaded = await uploadPostMedia(file, "content");

        markdownVideos.push(`![video](${uploaded.signedUrl})`);
      }

      insertEditTextAtCursor(markdownVideos.join("\n\n"));
      event.target.value = "";
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "댓글 동영상 업로드 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsUploadingEditMedia(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm("이 댓글을 삭제할까요?");
    if (!confirmed) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${comment.id}/comments`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? "댓글 삭제에 실패했습니다.");
        return;
      }

      router.refresh();
    } catch {
      setError("댓글 삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleToggleHidden() {
    const nextHidden = !isHidden;
    const confirmed = window.confirm(
      nextHidden
        ? "이 댓글을 숨김 처리할까요? 숨김 처리하면 다른 사용자는 볼 수 없습니다."
        : "이 댓글을 다시 공개할까요?",
    );
    if (!confirmed) return;

    setIsTogglingHidden(true);
    setError(null);

    try {
      const response = await fetch(`/api/posts/${comment.id}/comments`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isHidden: nextHidden }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? "댓글 숨김 상태 변경에 실패했습니다.");
        return;
      }

      setIsHidden(nextHidden);
      router.refresh();
    } catch {
      setError("댓글 숨김 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setIsTogglingHidden(false);
    }
  }

  return (
    <div
      id={`comment-${comment.id}`}
      className="relative scroll-mt-28"
      style={{ "--comment-graph-color": graphColor } as CSSProperties}
    >
      {isEditing ? (
        <>
          <input
            ref={editingImageInputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={isUploadingEditMedia || isSubmitting}
            onChange={handleEditImageChange}
            className="hidden"
          />
          <input
            ref={editingVideoInputRef}
            type="file"
            accept="video/*"
            multiple
            disabled={isUploadingEditMedia || isSubmitting}
            onChange={handleEditVideoChange}
            className="hidden"
          />
        </>
      ) : null}
      <div
        className={`relative rounded-md border p-4 transition-colors ${
          isFocusedComment ? "border-primary bg-primary/5" : ""
        }`}
      >
        {connectFromPrevious ? (
          <span className="absolute -left-[25px] -top-6 h-[calc(50%+1.5rem)] w-0.5 bg-[var(--comment-graph-color)]" />
        ) : null}
        {hasGraphChildren || connectToNext ? (
          <span className="absolute -left-[25px] top-1/2 bottom-0 w-0.5 bg-[var(--comment-graph-color)]" />
        ) : null}
        <span className="absolute top-1/2 z-10 -left-[30px] size-3 -translate-y-1/2 rounded-full border-2 border-[var(--comment-graph-color)] bg-[var(--comment-graph-color)]" />
        <span className="absolute top-1/2 -left-6 h-0.5 w-6 -translate-y-1/2 bg-[var(--comment-graph-color)]" />
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="inline-flex min-w-0 items-center gap-2">
            <CommentAuthorHeader
              href={authorHref}
              name={comment.author}
              image={comment.author_image}
              role={comment.author_role}
            />
            {isHidden && !comment.is_deleted ? (
              <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : null}
            {showSecretLock ? (
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : null}
          </span>
          <span className="text-muted-foreground">
            {formatSeoulDateTime(comment.created_at)}
            {comment.is_edited ? " (수정)" : ""}
          </span>
        </div>

        {isEditing ? (
          <textarea
            ref={editingTextareaRef}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              resizeTextareaToContent(event.currentTarget);
            }}
            onKeyDown={handleEditContentKeyDown}
            rows={1}
            className="mt-2 block h-7 min-h-7 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-base leading-7 outline-none placeholder:text-zinc-400"
          />
        ) : comment.is_deleted ? (
          <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-muted-foreground">
            삭제된 댓글입니다.
          </p>
        ) : (
          <MarkdownRenderer
            content={comment.content}
            className={`mt-2 text-base leading-7 [&_p]:!my-0 ${
              comment.content === "비밀댓글입니다."
                ? "text-muted-foreground"
                : ""
            }`}
          />
        )}

        {!isEditing && error ? (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        ) : null}
      </div>

      {isEditing ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => editingImageInputRef.current?.click()}
              disabled={isUploadingEditMedia || isSubmitting}
              className="box-border inline-flex h-7 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 leading-none text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="사진 업로드"
              title="사진 업로드"
            >
              <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>사진</span>
            </button>
            <button
              type="button"
              onClick={() => editingVideoInputRef.current?.click()}
              disabled={isUploadingEditMedia || isSubmitting}
              className="box-border inline-flex h-7 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 leading-none text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="동영상 업로드"
              title="동영상 업로드"
            >
              <Video className="h-3.5 w-3.5" aria-hidden="true" />
              <span>동영상</span>
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={isSubmitting || isUploadingEditMedia}
              onClick={() => {
                setContent(comment.content);
                setIsSecret(comment.is_secret);
                setIsEditing(false);
                setError(null);
              }}
              className="box-border inline-flex h-7 items-center justify-center rounded-md border px-3 py-1.5 leading-none text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              disabled={
                isSubmitting || isTogglingHidden || isUploadingEditMedia
              }
              onClick={handleToggleHidden}
              className={`box-border inline-flex h-7 min-w-10 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 leading-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isHidden
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
              }`}
              aria-pressed={isHidden}
              aria-label={isHidden ? "댓글 숨김 해제" : "댓글 숨김 설정"}
              title={isHidden ? "댓글 숨김 해제" : "댓글 숨김 설정"}
            >
              {isHidden ? (
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>숨김</span>
            </button>
            <button
              type="button"
              disabled={isUploadingEditMedia}
              onClick={() => setIsSecret((current) => !current)}
              className={`box-border inline-flex h-7 min-w-10 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 leading-none transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isSecret
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
              }`}
              aria-pressed={isSecret}
              aria-label={isSecret ? "비밀댓글 해제" : "비밀댓글 설정"}
              title={isSecret ? "비밀댓글 해제" : "비밀댓글 설정"}
            >
              {isSecret ? (
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>잠금</span>
            </button>
            <button
              type="button"
              disabled={isSubmitting || isUploadingEditMedia}
              onClick={handleUpdate}
              className="box-border inline-flex h-7 items-center justify-center rounded-md bg-primary px-3 py-1.5 leading-none text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploadingEditMedia
                ? "업로드 중..."
                : isSubmitting
                  ? "저장 중..."
                  : "수정 저장"}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative mt-2 flex items-center justify-between gap-3">
          {hasGraphChildren || connectToNext ? (
            <span className="absolute -left-6 -top-3 -bottom-px w-0.5 bg-[var(--comment-graph-color)]" />
          ) : null}
          <CommentReactionButton
            commentId={comment.id}
            initialReactions={comment.reactions}
            disabled={!canReact}
          />
          {commentActionButtons}
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}

      {isReplying ? (
        <div className="relative ml-5 mt-3 pl-6">
          <span className="absolute -left-[43px] -top-3 h-0.5 w-[72px] origin-left rotate-[53deg] bg-[var(--comment-graph-color)]" />
          <span className="absolute top-[47px] z-10 -left-[5px] size-3 -translate-y-1/2 rounded-full border-2 border-[var(--comment-graph-color)] bg-[var(--comment-graph-color)]" />
          <span className="absolute left-px top-[47px] h-0.5 w-[23px] -translate-y-1/2 bg-[var(--comment-graph-color)]" />
          <CommentForm
            postId={postId}
            parentId={comment.id}
            placeholder={replyPlaceholder}
            submitLabel={replySubmitLabel}
            simpleEditor
            framed={false}
            controlsPlacement="below-card"
            showHiddenOption
            className="mt-0"
            autoFocus
            cardHeader={
              <CommentAuthorHeader
                href={getLogMyPagePath()}
                name={currentUserName ?? "사용자"}
                image={currentUserImage}
                role={currentUserRole}
                ariaLabel="마이페이지로 이동"
              />
            }
            cancelAction={
              <button
                type="button"
                onClick={() => {
                  setIsReplying(false);
                  setError(null);
                }}
                className="box-border inline-flex h-7 items-center justify-center rounded-md border px-3 py-1.5 leading-none text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
              >
                취소
              </button>
            }
          />
        </div>
      ) : null}

      {comment.replies.length > 0 ? (
        <ul
          className={`relative ml-5 space-y-6 pl-6 ${
            isReplying ? "mt-6" : "mt-3"
          }`}
        >
          <span className="absolute -left-[43px] -top-3 h-0.5 w-[72px] origin-left rotate-[53deg] bg-[var(--comment-graph-color)]" />
          {comment.replies.map((reply, index) => {
            const isOnlyReply = comment.replies.length === 1;

            return (
              <li
                key={reply.id}
                className={`relative before:absolute before:-left-6 before:w-0.5 before:bg-[var(--comment-graph-color)] ${
                  isOnlyReply
                    ? "before:top-12 before:bottom-[calc(100%-3rem)]"
                    : index === 0
                      ? "before:top-12 before:-bottom-6"
                      : index === comment.replies.length - 1
                        ? "before:-top-6 before:bottom-[calc(100%-3rem)]"
                        : "before:-inset-y-6"
                }`}
              >
                <CommentItem
                  comment={reply}
                  postId={postId}
                  currentUserId={currentUserId}
                  isLoggedIn={isLoggedIn}
                  currentUserName={currentUserName}
                  currentUserImage={currentUserImage}
                  currentUserRole={currentUserRole}
                  replyButtonLabel={replyButtonLabel}
                  replyPlaceholder={replyPlaceholder}
                  replySubmitLabel={replySubmitLabel}
                  depth={depth + 1}
                  graphColor={graphColor}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
