"use client";

import { Check, Pencil, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  forwardRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { ImageCropCompleteResult } from "@/components/common/ImageCropModal";
import ImageCropModal from "@/components/common/ImageCropModal";
import CopiedPostCard from "@/components/posts/CopiedPostCard";
import MarkdownRenderer from "@/components/posts/MarkdownRenderer";
import PostCroppedThumbnail from "@/components/posts/PostCroppedThumbnail";
import PostTitleStatusIcons, {
  getTitleStatusIndent,
} from "@/components/posts/PostTitleStatusIcons";
import { Button } from "@/components/ui/button";
import {
  filterVisibleCategoryNames,
  isInternalUncategorizedCategory,
} from "@/lib/category-labels";
import type { DbCopiedPost, DbPostAttachment } from "@/lib/db";
import { handleMarkdownEditorKeyDown } from "@/lib/markdown-editor-keydown";
import { isNoticeCategoryName } from "@/lib/notice-categories";
import { formatAttachmentFileSize } from "@/lib/post-attachments";
import {
  clearSyncedPostDraft,
  getPostDraftStorageKey,
  loadSyncedPostDraft,
  loadSyncedPostDrafts,
  type PostDraftPayload,
  saveSyncedPostDraft,
} from "@/lib/post-drafts";
import { validatePostSecretPassword } from "@/lib/post-secret-password";
import { removePostMedia, uploadPostMedia } from "@/lib/post-storage-client";
import {
  normalizePostStorageMarkdown,
  normalizePostStorageReference,
} from "@/lib/post-storage";
import {
  normalizePostThumbnailCrop,
  type PostThumbnailCrop,
} from "@/lib/post-thumbnail-crop";
import {
  getThumbnailMediaUrls,
  POST_THUMBNAIL_ASPECT,
} from "@/lib/post-thumbnails";
import { getLogFeedNewPostPath } from "@/lib/routes";
import { cn } from "@/lib/utils";

const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const EDITOR_BODY_HEIGHT = 420;
const CONTENT_MEDIA_PLACEHOLDER = "추가하는 중...";
const EMPTY_TAG_OPTIONS: string[] = [];

const CONTENT_IMAGE_EXTENSIONS = new Set([
  "avif",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);
const CONTENT_VIDEO_EXTENSIONS = new Set(["m4v", "mov", "mp4", "webm"]);

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function isContentMediaFile(file: File) {
  if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
    return true;
  }

  const extension = getFileExtension(file.name);

  return (
    CONTENT_IMAGE_EXTENSIONS.has(extension) ||
    CONTENT_VIDEO_EXTENSIONS.has(extension)
  );
}

function getContentMediaFiles(files: Iterable<File>) {
  return Array.from(files).filter(isContentMediaFile);
}

function isThumbnailImageFile(file: File) {
  if (file.type.startsWith("image/")) {
    return true;
  }

  return CONTENT_IMAGE_EXTENSIONS.has(getFileExtension(file.name));
}

function getThumbnailImageFiles(files: Iterable<File>) {
  return Array.from(files).filter(isThumbnailImageFile);
}

function hasThumbnailImageInDataTransfer(dataTransfer: DataTransfer) {
  if (dataTransfer.files.length > 0) {
    return getThumbnailImageFiles(dataTransfer.files).length > 0;
  }

  return Array.from(dataTransfer.items).some(
    (item) => item.kind === "file" && item.type.startsWith("image/"),
  );
}

function hasContentMediaInDataTransfer(dataTransfer: DataTransfer) {
  if (dataTransfer.files.length > 0) {
    return getContentMediaFiles(dataTransfer.files).length > 0;
  }

  return Array.from(dataTransfer.items).some(
    (item) =>
      item.kind === "file" &&
      (item.type.startsWith("image/") || item.type.startsWith("video/")),
  );
}

function buildContentMediaMarkdown(file: File, publicUrl: string) {
  if (
    file.type.startsWith("video/") ||
    CONTENT_VIDEO_EXTENSIONS.has(getFileExtension(file.name))
  ) {
    return `![video](${publicUrl})`;
  }

  return `![${file.name}](${publicUrl})`;
}

function getContentMediaUrls(markdown: string) {
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

  const markdownMediaRegex =
    /!\[([^\]]*)]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)(?:\s*\{[^}]*\})?/g;

  for (const match of markdown.matchAll(markdownMediaRegex)) {
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type EditorTab = "thumbnail" | "write" | "attachments";
type EditorAttachment = {
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function InlineTitleInput({
  id,
  value,
  placeholder,
  onChange,
  textIndent,
}: {
  id: string;
  value: string;
  placeholder: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  textIndent?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [placeholder, textIndent, value]);

  return (
    <textarea
      id={id}
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={1}
      style={{ textIndent }}
      className="block w-full min-w-0 resize-none overflow-hidden border-0 bg-transparent p-0 text-3xl font-bold leading-tight break-words text-foreground outline-none placeholder:text-zinc-400"
    />
  );
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

export type PostEditorHandle = {
  submit: () => void;
};

export type PostEditorInlineSections = {
  titleSection: ReactNode;
  titleStatusSection: ReactNode;
  titleStatusIndent?: string;
  tagsSection: ReactNode;
  contentSection: ReactNode;
  secretSection: ReactNode;
  hiddenSection: ReactNode;
  footerExtrasSection: ReactNode;
  errorSection: ReactNode;
};

type PostEditorProps = {
  mode?: "create" | "edit";
  postId?: number;
  initialTitle?: string;
  initialContent?: string;
  initialCategoryName?: string;
  initialCategoryNames?: string[];
  initialThumbnail?: string | null;
  initialThumbnailCrop?: PostThumbnailCrop | null;
  initialAttachments?: DbPostAttachment[];
  initialIsBanner?: boolean;
  initialIsSecret?: boolean;
  initialIsHidden?: boolean;
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
  layout?: "default" | "inline";
  renderInline?: (sections: PostEditorInlineSections) => ReactNode;
  onSubmittingChange?: (isSubmitting: boolean) => void;
  onCancel?: () => void;
  onSuccess?: (payload: unknown) => void;
};

const PostEditor = forwardRef<PostEditorHandle, PostEditorProps>(
  function PostEditor(
    {
      mode = "create",
      postId,
      initialTitle = "",
      initialContent = "",
      initialCategoryName = "",
      initialCategoryNames,
      initialThumbnail = null,
      initialThumbnailCrop = null,
      initialAttachments = [],
      initialIsBanner = false,
      initialIsSecret = false,
      initialIsHidden = false,
      copiedFromPostId = null,
      copiedFromPost = null,
      cancelLabel = "취소",
      submitLabel = mode === "edit" ? "수정 저장" : "작성하기",
      submittingLabel = mode === "edit" ? "저장 중..." : "게시 중...",
      categoryLocked = false,
      successPathPrefix = "/horok-log/feeds/posts",
      fixedTagOptions = EMPTY_TAG_OPTIONS,
      inquiryTagOptions = EMPTY_TAG_OPTIONS,
      showCategoryField = true,
      showBannerOption = true,
      allowNoticeBannerForAllCategories = false,
      layout = "default",
      renderInline,
      onSubmittingChange,
      onCancel,
      onSuccess,
    },
    ref,
  ) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const draftIdFromParams = searchParams.get("draftId");
    const contentRef = useRef<HTMLTextAreaElement>(null);
    const writeSplitRef = useRef<HTMLDivElement>(null);
    const writeSplitResizeStateRef = useRef<{
      startPointer: number;
      startRatio: number;
      containerWidth: number;
    } | null>(null);
    const contentImageInputRef = useRef<HTMLInputElement>(null);
    const contentVideoInputRef = useRef<HTMLInputElement>(null);
    const contentAttachmentInputRef = useRef<HTMLInputElement>(null);
    const thumbnailImageInputRef = useRef<HTMLInputElement>(null);
    const thumbnailBlobUrlRef = useRef<string | null>(null);
    const thumbnailCropSourceUrlRef = useRef<string | null>(null);
    const thumbnailUploadFileRef = useRef<File | null>(null);
    const tagInputRef = useRef<HTMLInputElement>(null);
    const isTagComposingRef = useRef(false);
    const isContentComposingRef = useRef(false);
    const contentMediaPlaceholderRef = useRef<{
      start: number;
      end: number;
    } | null>(null);
    const initialInquiryTitle = parseInquiryTitlePrefix(
      initialTitle,
      inquiryTagOptions,
    );

    const [title, setTitle] = useState(initialInquiryTitle.title);
    const [content, setContent] = useState(initialContent);
    const [attachments, setAttachments] = useState<EditorAttachment[]>(
      initialAttachments.map((attachment) => ({
        fileName: attachment.file_name,
        fileUrl: attachment.file_url,
        fileSize: attachment.file_size,
      })),
    );
    const initialTags = filterVisibleCategoryNames(
      initialCategoryNames && initialCategoryNames.length > 0
        ? initialCategoryNames
        : initialCategoryName
          ? [initialCategoryName]
          : [],
    );
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
    const [secretPassword, setSecretPassword] = useState("");
    const [isHidden, setIsHidden] = useState(initialIsHidden);
    const [selectedThumbnailUrl, setSelectedThumbnailUrl] = useState<
      string | null
    >(initialThumbnail ?? null);
    const [selectedThumbnailCrop, setSelectedThumbnailCrop] =
      useState<PostThumbnailCrop | null>(initialThumbnailCrop ?? null);
    const [thumbnailCrops, setThumbnailCrops] = useState<
      Record<string, PostThumbnailCrop>
    >(
      initialThumbnail && initialThumbnailCrop
        ? { [initialThumbnail]: initialThumbnailCrop }
        : {},
    );
    const [cropModalSourceUrl, setCropModalSourceUrl] = useState<string | null>(
      null,
    );
    const [isUploadingCroppedThumbnail, setIsUploadingCroppedThumbnail] =
      useState(false);
    const [isDeletingThumbnail, setIsDeletingThumbnail] = useState(false);
    const [isUploadingContentImage, setIsUploadingContentImage] =
      useState(false);
    const [isContentMediaDragging, setIsContentMediaDragging] = useState(false);
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [draftToast, setDraftToast] = useState<{
      status: "success" | "error";
      closing: boolean;
    } | null>(null);
    const [activeTab, setActiveTab] = useState<EditorTab>("write");
    const [writePaneRatio, setWritePaneRatio] = useState(0.5);
    const [isWriteSplitResizing, setIsWriteSplitResizing] = useState(false);
    const [writeBodyHeight, setWriteBodyHeight] = useState(EDITOR_BODY_HEIGHT);
    const [error, setError] = useState<string | null>(null);
    const draftToastTimeoutRef = useRef<number | null>(null);
    const hasPromptedForLatestDraftRef = useRef(false);
    const hasRestoredDraftRef = useRef(false);
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
      return () => {
        if (thumbnailBlobUrlRef.current) {
          URL.revokeObjectURL(thumbnailBlobUrlRef.current);
        }
      };
    }, []);

    const adjustTextareaHeight = useCallback(() => {
      const textarea = contentRef.current;

      if (!textarea || activeTab !== "write") {
        return;
      }

      textarea.style.height = "auto";
      const snappedHeight = textarea.scrollHeight;
      const panelHeight = Math.max(EDITOR_BODY_HEIGHT, snappedHeight);

      textarea.style.height = `${snappedHeight}px`;
      textarea.style.overflowY = "hidden";

      setWriteBodyHeight((current) =>
        current === panelHeight ? current : panelHeight,
      );
    }, [activeTab]);

    useLayoutEffect(() => {
      adjustTextareaHeight();
    }, [adjustTextareaHeight, content, activeTab]);

    useEffect(() => {
      const textarea = contentRef.current;
      const container = writeSplitRef.current;

      if (!textarea || !container || activeTab !== "write") {
        return;
      }

      const observer = new ResizeObserver(() => {
        adjustTextareaHeight();
      });

      observer.observe(textarea);
      observer.observe(container);

      return () => {
        observer.disconnect();
      };
    }, [activeTab, adjustTextareaHeight]);

    const handleWriteSplitResizeStart = useCallback(
      (event: ReactPointerEvent<HTMLButtonElement>) => {
        const container = writeSplitRef.current;

        if (!container) {
          return;
        }

        writeSplitResizeStateRef.current = {
          startPointer: event.clientX,
          startRatio: writePaneRatio,
          containerWidth: container.getBoundingClientRect().width,
        };
        setIsWriteSplitResizing(true);
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      [writePaneRatio],
    );

    useEffect(() => {
      if (!isWriteSplitResizing) {
        return;
      }

      const handlePointerMove = (event: PointerEvent) => {
        const resizeState = writeSplitResizeStateRef.current;

        if (!resizeState || resizeState.containerWidth <= 0) {
          return;
        }

        const deltaRatio =
          (event.clientX - resizeState.startPointer) /
          resizeState.containerWidth;

        setWritePaneRatio(
          clamp(resizeState.startRatio + deltaRatio, 0.25, 0.75),
        );
      };

      const handlePointerUp = () => {
        writeSplitResizeStateRef.current = null;
        setIsWriteSplitResizing(false);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
    }, [isWriteSplitResizing]);

    useEffect(() => {
      if (
        mode !== "create" ||
        copiedFromPostId ||
        hasRestoredDraftRef.current
      ) {
        return;
      }

      let cancelled = false;

      const applyDraftToEditor = (draft: PostDraftPayload) => {
        currentDraftIdRef.current = draft.id ?? null;
        setTitle(draft.title ?? "");
        setContent(draft.content ?? "");
        setTags(
          filterVisibleCategoryNames(
            Array.isArray(draft.tags) ? draft.tags : [],
          ),
        );
        setSelectedFixedTag(draft.selectedFixedTag ?? fixedTagOptions[0] ?? "");
        setSelectedInquiryTag(
          draft.selectedInquiryTag ?? inquiryTagOptions[0] ?? "",
        );
        setIsBanner(Boolean(draft.isBanner));
        setIsSecret(Boolean(draft.isSecret));
        setSelectedThumbnailUrl(draft.thumbnailUrl ?? null);
        setSelectedThumbnailCrop(draft.thumbnailCrop ?? null);
        setThumbnailCrops(
          draft.thumbnailUrl && draft.thumbnailCrop
            ? { [draft.thumbnailUrl]: draft.thumbnailCrop }
            : {},
        );
        setAttachments(
          Array.isArray(draft.attachments)
            ? draft.attachments.map((attachment) => ({
                fileName: attachment.fileName,
                fileUrl: attachment.fileUrl,
                fileSize: attachment.fileSize ?? null,
              }))
            : [],
        );
      };

      const restoreDraft = async () => {
        if (!draftIdFromParams && hasPromptedForLatestDraftRef.current) {
          hasRestoredDraftRef.current = true;
          return;
        }

        if (!draftIdFromParams) {
          hasPromptedForLatestDraftRef.current = true;
        }

        try {
          const draft = draftIdFromParams
            ? await loadSyncedPostDraft(draftStorageKey, draftIdFromParams)
            : ((await loadSyncedPostDrafts(draftStorageKey))[0] ?? null);

          if (!draft || cancelled) {
            return;
          }

          if (!draftIdFromParams) {
            const shouldRestore = window.confirm(
              "임시저장된 글이 있습니다. 최근 임시저장 글을 이어서 작성하시겠습니까?",
            );

            if (!shouldRestore || cancelled) {
              return;
            }
          }

          applyDraftToEditor(draft);
        } finally {
          if (!cancelled) {
            hasRestoredDraftRef.current = true;
          }
        }
      };

      void restoreDraft();

      return () => {
        cancelled = true;
      };
    }, [copiedFromPostId, draftIdFromParams, draftStorageKey, mode]);

    async function removeThumbnailFromStorage(path?: string | null) {
      await removePostMedia(path);
    }

    function normalizeTagValue(value: string) {
      return value.trim().replace(/^#/, "").toLocaleLowerCase();
    }

    function addTag(rawValue: string) {
      const nextTag = normalizeTagValue(rawValue);
      if (!nextTag || isInternalUncategorizedCategory(nextTag)) return;

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

    const contentMediaUrls = useMemo(
      () => getContentMediaUrls(content),
      [content],
    );

    const thumbnailMediaUrls = useMemo(
      () => getThumbnailMediaUrls(content, contentMediaUrls),
      [content, contentMediaUrls],
    );

    const thumbnailOptionUrls = useMemo(() => {
      const seen = new Set<string>();
      const urls: string[] = [];

      const addUrl = (url?: string | null) => {
        const trimmed = url?.trim();

        if (!trimmed || seen.has(trimmed) || trimmed.startsWith("blob:")) {
          return;
        }

        seen.add(trimmed);
        urls.push(trimmed);
      };

      for (const url of thumbnailMediaUrls) {
        addUrl(url);
      }

      // 본문에 없는 단독 썸네일(사진 추가)만 1개까지 허용
      if (selectedThumbnailUrl && !seen.has(selectedThumbnailUrl)) {
        addUrl(selectedThumbnailUrl);
      }

      return urls;
    }, [selectedThumbnailUrl, thumbnailMediaUrls]);

    function isThumbnailOptionSelected(sourceUrl: string) {
      return selectedThumbnailUrl === sourceUrl;
    }

    useEffect(() => {
      setSelectedThumbnailUrl((current) => {
        if (!current || current === initialThumbnail) {
          return current;
        }

        const isValid = thumbnailOptionUrls.includes(current);

        return isValid ? current : null;
      });
    }, [contentMediaUrls, initialThumbnail, thumbnailOptionUrls]);

    function openThumbnailSourceForCrop(sourceUrl: string) {
      if (
        isSubmitting ||
        isUploadingContentImage ||
        isUploadingAttachment ||
        isUploadingCroppedThumbnail
      ) {
        return;
      }

      setError(null);
      thumbnailCropSourceUrlRef.current = sourceUrl;
      setCropModalSourceUrl(sourceUrl);
    }

    function handleThumbnailOptionClick(sourceUrl: string) {
      void openThumbnailSourceForCrop(sourceUrl);
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

    function buildContentMediaInsert(
      value: string,
      start: number,
      end: number,
      insertedText: string,
    ) {
      const before = value.slice(0, start);
      const after = value.slice(end);
      const prefix = before && !before.endsWith("\n") ? "\n\n" : "";
      const suffix = after && !after.startsWith("\n") ? "\n\n" : "";
      const insertStart = before.length + prefix.length;
      const insertEnd = insertStart + insertedText.length;

      return {
        nextContent: `${before}${prefix}${insertedText}${suffix}${after}`,
        insertStart,
        insertEnd,
      };
    }

    function insertContentMediaPlaceholder() {
      const textarea = contentRef.current;

      if (!textarea) {
        return false;
      }

      const { nextContent, insertStart, insertEnd } = buildContentMediaInsert(
        textarea.value,
        textarea.selectionStart,
        textarea.selectionEnd,
        CONTENT_MEDIA_PLACEHOLDER,
      );

      contentMediaPlaceholderRef.current = {
        start: insertStart,
        end: insertEnd,
      };
      setContent(nextContent);

      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(insertEnd, insertEnd);
      });

      return true;
    }

    function replaceContentMediaPlaceholder(markdown: string) {
      const range = contentMediaPlaceholderRef.current;

      setContent((prev) => {
        if (range) {
          return `${prev.slice(0, range.start)}${markdown}${prev.slice(range.end)}`;
        }

        const placeholderIndex = prev.indexOf(CONTENT_MEDIA_PLACEHOLDER);
        if (placeholderIndex === -1) {
          const separator = prev && !prev.endsWith("\n") ? "\n\n" : "";
          return `${prev}${separator}${markdown}`;
        }

        return `${prev.slice(0, placeholderIndex)}${markdown}${prev.slice(placeholderIndex + CONTENT_MEDIA_PLACEHOLDER.length)}`;
      });

      contentMediaPlaceholderRef.current = null;

      requestAnimationFrame(() => {
        const textarea = contentRef.current;
        if (!textarea) {
          return;
        }

        const cursor = range
          ? range.start + markdown.length
          : textarea.value.length;
        textarea.focus();
        textarea.setSelectionRange(cursor, cursor);
      });
    }

    function removeContentMediaPlaceholder() {
      const range = contentMediaPlaceholderRef.current;

      setContent((prev) => {
        if (range) {
          return `${prev.slice(0, range.start)}${prev.slice(range.end)}`;
        }

        const placeholderIndex = prev.indexOf(CONTENT_MEDIA_PLACEHOLDER);
        if (placeholderIndex === -1) {
          return prev;
        }

        return `${prev.slice(0, placeholderIndex)}${prev.slice(placeholderIndex + CONTENT_MEDIA_PLACEHOLDER.length)}`;
      });

      contentMediaPlaceholderRef.current = null;
    }

    function insertTextAtCursor(text: string) {
      const textarea = contentRef.current;

      if (!textarea) {
        setContent((prev) => `${prev}${prev ? "\n\n" : ""}${text}`);
        return;
      }

      const { nextContent, insertEnd } = buildContentMediaInsert(
        textarea.value,
        textarea.selectionStart,
        textarea.selectionEnd,
        text,
      );

      updateContentWithSelection(nextContent, insertEnd);
    }

    function handleContentKeyDown(
      event: React.KeyboardEvent<HTMLTextAreaElement>,
    ) {
      handleMarkdownEditorKeyDown(event, {
        isComposing: isContentComposingRef.current,
      });
    }

    async function insertContentMediaAtCursor(files: File[]) {
      const mediaFiles = getContentMediaFiles(files);

      if (mediaFiles.length === 0 || isUploadingContentImage || isSubmitting) {
        return;
      }

      if (!insertContentMediaPlaceholder()) {
        setContent((prev) => {
          const separator = prev && !prev.endsWith("\n") ? "\n\n" : "";
          const insertStart = prev.length + separator.length;
          contentMediaPlaceholderRef.current = {
            start: insertStart,
            end: insertStart + CONTENT_MEDIA_PLACEHOLDER.length,
          };
          return `${prev}${separator}${CONTENT_MEDIA_PLACEHOLDER}`;
        });
      }

      setIsUploadingContentImage(true);
      setError(null);

      try {
        const markdownBlocks: string[] = [];

        for (const file of mediaFiles) {
          const uploaded = await uploadPostMedia(file, "content");

          markdownBlocks.push(
            buildContentMediaMarkdown(file, uploaded.signedUrl),
          );
        }

        replaceContentMediaPlaceholder(markdownBlocks.join("\n\n"));
      } catch (uploadError) {
        removeContentMediaPlaceholder();
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : "본문 미디어 업로드 중 오류가 발생했습니다.";
        setError(message);
      } finally {
        setIsUploadingContentImage(false);
      }
    }

    async function handleContentImageChange(
      event: React.ChangeEvent<HTMLInputElement>,
    ) {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) return;

      await insertContentMediaAtCursor(files);
      event.target.value = "";
    }

    async function handleContentVideoChange(
      event: React.ChangeEvent<HTMLInputElement>,
    ) {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) return;

      await insertContentMediaAtCursor(files);
      event.target.value = "";
    }

    function handleContentDragOver(event: React.DragEvent<HTMLElement>) {
      if (!hasContentMediaInDataTransfer(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setIsContentMediaDragging(true);
    }

    function handleWriteAreaDragLeave(event: React.DragEvent<HTMLElement>) {
      const nextTarget = event.relatedTarget as Node | null;

      if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
        setIsContentMediaDragging(false);
      }
    }

    function handleContentDrop(event: React.DragEvent<HTMLElement>) {
      const mediaFiles = getContentMediaFiles(
        Array.from(event.dataTransfer.files ?? []),
      );

      setIsContentMediaDragging(false);

      if (mediaFiles.length === 0) {
        return;
      }

      event.preventDefault();

      if (activeTab !== "write") {
        setActiveTab("write");
      }

      contentRef.current?.focus();
      void insertContentMediaAtCursor(mediaFiles);
    }

    async function handleAttachmentChange(
      event: React.ChangeEvent<HTMLInputElement>,
    ) {
      const files = Array.from(event.target.files ?? []);
      if (files.length === 0) {
        return;
      }

      if (attachments.length + files.length > MAX_ATTACHMENT_COUNT) {
        setError(
          `첨부파일은 최대 ${MAX_ATTACHMENT_COUNT}개까지 등록할 수 있습니다.`,
        );
        event.target.value = "";
        return;
      }

      setIsUploadingAttachment(true);
      setError(null);

      try {
        const uploadedAttachments: EditorAttachment[] = [];

        for (const file of files) {
          if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
            throw new Error(
              `${file.name} 파일이 너무 큽니다. 첨부파일은 최대 20MB까지 업로드할 수 있습니다.`,
            );
          }

          const uploaded = await uploadPostMedia(file, "attachment");

          uploadedAttachments.push({
            fileName: file.name,
            fileUrl: uploaded.signedUrl,
            fileSize: file.size,
          });
        }

        setAttachments((prev) => [...prev, ...uploadedAttachments]);
        event.target.value = "";
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : "첨부파일 업로드 중 오류가 발생했습니다.";
        setError(message);
      } finally {
        setIsUploadingAttachment(false);
      }
    }

    async function removeAttachment(fileUrl: string) {
      const targetAttachment = attachments.find(
        (attachment) => attachment.fileUrl === fileUrl,
      );
      if (!targetAttachment) {
        return;
      }

      setAttachments((prev) =>
        prev.filter((attachment) => attachment.fileUrl !== fileUrl),
      );

      const storagePath = normalizePostStorageReference(fileUrl);
      if (storagePath?.includes("/attachments/")) {
        await removeThumbnailFromStorage(storagePath);
      }
    }

    async function handleContentPaste(
      event: React.ClipboardEvent<HTMLTextAreaElement>,
    ) {
      if (isUploadingContentImage || isSubmitting) return;

      const files: File[] = [];
      for (let i = 0; i < event.clipboardData.items.length; i++) {
        const item = event.clipboardData.items[i];
        if (
          item.kind === "file" &&
          (item.type.startsWith("image/") || item.type.startsWith("video/"))
        ) {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length === 0) return;

      event.preventDefault();
      await insertContentMediaAtCursor(files);
    }

    function closeThumbnailCropModal() {
      setCropModalSourceUrl(null);
      thumbnailCropSourceUrlRef.current = null;
      thumbnailUploadFileRef.current = null;

      if (thumbnailBlobUrlRef.current) {
        URL.revokeObjectURL(thumbnailBlobUrlRef.current);
        thumbnailBlobUrlRef.current = null;
      }
    }

    async function uploadOriginalThumbnailFile(file: File) {
      const uploaded = await uploadPostMedia(file, "thumbnail");

      return uploaded.signedUrl;
    }

    function openThumbnailFileForCrop(file: File) {
      if (thumbnailBlobUrlRef.current) {
        URL.revokeObjectURL(thumbnailBlobUrlRef.current);
      }

      const blobUrl = URL.createObjectURL(file);
      thumbnailBlobUrlRef.current = blobUrl;
      thumbnailCropSourceUrlRef.current = blobUrl;
      setCropModalSourceUrl(blobUrl);
    }

    function handleThumbnailImageFile(file: File) {
      thumbnailUploadFileRef.current = file;
      openThumbnailFileForCrop(file);
    }

    function handleThumbnailImageChange(
      event: React.ChangeEvent<HTMLInputElement>,
    ) {
      const file = event.target.files?.[0];

      if (!file || !isThumbnailImageFile(file)) {
        return;
      }

      event.target.value = "";
      handleThumbnailImageFile(file);
    }

    function handleThumbnailDragOver(event: React.DragEvent<HTMLElement>) {
      if (isBusy || !hasThumbnailImageInDataTransfer(event.dataTransfer)) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }

    function handleThumbnailDrop(event: React.DragEvent<HTMLElement>) {
      const files = getThumbnailImageFiles(
        Array.from(event.dataTransfer.files ?? []),
      );

      if (files.length === 0 || isBusy) {
        return;
      }

      event.preventDefault();
      handleThumbnailImageFile(files[0]);
    }

    async function handleThumbnailCropComplete(
      result: ImageCropCompleteResult,
    ) {
      setIsUploadingCroppedThumbnail(true);
      setError(null);

      try {
        const crop = normalizePostThumbnailCrop(
          result.pixelCrop,
          result.naturalWidth,
          result.naturalHeight,
        );
        const sourceKey =
          thumbnailCropSourceUrlRef.current ?? cropModalSourceUrl;
        let thumbnailUrl = sourceKey;

        if (sourceKey?.startsWith("blob:")) {
          const file = thumbnailUploadFileRef.current;

          if (!file) {
            throw new Error("썸네일 파일을 찾을 수 없습니다.");
          }

          thumbnailUrl = await uploadOriginalThumbnailFile(file);
        } else if (!thumbnailUrl || thumbnailUrl.startsWith("blob:")) {
          throw new Error("썸네일 원본을 찾을 수 없습니다.");
        }

        setThumbnailCrops((current) => ({
          ...current,
          [thumbnailUrl]: crop,
        }));
        setSelectedThumbnailUrl(thumbnailUrl);
        setSelectedThumbnailCrop(crop);
        closeThumbnailCropModal();
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : "썸네일 저장 중 오류가 발생했습니다.";
        setError(message);
      } finally {
        setIsUploadingCroppedThumbnail(false);
      }
    }

    function handleThumbnailCropReset() {
      const sourceKey = thumbnailCropSourceUrlRef.current ?? cropModalSourceUrl;

      if (!sourceKey) {
        closeThumbnailCropModal();
        return;
      }

      setThumbnailCrops((current) => {
        const next = { ...current };
        delete next[sourceKey];
        return next;
      });

      if (selectedThumbnailUrl === sourceKey) {
        setSelectedThumbnailCrop(null);
      }

      closeThumbnailCropModal();
    }

    async function handleThumbnailCropDelete() {
      const sourceKey = thumbnailCropSourceUrlRef.current ?? cropModalSourceUrl;

      setIsDeletingThumbnail(true);
      setError(null);

      try {
        const isContentMedia = sourceKey
          ? contentMediaUrls.includes(sourceKey)
          : false;

        if (sourceKey) {
          setThumbnailCrops((current) => {
            const next = { ...current };
            delete next[sourceKey];
            return next;
          });
        }

        setSelectedThumbnailUrl((current) => {
          if (!current || (sourceKey && current === sourceKey)) {
            return null;
          }

          return current;
        });

        if (sourceKey && selectedThumbnailUrl === sourceKey) {
          setSelectedThumbnailCrop(null);
        }

        if (!isContentMedia && sourceKey) {
          const path = normalizePostStorageReference(sourceKey);

          if (path?.includes("/thumbnails/")) {
            await removeThumbnailFromStorage(path);
          }
        }

        closeThumbnailCropModal();
      } catch {
        setError("썸네일 삭제 중 오류가 발생했습니다.");
      } finally {
        setIsDeletingThumbnail(false);
      }
    }

    async function handleSubmit() {
      const trimmedTitle = title.trim();
      const trimmedContent = content.trim();
      const categoryNames = filterVisibleCategoryNames(
        categoryLocked && fixedTagOptions.length > 0
          ? [selectedFixedTag].filter(Boolean)
          : tags,
      );
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

      const trimmedSecretPassword = secretPassword.trim();

      if (isSecret && trimmedSecretPassword) {
        const validationMessage = validatePostSecretPassword(
          trimmedSecretPassword,
        );

        if (validationMessage) {
          setError(validationMessage);
          return;
        }
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const submitTitle = buildInquiryTitle(trimmedTitle);
        const nextThumbnailUrl = selectedThumbnailUrl;
        const normalizedThumbnailUrl =
          normalizePostStorageReference(nextThumbnailUrl);
        const normalizedContent = normalizePostStorageMarkdown(trimmedContent);
        const normalizedAttachments = attachments.map((attachment) => ({
          ...attachment,
          fileUrl: normalizePostStorageReference(attachment.fileUrl) ?? "",
        }));
        const nextThumbnailCrop = nextThumbnailUrl
          ? (thumbnailCrops[nextThumbnailUrl] ?? selectedThumbnailCrop)
          : null;
        const endpoint =
          mode === "edit" ? `/api/posts/${postId}` : "/api/posts";
        const method = mode === "edit" ? "PUT" : "POST";
        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: submitTitle,
            content: normalizedContent,
            categoryName: resolvedCategoryName,
            categoryNames,
            isBanner,
            isSecret,
            ...(trimmedSecretPassword
              ? { secretPassword: trimmedSecretPassword }
              : {}),
            ...(mode === "edit" ? { isHidden } : {}),
            thumbnailUrl: normalizedThumbnailUrl,
            thumbnailCrop: nextThumbnailCrop,
            attachments: normalizedAttachments,
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
          normalizePostStorageReference(initialThumbnail) !==
            normalizedThumbnailUrl &&
          !normalizedContent.includes(
            normalizePostStorageReference(initialThumbnail) ?? initialThumbnail,
          )
        ) {
          const oldSavedThumbnailPath =
            normalizePostStorageReference(initialThumbnail);
          if (oldSavedThumbnailPath) {
            await removeThumbnailFromStorage(oldSavedThumbnailPath);
          }
        }

        if (mode === "create") {
          await clearSyncedPostDraft(
            draftStorageKey,
            currentDraftIdRef.current,
          );
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

        router.push(getLogFeedNewPostPath());
        router.refresh();
      } catch {
        setError("게시글 저장 중 오류가 발생했습니다.");
      } finally {
        setIsSubmitting(false);
      }
    }

    useImperativeHandle(
      ref,
      () => ({
        submit: () => {
          void handleSubmit();
        },
      }),
      [handleSubmit],
    );

    const isBusy =
      isSubmitting ||
      isUploadingContentImage ||
      isUploadingAttachment ||
      isUploadingCroppedThumbnail ||
      isDeletingThumbnail;

    useEffect(() => {
      onSubmittingChange?.(isBusy);
    }, [isBusy, onSubmittingChange]);

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
          thumbnailCrop: selectedThumbnailUrl
            ? (thumbnailCrops[selectedThumbnailUrl] ?? selectedThumbnailCrop)
            : null,
          attachments,
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

    const isInline = layout === "inline";
    const inlineSecretToggleButtonClassName =
      "box-border inline-flex h-7 items-center justify-center rounded-md border px-3 py-1.5 text-xs leading-none transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60";
    const postFooterOutlineButtonClassName =
      "hover:border-primary/30 hover:bg-primary/10 hover:text-foreground dark:hover:border-primary/30 dark:hover:bg-primary/10 dark:hover:text-foreground";

    const postActionToggleActiveClassName =
      "border-primary/30 bg-primary/10 text-foreground";
    const postFooterToggleActiveClassName =
      "!border-primary/30 !bg-primary/10 !text-foreground dark:!border-primary/30 dark:!bg-primary/10 dark:!text-foreground";

    const toggleSecret = () => {
      setIsSecret((current) => {
        if (current) {
          setSecretPassword("");
        }

        return !current;
      });
    };

    const secretPasswordPlaceholder = "비밀번호 입력";

    const renderSecretToggleControl = (variant: "inline" | "create") => {
      if (!isSecret) {
        if (variant === "create") {
          return (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isBusy}
              onClick={toggleSecret}
              className={cn("min-w-28", postFooterOutlineButtonClassName)}
              aria-pressed={false}
              aria-label="비밀글 설정"
            >
              비밀
            </Button>
          );
        }

        return (
          <button
            type="button"
            disabled={isBusy}
            onClick={toggleSecret}
            className={inlineSecretToggleButtonClassName}
            aria-pressed={false}
            aria-label="비밀글 설정"
          >
            비밀
          </button>
        );
      }

      const containerClassName = cn(
        "box-border inline-flex w-auto items-stretch overflow-hidden rounded-md border transition",
        variant === "create"
          ? cn(
              "bg-background shadow-xs",
              postFooterOutlineButtonClassName,
              postFooterToggleActiveClassName,
            )
          : cn(
              inlineSecretToggleButtonClassName,
              "h-7 w-auto justify-start p-0",
              postActionToggleActiveClassName,
            ),
      );

      const toggleRowClassName = cn(
        "inline-flex shrink-0 items-center border-0 bg-transparent font-medium transition hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60",
        variant === "create"
          ? "h-10 px-3 text-sm leading-none"
          : "h-7 px-3 py-1.5 text-xs leading-none",
      );

      const passwordInputClassName = cn(
        "shrink-0 border-0 bg-transparent outline-none placeholder:text-muted-foreground",
        variant === "create"
          ? "h-10 w-[7rem] px-1 text-sm tracking-[0.2em]"
          : "h-7 w-[6rem] px-0.5 text-xs tracking-[0.2em]",
      );

      return (
        <div className={containerClassName}>
          <button
            type="button"
            disabled={isBusy}
            onClick={toggleSecret}
            className={toggleRowClassName}
            aria-pressed
            aria-label="비밀글 해제"
          >
            비밀 해제
          </button>
          <div
            className={cn(
              "w-px shrink-0 self-stretch bg-border/80",
              variant === "create" ? "my-2" : "my-1.5",
            )}
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor="post-secret-password">
            비밀글 비밀번호
          </label>
          <input
            id="post-secret-password"
            type="password"
            value={secretPassword}
            onChange={(event) => setSecretPassword(event.target.value)}
            placeholder={secretPasswordPlaceholder}
            autoComplete="new-password"
            disabled={isBusy}
            className={passwordInputClassName}
          />
        </div>
      );
    };

    const inlineSecretToggleButton = renderSecretToggleControl("inline");

    const createSecretToggleButton = renderSecretToggleControl("create");

    const hiddenToggleButtonLabel = isHidden ? "숨김 해제" : "숨김";

    const inlineHiddenToggleButton = (
      <button
        type="button"
        disabled={isBusy}
        onClick={() => setIsHidden((current) => !current)}
        className={cn(
          inlineSecretToggleButtonClassName,
          isHidden && postActionToggleActiveClassName,
        )}
        aria-pressed={isHidden}
        aria-label={isHidden ? "게시글 숨김 해제" : "게시글 숨김 설정"}
      >
        {hiddenToggleButtonLabel}
      </button>
    );

    const inlineTitleStatusIndent =
      isInline && (isHidden || isSecret)
        ? getTitleStatusIndent(isHidden, isSecret)
        : undefined;

    const titleSection = isInline ? (
      <InlineTitleInput
        id="post-title"
        value={title}
        placeholder="제목을 입력하세요"
        textIndent={inlineTitleStatusIndent}
        onChange={(event) => setTitle(event.target.value)}
      />
    ) : (
      <input
        id="post-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목을 입력하세요"
        className="w-full border-0 bg-transparent px-0 py-0 text-3xl font-semibold tracking-tight text-foreground outline-none placeholder:text-zinc-400 sm:text-4xl"
      />
    );

    const titleStatusSection =
      isInline && (isHidden || isSecret) ? (
        <PostTitleStatusIcons showHidden={isHidden} showSecret={isSecret} />
      ) : null;

    const inquiryTagsSection = shouldShowInquiryTagField ? (
      <div
        className={
          isInline
            ? "flex flex-wrap items-center gap-2"
            : "flex min-h-10 w-full flex-wrap items-center gap-2"
        }
      >
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
    ) : null;

    const categoryTagsSection = shouldShowCategoryField ? (
      <div
        className={
          isInline
            ? "flex flex-wrap items-center gap-2"
            : "flex min-h-10 w-full flex-wrap items-center gap-2"
        }
      >
        {shouldShowCategoryBadge
          ? tags
              .filter((tag) => !isInternalUncategorizedCategory(tag))
              .map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 text-sm font-medium text-foreground"
                >
                  #{tag.toLocaleLowerCase()}
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
                </span>
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
            className={
              isInline
                ? "h-7 min-w-24 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                : "h-8 min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
            }
          />
        )}
      </div>
    ) : null;

    const tagsSection =
      inquiryTagsSection || categoryTagsSection ? (
        <div className={isInline ? "flex flex-wrap gap-2" : "space-y-2"}>
          {inquiryTagsSection}
          {categoryTagsSection}
        </div>
      ) : null;

    const hiddenFileInputs = (
      <>
        <input
          ref={contentImageInputRef}
          type="file"
          accept="image/*"
          multiple
          disabled={isBusy}
          onChange={handleContentImageChange}
          className="hidden"
        />
        <input
          ref={contentVideoInputRef}
          type="file"
          accept="video/*"
          multiple
          disabled={isBusy}
          onChange={handleContentVideoChange}
          className="hidden"
        />
        <input
          ref={contentAttachmentInputRef}
          type="file"
          multiple
          disabled={isUploadingAttachment || isSubmitting}
          onChange={handleAttachmentChange}
          className="hidden"
        />
        <input
          ref={thumbnailImageInputRef}
          type="file"
          accept="image/*"
          disabled={isBusy}
          onChange={handleThumbnailImageChange}
          className="hidden"
        />
      </>
    );

    const attachmentAddSection = (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">
          최대 {MAX_ATTACHMENT_COUNT}개, 파일당 20MB까지 업로드할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => contentAttachmentInputRef.current?.click()}
          disabled={
            isUploadingAttachment ||
            isSubmitting ||
            attachments.length >= MAX_ATTACHMENT_COUNT
          }
          className="rounded-md border border-border/80 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploadingAttachment ? "업로드 중..." : "파일 추가"}
        </button>
      </div>
    );

    const attachmentsPanel = (
      <div className="flex h-full flex-col p-5">
        {attachments.length > 0 ? (
          <div className="mb-4 max-h-[45%] w-full shrink-0 overflow-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                  <th className="px-4 py-2.5">파일명</th>
                  <th className="w-28 px-4 py-2.5 text-center">용량</th>
                  <th className="w-16 px-4 py-2.5 text-center">삭제</th>
                </tr>
              </thead>
              <tbody>
                {attachments.map((attachment) => {
                  const fileSizeLabel = formatAttachmentFileSize(
                    attachment.fileSize,
                  );

                  return (
                    <tr
                      key={attachment.fileUrl}
                      className="border-b border-border/70 last:border-b-0"
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        <span className="block truncate">
                          {attachment.fileName}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground">
                        {fileSizeLabel || "-"}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            void removeAttachment(attachment.fileUrl)
                          }
                          disabled={isUploadingAttachment || isSubmitting}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                          aria-label={`${attachment.fileName} 삭제`}
                        >
                          <X aria-hidden="true" className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="flex flex-1 items-center justify-center">
          {attachmentAddSection}
        </div>
      </div>
    );

    const contentTextarea = (
      <div className="min-w-0 self-start">
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
          onDragEnter={handleContentDragOver}
          onDragOver={handleContentDragOver}
          onDragLeave={handleWriteAreaDragLeave}
          onDrop={handleContentDrop}
          spellCheck={false}
          className="box-border block min-w-0 w-full resize-none rounded-none border-0 bg-transparent p-5 font-mono text-[15px] leading-7 text-foreground outline-none placeholder:text-zinc-400 overflow-y-hidden"
          placeholder="내용을 입력해 주세요."
        />
      </div>
    );

    const contentPreviewSource = content.replace(CONTENT_MEDIA_PLACEHOLDER, "");

    const contentPreviewPanel = contentPreviewSource.trim() ? (
      <MarkdownRenderer
        content={contentPreviewSource}
        className="text-[15px] leading-7 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_li:last-child]:mb-0 [&_ol:last-child]:mb-0 [&_p:last-child]:mb-0 [&_pre:last-child]:mb-0 [&_ul:last-child]:mb-0"
      />
    ) : (
      <p className="text-[15px] leading-7 text-muted-foreground">
        본문을 입력하면 여기에 미리보기가 표시됩니다.
      </p>
    );

    const writeSplitView = (
      <div
        ref={writeSplitRef}
        className="relative grid min-h-0 items-stretch"
        style={{
          gridTemplateColumns: `${writePaneRatio}fr ${1 - writePaneRatio}fr`,
          height: `${writeBodyHeight}px`,
        }}
        onDragEnter={handleContentDragOver}
        onDragOver={handleContentDragOver}
        onDragLeave={handleWriteAreaDragLeave}
        onDrop={handleContentDrop}
      >
        {contentTextarea}
        <div className="min-h-0 min-w-0 overflow-y-auto px-5 pt-5 pb-5">
          {contentPreviewPanel}
        </div>
        <button
          type="button"
          onPointerDown={handleWriteSplitResizeStart}
          aria-label="입력창과 미리보기 너비 조절"
          style={{ left: `${writePaneRatio * 100}%` }}
          className={cn(
            "absolute top-0 z-10 h-full w-1 -translate-x-1/2 cursor-ew-resize touch-none border-0 bg-transparent p-0",
            "before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:bg-border before:transition-colors",
            "hover:before:bg-primary",
            isWriteSplitResizing && "before:bg-primary",
          )}
        />
      </div>
    );

    const thumbnailPanel = (
      <div
        className="flex h-full flex-col p-5"
        onDragOver={handleThumbnailDragOver}
        onDrop={handleThumbnailDrop}
      >
        {thumbnailOptionUrls.length > 0 ? (
          <div className="scrollbar-orange flex shrink-0 gap-3 overflow-x-auto pb-1">
            {thumbnailOptionUrls.map((sourceUrl, index) => {
              const isSelected = isThumbnailOptionSelected(sourceUrl);
              const crop = thumbnailCrops[sourceUrl] ?? null;

              return (
                <button
                  key={sourceUrl}
                  type="button"
                  onClick={() => handleThumbnailOptionClick(sourceUrl)}
                  disabled={isBusy}
                  className={cn(
                    "group relative h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 transition disabled:cursor-not-allowed disabled:opacity-60",
                    isSelected
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/50",
                  )}
                  aria-label={`썸네일 ${index + 1} 선택`}
                  aria-pressed={isSelected}
                >
                  <PostCroppedThumbnail
                    src={sourceUrl}
                    alt={`썸네일 후보 ${index + 1}`}
                    crop={crop}
                    unoptimized
                    className="h-full w-full"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Pencil className="h-5 w-5 text-white" aria-hidden="true" />
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => thumbnailImageInputRef.current?.click()}
              disabled={isBusy}
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-border bg-background px-1 text-center text-xs font-medium text-muted-foreground transition hover:border-primary/50 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploadingCroppedThumbnail ? "처리 중..." : "사진 추가"}
            </button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              본문에 추가한 이미지·GIF 또는 직접 올린 사진을 선택한 뒤 자르기를
              적용해 썸네일로 사용할 수 있습니다.
            </p>
            <button
              type="button"
              onClick={() => thumbnailImageInputRef.current?.click()}
              disabled={isBusy}
              className="rounded-md border border-border/80 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploadingCroppedThumbnail ? "처리 중..." : "사진 추가"}
            </button>
          </div>
        )}
      </div>
    );

    const showEditorPanelBackground =
      activeTab === "write" ||
      activeTab === "attachments" ||
      activeTab === "thumbnail";

    const editorPanelHeight =
      activeTab === "write" ? writeBodyHeight : EDITOR_BODY_HEIGHT;

    const editorPanel = (
      <div
        className={cn(
          showEditorPanelBackground &&
            "rounded-md border border-border/80 bg-muted/15",
          activeTab === "write" || showEditorPanelBackground
            ? "h-[var(--post-editor-panel-height)] overflow-hidden"
            : null,
        )}
        style={
          {
            "--post-editor-panel-height": `${editorPanelHeight}px`,
          } as React.CSSProperties
        }
      >
        {activeTab === "thumbnail" ? thumbnailPanel : null}
        {activeTab === "attachments" ? attachmentsPanel : null}
        {activeTab === "write" ? writeSplitView : null}
      </div>
    );

    const contentSection = (
      <div className="space-y-3">
        {copiedFromPost ? (
          <div className={isInline ? "" : "pt-1"}>
            <CopiedPostCard copiedPost={copiedFromPost} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-b border-border/70">
          <button
            type="button"
            onClick={() => setActiveTab("thumbnail")}
            className={`w-20 border-b-2 px-1 pb-2 text-center text-sm font-medium transition ${
              activeTab === "thumbnail"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground"
            }`}
          >
            썸네일
          </button>
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
            onClick={() => setActiveTab("attachments")}
            className={`w-20 border-b-2 px-1 pb-2 text-center text-sm font-medium transition ${
              activeTab === "attachments"
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground"
            }`}
          >
            첨부파일
          </button>
        </div>

        {editorPanel}
      </div>
    );

    const footerExtrasSection = (
      <>
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
      </>
    );

    const secretSection = isInline ? inlineSecretToggleButton : null;
    const hiddenSection =
      isInline && mode === "edit" ? inlineHiddenToggleButton : null;

    const errorSection = error ? (
      <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </p>
    ) : null;

    const draftToastPortal =
      draftToast && typeof document !== "undefined"
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
        : null;

    const thumbnailCropSourceKey =
      thumbnailCropSourceUrlRef.current ?? cropModalSourceUrl;
    const canDeleteThumbnailCrop = Boolean(
      thumbnailCropSourceKey &&
        !contentMediaUrls.includes(thumbnailCropSourceKey),
    );

    const thumbnailCropModalInitialCrop = cropModalSourceUrl
      ? (thumbnailCrops[cropModalSourceUrl] ??
        (selectedThumbnailUrl === cropModalSourceUrl
          ? selectedThumbnailCrop
          : null))
      : null;

    const thumbnailCropModal = cropModalSourceUrl ? (
      <ImageCropModal
        open
        imageSrc={cropModalSourceUrl}
        aspect={POST_THUMBNAIL_ASPECT}
        initialCrop={thumbnailCropModalInitialCrop}
        onClose={closeThumbnailCropModal}
        onComplete={handleThumbnailCropComplete}
        onReset={
          thumbnailCropModalInitialCrop ? handleThumbnailCropReset : undefined
        }
        onDelete={
          canDeleteThumbnailCrop
            ? () => void handleThumbnailCropDelete()
            : undefined
        }
        isSaving={isUploadingCroppedThumbnail}
        isDeleting={isDeletingThumbnail}
      />
    ) : null;

    if (isInline && renderInline) {
      return (
        <>
          {hiddenFileInputs}
          {renderInline({
            titleSection,
            titleStatusSection,
            titleStatusIndent: inlineTitleStatusIndent,
            tagsSection,
            contentSection,
            secretSection,
            hiddenSection,
            footerExtrasSection,
            errorSection,
          })}
          {thumbnailCropModal}
          {draftToastPortal}
        </>
      );
    }

    return (
      <section className="space-y-6">
        <div className="space-y-2 border-b border-border/70 pb-2">
          {titleSection}
        </div>

        {inquiryTagsSection ? (
          <div className="border-b border-border/70">{inquiryTagsSection}</div>
        ) : null}

        {categoryTagsSection ? (
          <div className="border-b border-border/70">{categoryTagsSection}</div>
        ) : null}

        {hiddenFileInputs}

        {contentSection}

        {footerExtrasSection}

        {errorSection}

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isBusy}
            onClick={() => {
              if (onCancel) {
                onCancel();
                return;
              }

              router.back();
            }}
            className={cn("min-w-24", postFooterOutlineButtonClassName)}
          >
            {cancelLabel}
          </Button>

          <div className="flex items-center gap-2">
            {mode === "create"
              ? createSecretToggleButton
              : inlineSecretToggleButton}
            {mode === "create" ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isBusy || isSavingDraft}
                onClick={handleSaveDraft}
                className={cn("min-w-28", postFooterOutlineButtonClassName)}
              >
                {isSavingDraft ? "임시저장 완료" : "임시저장"}
              </Button>
            ) : null}
            <Button
              type="button"
              size="lg"
              disabled={isBusy}
              onClick={handleSubmit}
              className="min-w-28 text-white dark:text-white"
            >
              {isSubmitting
                ? submittingLabel
                : isUploadingContentImage ||
                    isUploadingAttachment ||
                    isUploadingCroppedThumbnail
                  ? "업로드 중..."
                  : submitLabel}
            </Button>
          </div>
        </div>

        {thumbnailCropModal}
        {draftToastPortal}
      </section>
    );
  },
);

export default PostEditor;
