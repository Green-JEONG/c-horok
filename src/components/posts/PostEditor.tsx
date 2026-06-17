"use client";

import { Check, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CopiedPostCard from "@/components/posts/CopiedPostCard";
import MarkdownRenderer from "@/components/posts/MarkdownRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DbCopiedPost } from "@/lib/db";
import { isNoticeCategoryName } from "@/lib/notice-categories";
import {
  clearSyncedPostDraft,
  getPostDraftStorageKey,
  loadSyncedPostDrafts,
  type PostDraftPayload,
  saveSyncedPostDraft,
} from "@/lib/post-drafts";
import {
  createPostContentImagePath,
  getStorageObjectPathFromPublicUrl,
  POST_THUMBNAIL_BUCKET,
} from "@/lib/post-thumbnails";
import { getTechFeedNewPostPath } from "@/lib/routes";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const markdownTools = [
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
  { label: "코드블록", action: "codeblock" },
  { label: "인용", action: "quote" },
  { label: "목록", action: "list" },
  { label: "번호목록", action: "orderedList" },
  { label: "체크", action: "checklist" },
  { label: "표", action: "table" },
  { label: "구분선", action: "divider" },
  { label: "링크", action: "link" },
  { label: "이미지", action: "image" },
  { label: "동영상", action: "video" },
] as const;

type MarkdownToolAction = (typeof markdownTools)[number]["action"];
type EditorTab = "write" | "preview";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getContentImageUrls(markdown: string) {
  const urls: string[] = [];
  const seen = new Set<string>();

  const addUrl = (url: string | undefined) => {
    const trimmed = url?.trim();

    if (!trimmed || seen.has(trimmed)) {
      return;
    }

    seen.add(trimmed);
    urls.push(trimmed);
  };

  const markdownImageRegex =
    /!\[([^\]]*)]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)(?:\s*\{[^}]*\})?/g;

  for (const match of markdown.matchAll(markdownImageRegex)) {
    const altText = match[1]?.trim().toLowerCase();

    if (altText === "video") {
      continue;
    }

    addUrl(match[2]);
  }

  const htmlImageRegex = /<img\b[^>]*\/?>/gi;

  for (const match of markdown.matchAll(htmlImageRegex)) {
    const attrs = match[0];
    const src =
      attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ??
      attrs.match(/\bsrc\s*=\s*([^\s>]+)/i)?.[1];

    addUrl(src);
  }

  return urls;
}

function parseInquiryTitlePrefix(title: string, inquiryTagOptions: string[]) {
  if (inquiryTagOptions.length === 0) {
    return {
      title,
      selectedInquiryTag: inquiryTagOptions[0] ?? "",
    };
  }

  const inquiryTagPrefixRegex = new RegExp(
    `^\\[(${inquiryTagOptions.map(escapeRegExp).join("|")})\\]\\s*`,
  );
  const match = title.match(inquiryTagPrefixRegex);

  return {
    title: title.replace(inquiryTagPrefixRegex, ""),
    selectedInquiryTag: match?.[1] ?? inquiryTagOptions[0] ?? "",
  };
}

type PostEditorProps = {
  mode?: "create" | "edit";
  postId?: number;
  initialTitle?: string;
  initialContent?: string;
  initialCategoryName?: string;
  initialCategoryNames?: string[];
  initialThumbnail?: string | null;
  initialIsBanner?: boolean;
  initialIsSecret?: boolean;
  copiedFromPostId?: number | null;
  copiedFromPost?: DbCopiedPost | null;
  cancelLabel?: string;
  submitLabel?: string;
  submittingLabel?: string;
  categoryLocked?: boolean;
  successPathPrefix?: string;
  fixedTagOptions?: string[];
  inquiryTagOptions?: string[];
  showCategoryField?: boolean;
  showBannerOption?: boolean;
  allowNoticeBannerForAllCategories?: boolean;
  onCancel?: () => void;
  onSuccess?: (payload: unknown) => void;
};

