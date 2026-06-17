"use client";

import { Eye, EyeOff, ImagePlus, Lock, LockOpen, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import MarkdownRenderer from "@/components/posts/MarkdownRenderer";
import {
  createPostContentImagePath,
  POST_THUMBNAIL_BUCKET,
} from "@/lib/post-thumbnails";
import { supabase } from "@/lib/supabase";

type AnswerEditorTab = "write" | "preview";

const answerMarkdownTools = [
  { label: "H1", action: "heading1" },
  { label: "H2", action: "heading2" },
  { label: "H3", action: "heading3" },
  { label: "H4", action: "heading4" },
  { label: "왼쪽", action: "alignLeft" },
  { label: "가운데", action: "alignCenter" },
  { label: "오른쪽", action: "alignRight" },
  { label: "굵게", action: "bold" },
  { label: "기울임", action: "italic" },
  { label: "취소선", action: "strike" },
  { label: "인용", action: "quote" },
  { label: "목록", action: "list" },
  { label: "번호목록", action: "orderedList" },
  { label: "체크", action: "checklist" },
  { label: "코드블록", action: "codeblock" },
  { label: "표", action: "table" },
  { label: "구분선", action: "divider" },
  { label: "링크", action: "link" },
  { label: "이미지", action: "image" },
  { label: "동영상", action: "video" },
] as const;

type AnswerMarkdownAction = (typeof answerMarkdownTools)[number]["action"];

const emptyPreviewMessageClassName =
  "m-0 p-0 text-base leading-7 text-zinc-400";

export default function CommentForm({
  postId,
  parentId = null,
  placeholder = "댓글을 작성하세요",
  initialIsSecret = false,
  initialIsHidden = false,
  submitLabel = "등록",
  variant = "default",
  showSecretOption = true,
  showHiddenOption = false,
  framed = true,
  controlsPlacement = "inside",
  simpleEditor = false,
  cardHeader = null,
  className = "",
  cancelAction = null,
  autoFocus = false,
}: {
  postId: number;
  parentId?: number | null;
  placeholder?: string;
  initialIsSecret?: boolean;
  initialIsHidden?: boolean;
  submitLabel?: string;
  variant?: "default" | "answer";
  showSecretOption?: boolean;
  showHiddenOption?: boolean;
  framed?: boolean;
  controlsPlacement?: "inside" | "below-card";
  simpleEditor?: boolean;
  cardHeader?: ReactNode;
  className?: string;
  cancelAction?: ReactNode;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const contentImageInputRef = useRef<HTMLInputElement>(null);
  const contentVideoInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [isSecret, setIsSecret] = useState(initialIsSecret);
  const [isHidden, setIsHidden] = useState(initialIsHidden);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingContentImage, setIsUploadingContentImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AnswerEditorTab>("write");
  const [previewAreaHeight, setPreviewAreaHeight] = useState<number | null>(
    null,
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError("댓글 내용을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          postId,
          content: trimmedContent,
          parentId,
          isSecret,
          isHidden,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? "댓글 등록에 실패했습니다.");
        return;
      }

      setContent("");
      setActiveTab("write");
      setPreviewAreaHeight(null);
      setIsSecret(initialIsSecret);
      setIsHidden(initialIsHidden);
      requestAnimationFrame(() => {
        resizeTextarea(textareaRef.current);
      });
      router.refresh();
    } catch {
      setError("댓글 등록 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isAnswerVariant = variant === "answer";

  function resizeTextarea(textarea: HTMLTextAreaElement | null) {
    if (!textarea || !simpleEditor) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  useEffect(() => {
    if (!autoFocus) return;

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.focus();
      if (simpleEditor) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    });
  }, [autoFocus, simpleEditor]);

  function updateContentWithSelection(
    nextContent: string,
    selectionStart: number,
    selectionEnd = selectionStart,
  ) {
    setContent(nextContent);

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
      resizeTextarea(textarea);
    });
  }

  function wrapSelection(
    prefix: string,
    suffix = prefix,
    placeholder = "",
    selectWrapped = false,
  ) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end) || placeholder;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const nextContent = `${before}${prefix}${selectedText}${suffix}${after}`;
    const selectionFrom = start + prefix.length;
    const selectionTo = selectionFrom + selectedText.length;

    updateContentWithSelection(
      nextContent,
      selectWrapped ? selectionFrom : selectionTo + suffix.length,
      selectWrapped ? selectionTo : selectionTo + suffix.length,
    );
  }

  function prefixSelectedLines(prefix: string, placeholder: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndIndex = content.indexOf("\n", end);
    const lineEnd = lineEndIndex === -1 ? content.length : lineEndIndex;
    const selectedBlock = content.slice(lineStart, lineEnd) || placeholder;
    const nextBlock = selectedBlock
      .split("\n")
      .map((line) => `${prefix}${line || placeholder}`)
      .join("\n");
    const nextContent =
      content.slice(0, lineStart) + nextBlock + content.slice(lineEnd);

    updateContentWithSelection(
      nextContent,
      lineStart,
      lineStart + nextBlock.length,
    );
  }

  function wrapSelectedBlock(
    prefix: string,
    suffix: string,
    placeholder: string,
  ) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end) || placeholder;
    const before = content.slice(0, start);
    const after = content.slice(end);
    const nextContent = `${before}${prefix}\n${selectedText}\n${suffix}${after}`;
    const selectionStart = start + prefix.length + 1;
    const selectionEnd = selectionStart + selectedText.length;

    updateContentWithSelection(nextContent, selectionStart, selectionEnd);
  }

  function insertTextAtCursor(text: string) {
    const textarea = textareaRef.current;

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

    updateContentWithSelection(nextContent, nextCursorPosition);
  }

  function handleContentKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (event.key !== "Enter" || event.shiftKey) return;

    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start !== end) return;

    const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndIndex = content.indexOf("\n", start);
    const lineEnd = lineEndIndex === -1 ? content.length : lineEndIndex;
    const currentLine = content.slice(lineStart, lineEnd);
    const orderedMatch = currentLine.match(/^(\d+)\.\s(.*)$/);

    if (!orderedMatch) return;

    event.preventDefault();

    const [, currentNumber, currentText] = orderedMatch;
    const before = content.slice(0, start);
    const after = content.slice(end);

    if (currentText.trim().length === 0) {
      const nextContent =
        content.slice(0, lineStart) +
        content.slice(lineStart + orderedMatch[0].length);
      updateContentWithSelection(nextContent, lineStart);
      return;
    }

    const nextNumber = Number(currentNumber) + 1;
    const insertedText = `\n${nextNumber}. `;
    const nextContent = `${before}${insertedText}${after}`;
    const nextCursorPosition = start + insertedText.length;

    updateContentWithSelection(nextContent, nextCursorPosition);
  }

  function applyAnswerMarkdownTool(action: AnswerMarkdownAction) {
    switch (action) {
      case "heading1":
        prefixSelectedLines("# ", "제목");
        break;
      case "heading2":
        prefixSelectedLines("## ", "소제목");
        break;
      case "heading3":
        prefixSelectedLines("### ", "세부 제목");
        break;
      case "heading4":
        prefixSelectedLines("#### ", "작은 제목");
        break;
      case "alignLeft":
        wrapSelectedBlock("[left]", "[/left]", "정렬할 내용을 입력하세요");
        break;
      case "alignCenter":
        wrapSelectedBlock("[center]", "[/center]", "정렬할 내용을 입력하세요");
        break;
      case "alignRight":
        wrapSelectedBlock("[right]", "[/right]", "정렬할 내용을 입력하세요");
        break;
      case "bold":
        wrapSelection("**", "**", "강조할 내용", true);
        break;
      case "italic":
        wrapSelection("*", "*", "기울일 내용", true);
        break;
      case "strike":
        wrapSelection("~~", "~~", "취소선을 넣을 내용", true);
        break;
      case "quote":
        prefixSelectedLines("> ", "인용문");
        break;
      case "list":
        prefixSelectedLines("- ", "목록 내용");
        break;
      case "orderedList":
        prefixSelectedLines("1. ", "순서 항목");
        break;
      case "checklist":
        prefixSelectedLines("- [ ] ", "체크할 내용");
        break;
      case "codeblock":
        wrapSelection("```tsx\n", "\n```", "코드를 입력하세요", true);
        break;
      case "table":
        insertTextAtCursor(
          "| 항목 | 내용 |\n| --- | --- |\n| 예시 | 값을 입력하세요 |",
        );
        break;
      case "divider":
        insertTextAtCursor("\n---\n");
        break;
      case "link":
        wrapSelection("[", "](https://)", "링크 텍스트", true);
        break;
      case "image":
        contentImageInputRef.current?.click();
        break;
      case "video":
        contentVideoInputRef.current?.click();
        break;
    }
  }

  async function handleContentImageChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setIsUploadingContentImage(true);
    setError(null);

    try {
      const markdownImages: string[] = [];

      for (const file of files) {
        const nextPath = createPostContentImagePath(file.name);
        const { error: uploadError } = await supabase.storage
          .from(POST_THUMBNAIL_BUCKET)
          .upload(nextPath, file, {
            cacheControl: "3600",
            contentType: file.type || undefined,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(POST_THUMBNAIL_BUCKET).getPublicUrl(nextPath);

        markdownImages.push(`![${file.name}](${publicUrl})`);
      }

      insertTextAtCursor(markdownImages.join("\n\n"));
      event.target.value = "";
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "본문 이미지 업로드 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsUploadingContentImage(false);
    }
  }

  async function handleContentVideoChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setIsUploadingContentImage(true);
    setError(null);

    try {
      const markdownVideos: string[] = [];

      for (const file of files) {
        const nextPath = createPostContentImagePath(file.name);
        const { error: uploadError } = await supabase.storage
          .from(POST_THUMBNAIL_BUCKET)
          .upload(nextPath, file, {
            cacheControl: "3600",
            contentType: file.type || undefined,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(POST_THUMBNAIL_BUCKET).getPublicUrl(nextPath);

        markdownVideos.push(`![video](${publicUrl})`);
      }

      insertTextAtCursor(markdownVideos.join("\n\n"));
      event.target.value = "";
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "본문 동영상 업로드 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsUploadingContentImage(false);
    }
  }

  function togglePreviewTab() {
    if (activeTab === "write") {
      const nextHeight =
        editorAreaRef.current?.getBoundingClientRect().height ?? null;

      if (nextHeight) {
        setPreviewAreaHeight(nextHeight);
      }

      setActiveTab("preview");
      return;
    }

    setActiveTab("write");
  }

  const editorTabs = (
    <button
      type="button"
      onClick={togglePreviewTab}
      className="box-border inline-flex h-7 shrink-0 items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm leading-none text-primary-foreground transition hover:bg-primary/90"
    >
      {activeTab === "preview" ? "미리보기 닫기" : "미리보기"}
    </button>
  );

  const editorBody = (
    <div className="space-y-3">
      {!cardHeader && controlsPlacement !== "below-card" ? (
        <div className="flex justify-end">{editorTabs}</div>
      ) : null}

      {!simpleEditor && activeTab === "write" ? (
        <div className="flex flex-wrap gap-2">
          {answerMarkdownTools.map((tool) => (
            <button
              key={tool.action}
              type="button"
              onClick={() => applyAnswerMarkdownTool(tool.action)}
              className="rounded-md border border-border/80 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isUploadingContentImage || isSubmitting}
            >
              {tool.label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        ref={editorAreaRef}
        style={
          simpleEditor && activeTab === "preview" && previewAreaHeight
            ? { height: previewAreaHeight }
            : undefined
        }
        className={
          simpleEditor
            ? "min-h-7"
            : `rounded-lg border border-border/80 bg-background ${
                isAnswerVariant ? "min-h-56" : "min-h-36"
              }`
        }
      >
        {activeTab === "preview" ? (
          <div
            className={`h-full ${
              simpleEditor ? "overflow-y-auto" : "overflow-y-auto px-5 py-4"
            }`}
          >
            {content.trim() ? (
              <MarkdownRenderer
                content={content}
                className="text-base [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              />
            ) : (
              <p
                className={`${emptyPreviewMessageClassName} ${
                  simpleEditor ? "min-h-7" : ""
                }`}
              >
                댓글을 입력하면 여기에 미리보기가 표시됩니다.
              </p>
            )}
          </div>
        ) : simpleEditor ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              resizeTextarea(event.currentTarget);
            }}
            onKeyDown={handleContentKeyDown}
            className="block h-7 min-h-7 w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-base leading-7 outline-none placeholder:text-zinc-400"
            rows={1}
            placeholder={placeholder}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onKeyDown={handleContentKeyDown}
            className={`w-full resize-none bg-transparent px-5 py-4 text-base leading-7 outline-none placeholder:text-zinc-400 ${
              isAnswerVariant ? "min-h-56" : "min-h-36"
            }`}
            rows={isAnswerVariant ? 10 : 5}
            placeholder={placeholder}
          />
        )}
      </div>
    </div>
  );

  const secretButton = showSecretOption ? (
    <button
      type="button"
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
  ) : null;

  const hiddenButton = showHiddenOption ? (
    <button
      type="button"
      onClick={() => setIsHidden((current) => !current)}
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
  ) : null;

  const mediaUploadControls = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => contentImageInputRef.current?.click()}
        disabled={isUploadingContentImage || isSubmitting}
        className="box-border inline-flex h-7 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 leading-none text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="사진 업로드"
        title="사진 업로드"
      >
        <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
        <span>사진</span>
      </button>
      <button
        type="button"
        onClick={() => contentVideoInputRef.current?.click()}
        disabled={isUploadingContentImage || isSubmitting}
        className="box-border inline-flex h-7 items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 leading-none text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        aria-label="동영상 업로드"
        title="동영상 업로드"
      >
        <Video className="h-3.5 w-3.5" aria-hidden="true" />
        <span>동영상</span>
      </button>
    </div>
  );

  const formControls = (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-xs ${
        isAnswerVariant && controlsPlacement === "inside" ? "mt-3" : ""
      }`}
    >
      {mediaUploadControls}
      <div className="flex justify-end gap-2">
        {cancelAction}
        {hiddenButton}
        {secretButton}
        <button
          type="submit"
          disabled={isSubmitting || isUploadingContentImage}
          className="box-border inline-flex h-7 min-w-10 items-center justify-center rounded-md bg-primary px-3 py-1.5 leading-none text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploadingContentImage
            ? "업로드 중..."
            : isSubmitting
              ? `${submitLabel} 중...`
              : submitLabel}
        </button>
      </div>
    </div>
  );

  const errorMessage = error ? (
    <p className={`text-sm text-red-500 ${isAnswerVariant ? "mt-3" : ""}`}>
      {error}
    </p>
  ) : null;

  return (
    <form
      className={
        framed
          ? isAnswerVariant
            ? `rounded-xl border bg-muted/20 p-4 ${className}`
            : `rounded-xl border bg-muted/20 p-4 ${className}`
          : className
      }
      onSubmit={handleSubmit}
    >
      <input
        ref={contentImageInputRef}
        type="file"
        accept="image/*"
        multiple
        disabled={isUploadingContentImage || isSubmitting}
        onChange={handleContentImageChange}
        className="hidden"
      />
      <input
        ref={contentVideoInputRef}
        type="file"
        accept="video/*"
        multiple
        disabled={isUploadingContentImage || isSubmitting}
        onChange={handleContentVideoChange}
        className="hidden"
      />

      {controlsPlacement === "below-card" ? (
        <>
          <div className="rounded-md border bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              {cardHeader ? (
                <div className="flex min-w-0 flex-1 items-center">
                  {cardHeader}
                </div>
              ) : (
                <div className="flex-1" />
              )}
              {editorTabs}
            </div>
            {editorBody}
          </div>
          <div className="mt-2">{formControls}</div>
          {errorMessage}
        </>
      ) : (
        <>
          {editorBody}
          {formControls}
          {errorMessage}
        </>
      )}
    </form>
  );
}