export default function PostEditor({
  mode = "create",
  postId,
  initialTitle = "",
  initialContent = "",
  initialCategoryName = "",
  initialCategoryNames,
  initialThumbnail = null,
  initialIsBanner = false,
  initialIsSecret = false,
  copiedFromPostId = null,
  copiedFromPost = null,
  cancelLabel = "취소",
  submitLabel = mode === "edit" ? "수정 저장" : "게시하기",
  submittingLabel = mode === "edit" ? "저장 중..." : "게시 중...",
  categoryLocked = false,
  successPathPrefix = "/horok-tech/feeds/posts",
  fixedTagOptions = [],
  inquiryTagOptions = [],
  showCategoryField = true,
  showBannerOption = true,
  allowNoticeBannerForAllCategories = false,
  onCancel,
  onSuccess,
}: PostEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdFromParams = searchParams.get("draftId");
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const contentImageInputRef = useRef<HTMLInputElement>(null);
  const contentVideoInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const isTagComposingRef = useRef(false);
  const isContentComposingRef = useRef(false);
  const initialInquiryTitle = parseInquiryTitlePrefix(
    initialTitle,
    inquiryTagOptions,
  );

  const [title, setTitle] = useState(initialInquiryTitle.title);
  const [content, setContent] = useState(initialContent);
  const initialTags =
    initialCategoryNames && initialCategoryNames.length > 0
      ? initialCategoryNames
      : initialCategoryName
        ? [initialCategoryName]
        : [];
  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [selectedFixedTag, setSelectedFixedTag] = useState(
    fixedTagOptions.includes(initialCategoryName)
      ? initialCategoryName
      : (fixedTagOptions[0] ?? ""),
  );
  const [selectedInquiryTag, setSelectedInquiryTag] = useState(
    initialInquiryTitle.selectedInquiryTag,
  );
  const [isBanner, setIsBanner] = useState(initialIsBanner);
  const [isSecret, setIsSecret] = useState(initialIsSecret);
  const [selectedThumbnailUrl, setSelectedThumbnailUrl] = useState<
    string | null
  >(initialThumbnail ?? null);
  const [isUploadingContentImage, setIsUploadingContentImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftToast, setDraftToast] = useState<{
    status: "success" | "error";
    closing: boolean;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("write");
  const [error, setError] = useState<string | null>(null);
  const draftToastTimeoutRef = useRef<number | null>(null);
  const hasCheckedDraftRef = useRef(false);
  const currentDraftIdRef = useRef<string | null>(draftIdFromParams);
  const shouldShowCategoryBadge = !(
    categoryLocked && fixedTagOptions.length > 0
  );
  const currentCategoryName =
    categoryLocked && fixedTagOptions.length > 0 ? selectedFixedTag : tags[0];
  const isNoticeCategory = isNoticeCategoryName(currentCategoryName);
  const shouldShowCategoryField =
    showCategoryField && !(categoryLocked && isNoticeCategory);
  const canShowBannerOption =
    showBannerOption &&
    isNoticeCategory &&
    (currentCategoryName === "공지" || allowNoticeBannerForAllCategories);
  const shouldShowInquiryTagField =
    currentCategoryName === "QnA" && inquiryTagOptions.length > 0;
  const draftStorageKey = getPostDraftStorageKey({
    successPathPrefix,
    fixedTagOptions,
    categoryLocked,
  });

  const closeDraftToast = useCallback(() => {
    if (draftToastTimeoutRef.current !== null) {
      window.clearTimeout(draftToastTimeoutRef.current);
      draftToastTimeoutRef.current = null;
    }

    setDraftToast((current) =>
      current ? { ...current, closing: true } : current,
    );

    window.setTimeout(() => {
      setDraftToast(null);
    }, 260);
  }, []);

  const showDraftToast = useCallback(
    (status: "success" | "error") => {
      if (draftToastTimeoutRef.current !== null) {
        window.clearTimeout(draftToastTimeoutRef.current);
      }

      setDraftToast({ status, closing: false });

      draftToastTimeoutRef.current = window.setTimeout(() => {
        closeDraftToast();
      }, 3000);
    },
    [closeDraftToast],
  );

  useEffect(() => {
    return () => {
      if (draftToastTimeoutRef.current !== null) {
        window.clearTimeout(draftToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mode !== "create" || copiedFromPostId || hasCheckedDraftRef.current) {
      return;
    }

    hasCheckedDraftRef.current = true;

    let cancelled = false;

    const restoreDraft = async () => {
      const drafts = await loadSyncedPostDrafts(draftStorageKey);
      const draft = draftIdFromParams
        ? drafts.find((item) => item.id === draftIdFromParams)
        : (drafts[0] ?? null);

      if (!draft || cancelled) {
        return;
      }

      const shouldRestore = draftIdFromParams
        ? true
        : window.confirm(
            "임시저장된 글이 있습니다. 최근 임시저장 글을 이어서 작성하시겠습니까?",
          );

      if (!shouldRestore || cancelled) {
        return;
      }

      currentDraftIdRef.current = draft.id ?? null;
      setTitle(draft.title ?? "");
      setContent(draft.content ?? "");
      setTags(Array.isArray(draft.tags) ? draft.tags : []);
      setSelectedFixedTag(draft.selectedFixedTag ?? fixedTagOptions[0] ?? "");
      setSelectedInquiryTag(
        draft.selectedInquiryTag ?? inquiryTagOptions[0] ?? "",
      );
      setIsBanner(Boolean(draft.isBanner));
      setIsSecret(Boolean(draft.isSecret));
      setSelectedThumbnailUrl(draft.thumbnailUrl ?? null);
    };

    void restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [
    draftIdFromParams,
    draftStorageKey,
    copiedFromPostId,
    fixedTagOptions,
    inquiryTagOptions,
    mode,
  ]);

  async function removeThumbnailFromStorage(path?: string | null) {
    if (!path) return;
    await supabase.storage.from(POST_THUMBNAIL_BUCKET).remove([path]);
  }

  function normalizeTagValue(value: string) {
    return value.trim().replace(/^#/, "").toLocaleLowerCase();
  }

  function addTag(rawValue: string) {
    const nextTag = normalizeTagValue(rawValue);
    if (!nextTag) return;

    setTags((prev) =>
      prev.some((tag) => tag.toLowerCase() === nextTag.toLowerCase())
        ? prev
        : [...prev, nextTag],
    );
    setTagInput("");
  }

  function removeTag(targetTag: string) {
    setTags((prev) => prev.filter((tag) => tag !== targetTag));

    requestAnimationFrame(() => {
      tagInputRef.current?.focus();
    });
  }

  function buildInquiryTitle(rawTitle: string) {
    if (!shouldShowInquiryTagField || !selectedInquiryTag) {
      return rawTitle;
    }

    const inquiryTagPrefixRegex = new RegExp(
      `^\\[(${inquiryTagOptions.map(escapeRegExp).join("|")})\\]\\s*`,
    );
    const titleWithoutInquiryPrefix = rawTitle.replace(
      inquiryTagPrefixRegex,
      "",
    );

    return `[${selectedInquiryTag}] ${titleWithoutInquiryPrefix}`;
  }

  const contentImageUrls = useMemo(
    () => getContentImageUrls(content),
    [content],
  );

  useEffect(() => {
    setSelectedThumbnailUrl((current) => {
      if (contentImageUrls.length === 0) {
        return null;
      }

      if (current && contentImageUrls.includes(current)) {
        return current;
      }

      return contentImageUrls[0] ?? null;
    });
  }, [contentImageUrls]);

  function getFirstContentImageUrl(markdown: string) {
    return getContentImageUrls(markdown)[0] ?? null;
  }

  function updateContentWithSelection(
    nextContent: string,
    selectionStart: number,
    selectionEnd = selectionStart,
  ) {
    setContent(nextContent);

    requestAnimationFrame(() => {
      const textarea = contentRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(selectionStart, selectionEnd);
    });
  }

  function insertTextAtCursor(text: string) {
    const textarea = contentRef.current;

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

    if (isContentComposingRef.current || event.nativeEvent.isComposing) {
      return;
    }

    const textarea = event.currentTarget;
    const value = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (start !== end) return;

    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndIndex = value.indexOf("\n", start);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const currentLine = value.slice(lineStart, lineEnd);
    const orderedMatch = currentLine.match(/^(\d+)\.\s(.*)$/);

    if (!orderedMatch) return;

    event.preventDefault();

    const [, currentNumber, currentText] = orderedMatch;
    const before = value.slice(0, start);
    const after = value.slice(end);

    if (currentText.trim().length === 0) {
      const nextContent =
        value.slice(0, lineStart) +
        value.slice(lineStart + orderedMatch[0].length);
      updateContentWithSelection(nextContent, lineStart);
      return;
    }

    const nextNumber = Number(currentNumber) + 1;
    const insertedText = `\n${nextNumber}. `;
    const nextContent = `${before}${insertedText}${after}`;
    const nextCursorPosition = start + insertedText.length;

    updateContentWithSelection(nextContent, nextCursorPosition);
  }

  function wrapSelection(
    prefix: string,
    suffix = prefix,
    placeholder = "",
    selectWrapped = false,
  ) {
    const textarea = contentRef.current;
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

  function wrapSelectedBlock(
    prefix: string,
    suffix: string,
    placeholder: string,
  ) {
    const textarea = contentRef.current;
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

  function prefixSelectedLines(prefix: string, placeholder: string) {
    const textarea = contentRef.current;
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

  function applyMarkdownTool(action: MarkdownToolAction) {
    const textarea = contentRef.current;
    if (!textarea) return;

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
        wrapSelection("**", "**", "굵게 표시할 내용", true);
        break;
      case "italic":
        wrapSelection("*", "*", "기울여 표시할 내용", true);
        break;
      case "strike":
        wrapSelection("~~", "~~", "취소선을 넣을 내용", true);
        break;
      case "codeblock":
        wrapSelection("```tsx\n", "\n```", "코드를 입력하세요", true);
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
      case "table":
        insertTextAtCursor(
          "| 항목 | 내용 |\n| --- | --- |\n| 예시 | 값을 입력하세요 |",
        );
        break;
      case "divider":
        insertTextAtCursor("---");
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

  async function handleContentPaste(
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) {
    if (isUploadingContentImage || isSubmitting) return;

    const items = event.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length === 0) return;

    event.preventDefault();

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
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : "본문 이미지 붙여넣기 중 오류가 발생했습니다.";
      setError(message);
    } finally {
      setIsUploadingContentImage(false);
    }
  }

  async function handleSubmit() {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const categoryNames =
      categoryLocked && fixedTagOptions.length > 0
        ? [selectedFixedTag].filter(Boolean)
        : tags;
    const resolvedCategoryName = categoryNames[0] || "";

    if (
      !trimmedTitle ||
      !trimmedContent ||
      (categoryLocked && !resolvedCategoryName)
    ) {
      setError(
        categoryLocked
          ? "제목과 내용을 모두 입력해주세요."
          : "제목과 내용을 모두 입력해주세요.",
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const submitTitle = buildInquiryTitle(trimmedTitle);
      const nextThumbnailUrl =
        selectedThumbnailUrl ?? getFirstContentImageUrl(trimmedContent);
      const endpoint = mode === "edit" ? `/api/posts/${postId}` : "/api/posts";
      const method = mode === "edit" ? "PUT" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: submitTitle,
          content: trimmedContent,
          categoryName: resolvedCategoryName,
          categoryNames,
          isBanner,
          isSecret,
          thumbnailUrl: nextThumbnailUrl,
          ...(mode === "create" && copiedFromPostId
            ? { copiedFromPostId }
            : {}),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.message ?? "게시글 저장에 실패했습니다.");
        return;
      }

      if (
        mode === "edit" &&
        initialThumbnail &&
        initialThumbnail !== nextThumbnailUrl &&
        !trimmedContent.includes(initialThumbnail)
      ) {
        const oldSavedThumbnailPath =
          getStorageObjectPathFromPublicUrl(initialThumbnail);
        if (oldSavedThumbnailPath) {
          await removeThumbnailFromStorage(oldSavedThumbnailPath);
        }
      }

      if (mode === "create") {
        await clearSyncedPostDraft(draftStorageKey, currentDraftIdRef.current);
        currentDraftIdRef.current = null;
      }

      onSuccess?.(payload);

      if (mode === "edit") {
        router.refresh();
        return;
      }

      if ((payload as { id?: number } | null)?.id) {
        router.push(`${successPathPrefix}/${payload.id}`);
        router.refresh();
        return;
      }

      router.push(getTechFeedNewPostPath());
      router.refresh();
    } catch {
      setError("게시글 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    if (typeof window === "undefined") {
      return;
    }

    setIsSavingDraft(true);
    setError(null);

    try {
      const payload: PostDraftPayload = {
        id: currentDraftIdRef.current ?? undefined,
        title,
        content,
        tags,
        selectedFixedTag,
        selectedInquiryTag,
        isBanner,
        isSecret,
        thumbnailUrl: selectedThumbnailUrl,
        savedAt: new Date().toISOString(),
      };

      const savedDraft = await saveSyncedPostDraft(draftStorageKey, payload);

      if (!savedDraft) {
        showDraftToast("error");
        return;
      }

      currentDraftIdRef.current = savedDraft.id ?? currentDraftIdRef.current;
      showDraftToast("success");
    } catch {
      showDraftToast("error");
    } finally {
      window.setTimeout(() => {
        setIsSavingDraft(false);
      }, 800);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2 border-b border-border/70 pb-2">
        <input
          id="post-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          className="w-full border-0 bg-transparent px-0 py-0 text-3xl font-semibold tracking-tight text-foreground outline-none placeholder:text-zinc-400 sm:text-4xl"
        />
      </div>

      {shouldShowInquiryTagField ? (
        <div className="space-y-2">
          <div className="flex min-h-12 w-full flex-wrap items-center gap-2 rounded-md border border-border/80 bg-muted/20 px-3 py-2">
            {inquiryTagOptions.map((option) => {
              const isActive = selectedInquiryTag === option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelectedInquiryTag(option)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${
                    isActive
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {shouldShowCategoryField ? (
        <div className="space-y-2">
          <div className="flex min-h-12 w-full flex-wrap items-center gap-2 rounded-md border border-border/80 bg-muted/20 px-3 py-2 transition focus-within:border-primary/60 focus-within:bg-background focus-within:ring-4 focus-within:ring-primary/10">
            {shouldShowCategoryBadge
              ? tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-foreground"
                  >
                    {tag.toLocaleLowerCase()}
                    {categoryLocked ? null : (
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="text-muted-foreground transition hover:text-foreground"
                        aria-label={`${tag} 태그 삭제`}
                      >
                        ×
                      </button>
                    )}
                  </Badge>
                ))
              : null}
            {fixedTagOptions.map((option) => {
              const isActive = selectedFixedTag === option;
              const optionLabel = option === "QnA" ? "문의" : option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelectedFixedTag(option)}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition ${
                    isActive
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
                  }`}
                >
                  {optionLabel}
                </button>
              );
            })}
            {categoryLocked ? null : (
              <input
                id="post-tags"
                ref={tagInputRef}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onCompositionStart={() => {
                  isTagComposingRef.current = true;
                }}
                onCompositionEnd={(event) => {
                  isTagComposingRef.current = false;
                  setTagInput(event.currentTarget.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    if (
                      isTagComposingRef.current ||
                      event.nativeEvent.isComposing
                    ) {
                      return;
                    }

                    event.preventDefault();
                    addTag(event.currentTarget.value);
                    return;
                  }

                  if (
                    event.key === "Backspace" &&
                    tagInput.length === 0 &&
                    tags.length > 0
                  ) {
                    event.preventDefault();
                    setTags((prev) => prev.slice(0, -1));
                  }
                }}
                placeholder={tags.length === 0 ? "태그 및 카테고리" : ""}
                className="h-8 min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
              />
            )}
          </div>
        </div>
      ) : null}
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

      <div className="space-y-3">
        {copiedFromPost ? (
          <div className="pt-1">
            <CopiedPostCard copiedPost={copiedFromPost} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center border-b border-border/70">
            <button
              type="button"
              onClick={() => setActiveTab("write")}
              className={`w-20 border-b-2 px-1 pb-2 text-center text-sm font-medium transition ${
                activeTab === "write"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              본문
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`w-20 border-b-2 px-1 pb-2 text-center text-sm font-medium transition ${
                activeTab === "preview"
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              미리보기
            </button>
          </div>
        </div>

        {activeTab === "write" ? (
          <div className="flex flex-wrap gap-2">
            {markdownTools.map((tool) => (
              <button
                key={tool.action}
                type="button"
                onClick={() => applyMarkdownTool(tool.action)}
                className="rounded-md border border-border/80 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
              >
                {tool.label}
              </button>
            ))}
          </div>
        ) : null}

        <div
          className={`rounded-md border border-border/80 bg-muted/15 ${
            activeTab === "preview" ? "" : "h-[420px]"
          }`}
        >
          {activeTab === "preview" ? (
            <div className="px-5 py-5">
              {content.trim() ? (
                <MarkdownRenderer
                  content={content}
                  className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 text-[15px] leading-7"
                />
              ) : (
                <p className="text-[15px] leading-7 text-muted-foreground">
                  본문을 입력하면 여기에 미리보기가 표시됩니다.
                </p>
              )}
            </div>
          ) : (
            <textarea
              id="post-content"
              ref={contentRef}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onCompositionStart={() => {
                isContentComposingRef.current = true;
              }}
              onCompositionEnd={() => {
                isContentComposingRef.current = false;
              }}
              onKeyDown={handleContentKeyDown}
              onPaste={handleContentPaste}
              rows={16}
              spellCheck={false}
              className="h-full w-full resize-none rounded-md bg-transparent px-5 py-5 font-mono text-[15px] leading-7 text-foreground outline-none placeholder:text-zinc-400"
              placeholder={"내용을 입력해 주세요."}
            />
          )}
        </div>
      </div>

      {contentImageUrls.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">썸네일 선택</p>
          <div className="scrollbar-orange flex gap-3 overflow-x-auto pb-1">
            {contentImageUrls.map((imageUrl, index) => {
              const isSelected = selectedThumbnailUrl === imageUrl;

              return (
                <button
                  key={imageUrl}
                  type="button"
                  onClick={() => setSelectedThumbnailUrl(imageUrl)}
                  className={cn(
                    "relative h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 transition",
                    isSelected
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50",
                  )}
                  aria-label={`썸네일 ${index + 1} 선택`}
                  aria-pressed={isSelected}
                >
                  {/* biome-ignore lint/performance/noImgElement: thumbnail picker preview */}
                  <img
                    src={imageUrl}
                    alt={`본문 이미지 ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {canShowBannerOption ? (
        <label className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/20 px-3 py-3 text-sm">
          <input
            type="checkbox"
            checked={isBanner}
            onChange={(event) => setIsBanner(event.target.checked)}
            className="h-4 w-4"
          />
          <span>배너 노출</span>
        </label>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={isSubmitting || isUploadingContentImage}
          onClick={() => {
            if (onCancel) {
              onCancel();
              return;
            }

            router.back();
          }}
          className="min-w-24"
        >
          {cancelLabel}
        </Button>

        <div className="flex items-center gap-2">
          <label className="inline-flex h-10 min-w-28 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium whitespace-nowrap shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50">
            <input
              type="checkbox"
              checked={isSecret}
              onChange={(event) => setIsSecret(event.target.checked)}
              className="h-4 w-4"
            />
            <span>비밀글로 작성</span>
          </label>
          {mode === "create" ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={
                isSubmitting || isUploadingContentImage || isSavingDraft
              }
              onClick={handleSaveDraft}
              className="min-w-28"
            >
              {isSavingDraft ? "임시저장 완료" : "임시저장"}
            </Button>
          ) : null}
          <Button
            type="button"
            size="lg"
            disabled={isSubmitting || isUploadingContentImage}
            onClick={handleSubmit}
            className="min-w-28 text-white dark:text-white"
          >
            {isSubmitting
              ? submittingLabel
              : isUploadingContentImage
                ? "업로드 중..."
                : submitLabel}
          </Button>
        </div>
      </div>

      {draftToast && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`fixed left-1/2 top-24 z-70 w-[min(340px,calc(100vw-40px))] -translate-x-1/2 transition-all duration-250 ease-out ${
                draftToast.closing
                  ? "-translate-y-4 opacity-0"
                  : "translate-y-0 opacity-100"
              }`}
            >
              <div className="relative flex items-center gap-3 rounded-md border border-transparent bg-white px-5 py-4 text-zinc-500 shadow-[0_12px_28px_rgba(0,0,0,0.16)] dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-[0_16px_32px_rgba(0,0,0,0.42)]">
                {draftToast.status === "success" ? (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#13c51b] text-white">
                    <Check className="h-5.5 w-5.5 stroke-[3]" />
                  </span>
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white">
                    <X className="h-5.5 w-5.5 stroke-[3]" />
                  </span>
                )}
                <p className="min-w-0 truncate pr-5 text-base font-medium tracking-normal text-slate-900 dark:text-slate-50">
                  {draftToast.status === "success"
                    ? "임시저장되었습니다."
                    : "임시저장에 실패했습니다."}
                </p>
                <button
                  type="button"
                  onClick={closeDraftToast}
                  className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center text-zinc-400 transition hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                  aria-label="토스트 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
