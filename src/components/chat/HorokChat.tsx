"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Crown,
  Headphones,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import MarkdownRenderer from "@/components/posts/MarkdownRenderer";
import type { HorokCoteProblem } from "@/lib/horok-cote-shared";
import {
  getHorokCoteChatIntroMessage,
  getHorokCoteChatThreadTitle,
} from "@/lib/horok-cote-shared";
import { POST_THUMBNAIL_BUCKET } from "@/lib/post-thumbnails";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type ChatThreadSummary = {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  platform?: ThreadCategory;
};

type ChatPayload = {
  isAuthenticated: boolean;
  activeThreadId: string | null;
  threads: ChatThreadSummary[];
  messages: ChatUIMessage[];
  handoff?: ChatHandoffMeta | null;
};

type ChatHandoffMeta = {
  isAdminView: boolean;
  requester: {
    id: string;
    name: string;
    image: string | null;
  };
};

type HorokChatProps = {
  variant?: "floating" | "embedded";
  problem?: HorokCoteProblem;
};

type ChatUIMessage = UIMessage & {
  createdAt?: string;
  sender?: {
    id: string;
    name: string;
    image: string | null;
    role: "USER" | "ADMIN";
  } | null;
};

type ThreadCategory = "all" | "tech" | "cote" | "handoff";

type FloatingPosition = {
  x: number;
  y: number;
};

type FloatingSize = {
  width: number;
  height: number;
};

type ThreadSwipeState = {
  threadId: string;
  startX: number;
  deltaX: number;
  isPointerDown: boolean;
  openDirection?: "left" | "right" | null;
};

type ResizeDirection =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

const THREAD_PLATFORM_STORAGE_KEY = "horok-chat-thread-platforms";
const COTE_PROBLEM_THREAD_STORAGE_KEY = "horok-chat-cote-problem-threads";
const OPEN_CHAT_THREAD_EVENT = "horok-open-chat-thread";
const FLOATING_BUTTON_SIZE = 64;
const FLOATING_PANEL_GAP = 12;
const FLOATING_VIEWPORT_MARGIN = 24;
const FLOATING_DEFAULT_SIZE: FloatingSize = {
  width: 310,
  height: 740,
};
const FLOATING_MOBILE_DEFAULT_HEIGHT = 500;
const FLOATING_MIN_SIZE: FloatingSize = {
  width: 250,
  height: 280,
};
const CHAT_INPUT_MIN_HEIGHT = 40;
const CHAT_INPUT_MAX_HEIGHT = 240;
const CHAT_BOTTOM_STICK_THRESHOLD = 80;
const CHAT_SUGGESTED_QUESTIONS = [
  "넌 누구야?",
  "호록 컴퍼니는 어떤 곳이야?",
  "코딩테스트 공부는 어떻게 시작해?",
];

const INITIAL_MESSAGES: ChatUIMessage[] = [
  {
    id: "horok-welcome",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "안녕하세요! 호록이에요. 궁금한 점이나 필요한 내용을 편하게 물어보세요.",
      },
    ],
  },
];

function buildInitialMessages(problem?: HorokCoteProblem): ChatUIMessage[] {
  if (!problem) {
    return INITIAL_MESSAGES;
  }

  return [
    {
      id: `horok-cote-${problem.slug}`,
      role: "assistant",
      parts: [
        {
          type: "text",
          text: getHorokCoteChatIntroMessage(problem),
        },
      ],
    },
  ];
}

function getMessageText(
  parts: Array<{ type: string; text?: string; state?: string }> = [],
) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

const CHAT_REVEAL_MIN_DURATION_MS = 260;
const CHAT_REVEAL_MAX_DURATION_MS = 1800;
const CHAT_REVEAL_MS_PER_CHARACTER = 18;
const CHAT_MARKDOWN_CLASS_NAME =
  "text-inherit !leading-5 [&_a]:text-inherit [&_a]:underline [&_blockquote]:!my-1 [&_blockquote]:border-current/20 [&_blockquote]:py-0.5 [&_blockquote]:text-inherit/80 [&_code]:rounded-none [&_code]:bg-transparent [&_code]:px-0 [&_code]:py-0 [&_code]:text-inherit [&_h1]:!mt-1.5 [&_h1]:!mb-1 [&_h1]:text-base [&_h2]:!mt-1.5 [&_h2]:!mb-1 [&_h2]:text-sm [&_h3]:!mt-1 [&_h3]:!mb-0.5 [&_h3]:text-sm [&_img]:!my-1 [&_img]:rounded-2xl [&_ol]:!my-1 [&_ol]:pl-5 [&_p]:!my-0 [&_p]:!leading-5 [&_p+p]:!mt-0.5 [&_pre]:!my-1 [&_table]:!my-1 [&_td]:border-current/15 [&_th]:border-current/15 [&_th]:bg-black/5 [&_ul]:!my-1 [&_ul]:pl-5";

function getChatRevealDuration(characterCount: number) {
  return Math.min(
    CHAT_REVEAL_MAX_DURATION_MS,
    Math.max(
      CHAT_REVEAL_MIN_DURATION_MS,
      characterCount * CHAT_REVEAL_MS_PER_CHARACTER,
    ),
  );
}

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}

function isNearScrollBottom(element: HTMLDivElement) {
  return (
    element.scrollHeight - element.scrollTop - element.clientHeight <=
    CHAT_BOTTOM_STICK_THRESHOLD
  );
}

function getTextareaAutoHeight(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  const nextHeight = Math.min(
    CHAT_INPUT_MAX_HEIGHT,
    Math.max(CHAT_INPUT_MIN_HEIGHT, textarea.scrollHeight),
  );
  textarea.style.height = `${nextHeight}px`;
  return nextHeight;
}

function AnimatedChatMarkdown({
  content,
  className,
  shouldAnimate,
}: {
  content: string;
  className?: string;
  shouldAnimate: boolean;
}) {
  const [displayedContent, setDisplayedContent] = useState(
    shouldAnimate ? "" : content,
  );
  const displayedContentRef = useRef(displayedContent);

  useEffect(() => {
    if (!shouldAnimate) {
      displayedContentRef.current = content;
      setDisplayedContent(content);
      return;
    }

    const targetCharacters = Array.from(content);
    const currentContent = displayedContentRef.current;
    const currentCharacters = content.startsWith(currentContent)
      ? Array.from(currentContent)
      : [];
    const startLength = Math.min(
      currentCharacters.length,
      targetCharacters.length,
    );
    const remainingLength = targetCharacters.length - startLength;

    if (remainingLength <= 0) {
      displayedContentRef.current = content;
      setDisplayedContent(content);
      return;
    }

    const startedAt = performance.now();
    const duration = getChatRevealDuration(remainingLength);
    let animationFrameId = 0;

    function animate(now: number) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const nextLength =
        startLength + Math.ceil(remainingLength * easeOutCubic(progress));
      const nextContent = targetCharacters.slice(0, nextLength).join("");

      displayedContentRef.current = nextContent;
      setDisplayedContent(nextContent);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(animate);
      }
    }

    animationFrameId = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [content, shouldAnimate]);

  return <MarkdownRenderer content={displayedContent} className={className} />;
}

function formatThreadTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatMessageTime(iso: string | null | undefined) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getMessageDateKey(iso: string | null | undefined) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMessageDateBadge(iso: string | null | undefined) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function sortThreadsByRecentActivity(threads: ChatThreadSummary[]) {
  return [...threads].sort((a, b) => {
    const updatedAtDiff =
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();

    if (updatedAtDiff !== 0) {
      return updatedAtDiff;
    }

    return Number(b.id) - Number(a.id);
  });
}

function getThreadIdentity(thread: ChatThreadSummary) {
  if (thread.platform === "cote" && /^\d+번\s+/.test(thread.title)) {
    return `cote-problem:${thread.title}`;
  }

  return `thread:${thread.id}`;
}

function sortUniqueThreadsByRecentActivity(threads: ChatThreadSummary[]) {
  const sortedThreads = sortThreadsByRecentActivity(threads);
  const seenThreadIdentities = new Set<string>();

  return sortedThreads.filter((thread) => {
    const identity = getThreadIdentity(thread);

    if (seenThreadIdentities.has(identity)) {
      return false;
    }

    seenThreadIdentities.add(identity);
    return true;
  });
}

function readThreadPlatformMap() {
  if (typeof window === "undefined") {
    return {} as Record<string, Exclude<ThreadCategory, "all">>;
  }

  try {
    const stored = window.localStorage.getItem(THREAD_PLATFORM_STORAGE_KEY);
    if (!stored) {
      return {};
    }

    return JSON.parse(stored) as Record<string, Exclude<ThreadCategory, "all">>;
  } catch {
    return {};
  }
}

function writeThreadPlatformMap(
  nextMap: Record<string, Exclude<ThreadCategory, "all">>,
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    THREAD_PLATFORM_STORAGE_KEY,
    JSON.stringify(nextMap),
  );
}

function readCoteProblemThreadMap() {
  if (typeof window === "undefined") {
    return {} as Record<string, string>;
  }

  try {
    const stored = window.localStorage.getItem(COTE_PROBLEM_THREAD_STORAGE_KEY);
    if (!stored) {
      return {};
    }

    return JSON.parse(stored) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeCoteProblemThreadMap(nextMap: Record<string, string>) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    COTE_PROBLEM_THREAD_STORAGE_KEY,
    JSON.stringify(nextMap),
  );
}

function clampFloatingSize(size: FloatingSize) {
  if (typeof window === "undefined") {
    return size;
  }

  return {
    width: Math.min(
      Math.max(size.width, FLOATING_MIN_SIZE.width),
      Math.max(FLOATING_MIN_SIZE.width, window.innerWidth - 24),
    ),
    height: Math.min(
      Math.max(size.height, FLOATING_MIN_SIZE.height),
      Math.max(FLOATING_MIN_SIZE.height, window.innerHeight - 120),
    ),
  };
}

function getFloatingDefaultSize(_pathname: string | null): FloatingSize {
  if (typeof window === "undefined") {
    return FLOATING_DEFAULT_SIZE;
  }

  const isMobileViewport = window.innerWidth < 640;

  return clampFloatingSize({
    width: FLOATING_DEFAULT_SIZE.width,
    height: isMobileViewport
      ? FLOATING_MOBILE_DEFAULT_HEIGHT
      : FLOATING_DEFAULT_SIZE.height,
  });
}

function clampFloatingPosition(
  position: FloatingPosition,
  size: FloatingSize,
  isOpen: boolean,
) {
  if (typeof window === "undefined") {
    return position;
  }

  const minX = isOpen ? Math.max(0, size.width - FLOATING_BUTTON_SIZE) : 0;
  const maxX = Math.max(minX, window.innerWidth - FLOATING_BUTTON_SIZE);
  const minY = isOpen ? size.height + FLOATING_PANEL_GAP : 0;
  const maxY = Math.max(minY, window.innerHeight - FLOATING_BUTTON_SIZE);

  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getVisibleMessages(
  messages: ChatUIMessage[],
  sessionStatus: "authenticated" | "loading" | "unauthenticated",
  activeThreadId: string | null,
  fallbackMessages: ChatUIMessage[],
  hasLoadedChatState: boolean,
): ChatUIMessage[] {
  if (sessionStatus !== "authenticated") {
    return messages.length > 0 ? messages : fallbackMessages;
  }

  if (!hasLoadedChatState && messages.length === 0) {
    return [];
  }

  if (!activeThreadId) {
    return messages.length > 0 ? messages : fallbackMessages;
  }

  return messages.length > 0 ? messages : fallbackMessages;
}

export default function HorokChat({
  variant = "floating",
  problem,
}: HorokChatProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status: sessionStatus } = useSession();
  const platform = pathname?.startsWith("/horok-cote") ? "cote" : "tech";
  const initialMessages = useMemo(
    () => buildInitialMessages(problem),
    [problem],
  );
  const chatInitialMessages = useMemo(
    () => (sessionStatus === "unauthenticated" ? initialMessages : []),
    [initialMessages, sessionStatus],
  );
  const isEmbedded = variant === "embedded";
  const hasCloseButton = !isEmbedded;
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [hasLoadedChatState, setHasLoadedChatState] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [view, setView] = useState<"chat" | "threads">("chat");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const [messageTimes, setMessageTimes] = useState<Record<string, string>>({});
  const [threadCategory, setThreadCategory] = useState<ThreadCategory>("all");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [handoffMeta, setHandoffMeta] = useState<ChatHandoffMeta | null>(null);
  const [handoffMessage, setHandoffMessage] = useState<string | null>(null);
  const [isHandoffDraftMode, setIsHandoffDraftMode] = useState(false);
  const [hasSentHandoffMessage, setHasSentHandoffMessage] = useState(false);
  const [isRequestingHandoff, setIsRequestingHandoff] = useState(false);
  const [isSavingHandoffMessage, setIsSavingHandoffMessage] = useState(false);
  const [floatingPosition, setFloatingPosition] =
    useState<FloatingPosition | null>(null);
  const [floatingSize, setFloatingSize] = useState<FloatingSize>(
    FLOATING_DEFAULT_SIZE,
  );
  const [threadSwipeState, setThreadSwipeState] =
    useState<ThreadSwipeState | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [inputHeight, setInputHeight] = useState(CHAT_INPUT_MIN_HEIGHT);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const activeThreadIdRef = useRef<string | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragStateRef = useRef<{
    pointerOffsetX: number;
    pointerOffsetY: number;
  } | null>(null);
  const dragStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedFloatingRef = useRef(false);
  const resizeStateRef = useRef<{
    direction: ResizeDirection;
    startWidth: number;
    startHeight: number;
    startClientX: number;
    startClientY: number;
    startPositionX: number;
    startPositionY: number;
  } | null>(null);
  const floatingSizeRef = useRef(FLOATING_DEFAULT_SIZE);
  const isOpenRef = useRef(false);
  const viewportSizeRef = useRef({ width: 0, height: 0 });
  const problemThreadRequestRef = useRef<string | null>(null);
  const notificationThreadRequestRef = useRef<string | null>(null);
  const shouldKeepNotificationThreadOpenRef = useRef(false);
  const inputResizeRef = useRef<{
    startY: number;
    startHeight: number;
  } | null>(null);

  const {
    messages: rawMessages,
    sendMessage,
    setMessages: rawSetMessages,
    status,
    error,
    clearError,
  } = useChat({
    messages: chatInitialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages: nextMessages }) => ({
        body: {
          platform,
          threadId: activeThreadIdRef.current,
          message: nextMessages[nextMessages.length - 1],
        },
      }),
    }),
  });
  const messages = rawMessages as ChatUIMessage[];
  const setMessages = rawSetMessages as (messages: ChatUIMessage[]) => void;

  const visibleMessages = useMemo(
    () =>
      getVisibleMessages(
        messages,
        sessionStatus,
        threadId,
        initialMessages,
        hasLoadedChatState,
      ),
    [hasLoadedChatState, initialMessages, messages, sessionStatus, threadId],
  );
  const isAssistantResponding =
    status === "submitted" || status === "streaming";
  const isLoading =
    isAssistantResponding ||
    isHistoryLoading ||
    isCreatingThread ||
    isSavingHandoffMessage;
  const hasMessages = useMemo(
    () =>
      visibleMessages.some(
        (message) => getMessageText(message.parts).trim().length > 0,
      ),
    [visibleMessages],
  );
  const visibleMessageScrollKey = useMemo(
    () =>
      visibleMessages
        .map(
          (message) => `${message.id}:${getMessageText(message.parts).length}`,
        )
        .join("|"),
    [visibleMessages],
  );
  const isThreadMode = sessionStatus === "authenticated" && view === "threads";
  const isPanelOpen = isEmbedded || isOpen;
  const isAdminHandoffView = Boolean(handoffMeta?.isAdminView);
  const threadCategories = useMemo(
    () =>
      (session?.user.role === "ADMIN"
        ? ["all", "tech", "cote", "handoff"]
        : ["all", "tech", "cote"]) as ThreadCategory[],
    [session?.user.role],
  );
  const searchableMessages = useMemo(
    () =>
      visibleMessages
        .map((message) => ({
          id: message.id,
          text: getMessageText(message.parts).trim(),
        }))
        .filter((message) => message.text.length > 0),
    [visibleMessages],
  );
  const searchMatches = useMemo(() => {
    const normalized = searchQuery.trim().toLocaleLowerCase();
    if (!normalized) {
      return [];
    }

    return searchableMessages.flatMap((message) => {
      const normalizedText = message.text.toLocaleLowerCase();
      const matches: Array<{
        messageId: string;
        occurrenceIndexInMessage: number;
      }> = [];
      let searchStartIndex = 0;
      let occurrenceIndexInMessage = 0;

      while (searchStartIndex < normalizedText.length) {
        const matchedIndex = normalizedText.indexOf(
          normalized,
          searchStartIndex,
        );

        if (matchedIndex === -1) {
          break;
        }

        matches.push({
          messageId: message.id,
          occurrenceIndexInMessage,
        });
        occurrenceIndexInMessage += 1;
        searchStartIndex = matchedIndex + normalized.length;
      }

      return matches;
    });
  }, [searchQuery, searchableMessages]);
  const matchedMessageIds = useMemo(
    () => [...new Set(searchMatches.map((match) => match.messageId))],
    [searchMatches],
  );
  const activeSearchMatch =
    searchMatches.length > 0
      ? searchMatches[Math.min(activeSearchIndex, searchMatches.length - 1)]
      : null;
  const activeMatchedMessageId = activeSearchMatch?.messageId ?? null;
  const isFloatingPanelLeftOfCenter = useMemo(() => {
    if (isEmbedded || !floatingPosition || typeof window === "undefined") {
      return false;
    }

    const panelLeft = isOpen
      ? floatingPosition.x + FLOATING_BUTTON_SIZE - floatingSize.width
      : floatingPosition.x;
    const panelWidth = isOpen ? floatingSize.width : FLOATING_BUTTON_SIZE;
    const buttonCenter = panelLeft + panelWidth / 2;

    return buttonCenter < window.innerWidth / 2;
  }, [floatingPosition, floatingSize.width, isEmbedded, isOpen]);
  const filteredThreads = useMemo(() => {
    const nextThreads =
      threadCategory === "all"
        ? threads
        : threads.filter((thread) => thread.platform === threadCategory);

    return sortUniqueThreadsByRecentActivity(nextThreads);
  }, [threadCategory, threads]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 입력 내용과 패널 폭이 바뀔 때 줄바꿈 기준에 맞춰 높이를 다시 계산합니다.
  useLayoutEffect(() => {
    const textarea = inputRef.current;
    if (!textarea || !isPanelOpen || isThreadMode) {
      return;
    }

    setInputHeight(getTextareaAutoHeight(textarea));
  }, [floatingSize.width, input, isPanelOpen, isThreadMode]);

  useEffect(() => {
    if (!isPanelOpen || isThreadMode || isSearchOpen) {
      return;
    }

    if (!shouldStickToBottomRef.current) {
      return;
    }

    if (!visibleMessageScrollKey && !isLoading) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: status === "streaming" ? "auto" : "smooth",
    });
  }, [
    isLoading,
    isPanelOpen,
    isSearchOpen,
    isThreadMode,
    status,
    visibleMessageScrollKey,
  ]);

  useEffect(() => {
    if (!isEmbedded || isThreadMode || isSearchOpen) {
      return;
    }

    const viewport = messagesViewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") {
      return;
    }

    let animationFrameId = 0;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || !shouldStickToBottomRef.current) {
        return;
      }

      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) {
        return;
      }

      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight;
      });
    });

    observer.observe(viewport);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, [isEmbedded, isSearchOpen, isThreadMode]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isHandoffDraftMode && isPanelOpen) {
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isHandoffDraftMode, isPanelOpen]);

  useEffect(() => {
    if (isEmbedded || typeof window === "undefined") {
      return;
    }

    viewportSizeRef.current = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const nextSize = getFloatingDefaultSize(pathname);
    setFloatingSize(nextSize);
    setFloatingPosition({
      x: window.innerWidth - FLOATING_BUTTON_SIZE - FLOATING_VIEWPORT_MARGIN,
      y: window.innerHeight - FLOATING_BUTTON_SIZE - FLOATING_VIEWPORT_MARGIN,
    });
  }, [isEmbedded, pathname]);

  useEffect(() => {
    if (!isPanelOpen || isThreadMode) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [isPanelOpen, isThreadMode]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);

    return () => window.clearTimeout(timer);
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen || !activeMatchedMessageId) {
      return;
    }

    messageRefs.current[activeMatchedMessageId]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [activeMatchedMessageId, isSearchOpen]);

  useEffect(() => {
    if (isEmbedded || typeof window === "undefined") {
      return;
    }

    function handleMouseMove(event: MouseEvent) {
      if (dragStateRef.current) {
        if (dragStartPointRef.current) {
          const movedX = event.clientX - dragStartPointRef.current.x;
          const movedY = event.clientY - dragStartPointRef.current.y;
          hasDraggedFloatingRef.current =
            hasDraggedFloatingRef.current || Math.hypot(movedX, movedY) > 4;
        }

        const containerLeft =
          event.clientX - dragStateRef.current.pointerOffsetX;
        const containerTop =
          event.clientY - dragStateRef.current.pointerOffsetY;
        const nextPosition = clampFloatingPosition(
          {
            x: containerLeft,
            y: containerTop,
          },
          floatingSize,
          isOpen,
        );

        setFloatingPosition(nextPosition);
        return;
      }

      if (resizeStateRef.current) {
        const {
          direction,
          startWidth,
          startHeight,
          startClientX,
          startClientY,
          startPositionX,
          startPositionY,
        } = resizeStateRef.current;
        const deltaX = event.clientX - startClientX;
        const deltaY = event.clientY - startClientY;
        const startRight = startPositionX + FLOATING_BUTTON_SIZE;
        const startLeft = startRight - startWidth;
        const startBottom = startPositionY - FLOATING_PANEL_GAP;
        const startTop = startBottom - startHeight;
        const minRight = startLeft + FLOATING_MIN_SIZE.width;
        const maxBottom =
          window.innerHeight - FLOATING_BUTTON_SIZE - FLOATING_PANEL_GAP;
        const minBottom = startTop + FLOATING_MIN_SIZE.height;

        let nextLeft = startLeft;
        let nextRight = startRight;
        let nextTop = startTop;
        let nextBottom = startBottom;

        if (direction.includes("left")) {
          nextLeft = Math.min(
            startLeft + deltaX,
            startRight - FLOATING_MIN_SIZE.width,
          );
          nextLeft = Math.max(0, nextLeft);
        }

        if (direction.includes("right")) {
          nextRight = Math.max(startRight + deltaX, minRight);
          nextRight = Math.min(window.innerWidth, nextRight);
        }

        if (direction.includes("top")) {
          nextTop = Math.min(
            startTop + deltaY,
            startBottom - FLOATING_MIN_SIZE.height,
          );
          nextTop = Math.max(0, nextTop);
        }

        if (direction.includes("bottom")) {
          nextBottom = Math.max(startBottom + deltaY, minBottom);
          nextBottom = Math.min(maxBottom, nextBottom);
        }

        const nextSize = {
          width: nextRight - nextLeft,
          height: nextBottom - nextTop,
        };
        setFloatingSize(nextSize);
      }
    }

    function handleMouseUp() {
      dragStateRef.current = null;
      dragStartPointRef.current = null;
      resizeStateRef.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [floatingSize, isEmbedded, isOpen]);

  useEffect(() => {
    floatingSizeRef.current = floatingSize;
  }, [floatingSize]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (isEmbedded || typeof window === "undefined") {
      return;
    }

    function handleResize() {
      const previousViewport = viewportSizeRef.current;
      const widthDelta = window.innerWidth - previousViewport.width;
      const heightDelta = window.innerHeight - previousViewport.height;
      const nextSize = clampFloatingSize(floatingSizeRef.current);

      viewportSizeRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      setFloatingSize(nextSize);
      setFloatingPosition((currentPosition) =>
        currentPosition
          ? clampFloatingPosition(
              {
                x: currentPosition.x + widthDelta,
                y: currentPosition.y + heightDelta,
              },
              nextSize,
              isOpenRef.current,
            )
          : currentPosition,
      );
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isEmbedded]);

  useEffect(() => {
    if (
      isEmbedded ||
      !isOpen ||
      sessionStatus !== "authenticated" ||
      problem ||
      searchParams.get("chatThreadId")
    ) {
      return;
    }

    if (shouldKeepNotificationThreadOpenRef.current) {
      shouldKeepNotificationThreadOpenRef.current = false;
      return;
    }

    setView("threads");
    setIsSearchOpen(false);
    setSearchQuery("");
    setActiveSearchIndex(0);
    setThreadSwipeState(null);
  }, [isEmbedded, isOpen, problem, searchParams, sessionStatus]);

  useEffect(() => {
    if (isEmbedded || !floatingPosition) {
      return;
    }

    const nextPosition = clampFloatingPosition(
      floatingPosition,
      floatingSize,
      isOpen,
    );
    if (
      nextPosition.x !== floatingPosition.x ||
      nextPosition.y !== floatingPosition.y
    ) {
      setFloatingPosition(nextPosition);
    }
  }, [floatingPosition, floatingSize, isEmbedded, isOpen]);

  useEffect(() => {
    const nextEntries = messages.reduce<Record<string, string>>(
      (acc, message) => {
        const knownTimestamp =
          message.createdAt ??
          messageTimes[message.id] ??
          new Date().toISOString();
        acc[message.id] = knownTimestamp;
        return acc;
      },
      {},
    );

    setMessageTimes((current) => {
      const hasChanged =
        Object.keys(nextEntries).length !== Object.keys(current).length ||
        Object.entries(nextEntries).some(
          ([id, timestamp]) => current[id] !== timestamp,
        );

      return hasChanged ? nextEntries : current;
    });
  }, [messageTimes, messages]);

  const applyActiveThread = useCallback((nextThreadId: string | null) => {
    activeThreadIdRef.current = nextThreadId;
    setThreadId(nextThreadId);
  }, []);

  const loadChatState = useCallback(
    async (nextThreadId?: string | null) => {
      if (sessionStatus !== "authenticated") {
        applyActiveThread(null);
        setThreads([]);
        setMessages(initialMessages);
        setHandoffMeta(null);
        setHasLoadedChatState(true);
        return null;
      }

      setIsHistoryLoading(true);

      try {
        const searchParams = new URLSearchParams({ platform });
        if (nextThreadId && /^\d+$/.test(nextThreadId)) {
          searchParams.set("threadId", nextThreadId);
        }

        const response = await fetch(`/api/chat?${searchParams.toString()}`, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load chat state");
        }

        const data = (await response.json()) as ChatPayload;
        const threadPlatformMap = readThreadPlatformMap();
        const nextThreads = data.threads.map((thread) => {
          const resolvedPlatform =
            thread.platform === "handoff"
              ? "handoff"
              : (threadPlatformMap[thread.id] ?? platform);
          threadPlatformMap[thread.id] = resolvedPlatform;

          return {
            ...thread,
            platform: resolvedPlatform,
          };
        });

        writeThreadPlatformMap(threadPlatformMap);

        const uniqueThreads = sortUniqueThreadsByRecentActivity(nextThreads);

        setThreads(uniqueThreads);
        applyActiveThread(data.activeThreadId);
        setMessages(data.activeThreadId ? data.messages : []);
        setHandoffMeta(data.handoff ?? null);
        setHasLoadedChatState(true);
        return {
          ...data,
          threads: uniqueThreads,
        };
      } catch (loadError) {
        console.error("Failed to load chat state", loadError);
        setThreads([]);
        applyActiveThread(null);
        setMessages([]);
        setHandoffMeta(null);
        setHasLoadedChatState(true);
        return null;
      } finally {
        setIsHistoryLoading(false);
      }
    },
    [applyActiveThread, initialMessages, platform, sessionStatus, setMessages],
  );

  useEffect(() => {
    if (sessionStatus === "loading") {
      return;
    }

    if (sessionStatus !== "authenticated") {
      applyActiveThread(null);
      setThreads([]);
      setMessages(initialMessages);
      setHandoffMeta(null);
      setHasLoadedChatState(true);
      setView("chat");
      return;
    }

    if (platform === "cote" && problem) {
      return;
    }

    void loadChatState();
  }, [
    applyActiveThread,
    initialMessages,
    loadChatState,
    platform,
    problem,
    sessionStatus,
    setMessages,
  ]);

  useEffect(() => {
    if (
      sessionStatus !== "authenticated" ||
      platform !== "cote" ||
      !problem ||
      isCreatingThread
    ) {
      return;
    }

    let isCancelled = false;
    const currentProblem = problem;
    const abortController = new AbortController();

    async function ensureProblemThread() {
      if (problemThreadRequestRef.current === currentProblem.slug) {
        return;
      }

      problemThreadRequestRef.current = currentProblem.slug;

      try {
        const threadTitle = getHorokCoteChatThreadTitle(currentProblem);
        const threadMap = readCoteProblemThreadMap();
        const mappedThreadId = threadMap[currentProblem.slug];
        const currentState = await loadChatState();

        if (isCancelled) {
          return;
        }

        const matchedThread =
          currentState?.threads.find(
            (thread) => thread.id === mappedThreadId,
          ) ??
          currentState?.threads.find((thread) => thread.title === threadTitle);

        if (matchedThread) {
          threadMap[currentProblem.slug] = matchedThread.id;
          writeCoteProblemThreadMap(threadMap);

          if (currentState?.activeThreadId !== matchedThread.id) {
            await loadChatState(matchedThread.id);
          }

          setView("chat");
          return;
        }

        setIsCreatingThread(true);

        try {
          const response = await fetch("/api/chat/threads", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              platform,
              title: threadTitle,
              initialAssistantMessage:
                getHorokCoteChatIntroMessage(currentProblem),
            }),
            signal: abortController.signal,
          });

          if (!response.ok) {
            throw new Error("Failed to create problem thread");
          }

          const data = (await response.json()) as {
            threadId: string;
          };

          const threadPlatformMap = readThreadPlatformMap();
          threadPlatformMap[data.threadId] = platform;
          writeThreadPlatformMap(threadPlatformMap);

          threadMap[currentProblem.slug] = data.threadId;
          writeCoteProblemThreadMap(threadMap);
          await loadChatState(data.threadId);
          setView("chat");
        } catch (createError) {
          if ((createError as Error).name === "AbortError") {
            return;
          }

          console.error("Failed to create problem thread", createError);
        } finally {
          if (!isCancelled) {
            setIsCreatingThread(false);
          }
        }
      } finally {
        if (problemThreadRequestRef.current === currentProblem.slug) {
          problemThreadRequestRef.current = null;
        }
      }
    }

    void ensureProblemThread();

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [isCreatingThread, loadChatState, platform, problem, sessionStatus]);

  useEffect(() => {
    const targetThreadId = searchParams.get("chatThreadId");
    if (
      isEmbedded ||
      problem ||
      sessionStatus !== "authenticated" ||
      !targetThreadId ||
      !/^\d+$/.test(targetThreadId) ||
      notificationThreadRequestRef.current === targetThreadId
    ) {
      return;
    }

    notificationThreadRequestRef.current = targetThreadId;

    async function openNotificationThread() {
      shouldKeepNotificationThreadOpenRef.current = true;
      setIsOpen(true);
      setView("chat");
      setIsSearchOpen(false);
      setSearchQuery("");
      setActiveSearchIndex(0);
      setThreadSwipeState(null);
      await loadChatState(targetThreadId);
    }

    void openNotificationThread();
  }, [isEmbedded, loadChatState, problem, searchParams, sessionStatus]);

  useEffect(() => {
    if (isEmbedded || problem || sessionStatus !== "authenticated") {
      return;
    }

    function handleOpenChatThread(event: Event) {
      const detail = (event as CustomEvent<{ threadId?: string }>).detail;
      const targetThreadId = detail?.threadId;
      if (!targetThreadId || !/^\d+$/.test(targetThreadId)) {
        return;
      }

      notificationThreadRequestRef.current = targetThreadId;
      shouldKeepNotificationThreadOpenRef.current = true;
      setIsOpen(true);
      setView("chat");
      setIsSearchOpen(false);
      setSearchQuery("");
      setActiveSearchIndex(0);
      setThreadSwipeState(null);
      void loadChatState(targetThreadId);
    }

    window.addEventListener(OPEN_CHAT_THREAD_EVENT, handleOpenChatThread);
    return () =>
      window.removeEventListener(OPEN_CHAT_THREAD_EVENT, handleOpenChatThread);
  }, [isEmbedded, loadChatState, problem, sessionStatus]);

  async function handleSelectThread(nextThreadId: string) {
    if (nextThreadId === threadId) {
      setView("chat");
      return;
    }

    clearError();
    await loadChatState(nextThreadId);
    setView("chat");
  }

  async function handleCreateThread() {
    if (sessionStatus !== "authenticated" || isCreatingThread) {
      return;
    }

    setIsCreatingThread(true);

    try {
      const response = await fetch("/api/chat/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ platform }),
      });

      if (!response.ok) {
        throw new Error("Failed to create thread");
      }

      const data = (await response.json()) as {
        threadId: string;
      };

      applyActiveThread(data.threadId);
      const threadPlatformMap = readThreadPlatformMap();
      threadPlatformMap[data.threadId] = platform;
      writeThreadPlatformMap(threadPlatformMap);
      setMessages([]);
      setHandoffMeta(null);
      setInput("");
      setView("chat");
      await loadChatState(data.threadId);
    } catch (createError) {
      console.error("Failed to create thread", createError);
    } finally {
      setIsCreatingThread(false);
    }
  }

  async function ensureActiveThread() {
    if (sessionStatus !== "authenticated") {
      return null;
    }

    if (activeThreadIdRef.current) {
      return activeThreadIdRef.current;
    }

    setIsCreatingThread(true);

    try {
      const response = await fetch("/api/chat/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ platform }),
      });

      if (!response.ok) {
        throw new Error("Failed to create thread");
      }

      const data = (await response.json()) as {
        threadId: string;
      };

      applyActiveThread(data.threadId);
      const threadPlatformMap = readThreadPlatformMap();
      threadPlatformMap[data.threadId] = platform;
      writeThreadPlatformMap(threadPlatformMap);
      setThreads((currentThreads) =>
        sortUniqueThreadsByRecentActivity([
          {
            id: data.threadId,
            title: "새 대화",
            preview: "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageCount: 0,
            platform,
          },
          ...currentThreads,
        ]),
      );

      return data.threadId;
    } finally {
      setIsCreatingThread(false);
    }
  }

  async function sendChatText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) {
      return;
    }

    clearError();
    setHandoffMessage(null);
    shouldStickToBottomRef.current = true;

    if (sessionStatus === "authenticated") {
      await ensureActiveThread();
    }

    setInput("");
    await sendMessage({ text: trimmed });

    if (sessionStatus === "authenticated") {
      await loadChatState(activeThreadIdRef.current);
    }
  }

  async function saveHandoffText(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isSavingHandoffMessage || isCreatingThread) {
      return false;
    }

    if (sessionStatus !== "authenticated") {
      setHandoffMessage("로그인 후 현재 대화에 문의를 남길 수 있어요.");
      return false;
    }

    setIsSavingHandoffMessage(true);
    setHandoffMessage(null);
    shouldStickToBottomRef.current = true;

    try {
      const nextThreadId = await ensureActiveThread();
      if (!nextThreadId) {
        throw new Error("Missing thread id");
      }

      const response = await fetch("/api/chat/handoff/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform,
          threadId: nextThreadId,
          content: trimmed,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to save handoff message");
      }

      setInput("");
      setHandoffMessage(
        "문의 내용을 이어서 입력하거나, 문의 완료하기를 눌러 관리자에게 남겨주세요.",
      );
      setHasSentHandoffMessage(true);
      await loadChatState(nextThreadId);
      return true;
    } catch (handoffMessageError) {
      console.error("Failed to save handoff message", handoffMessageError);
      setHandoffMessage("문의 내용을 저장하지 못했습니다.");
      return false;
    } finally {
      setIsSavingHandoffMessage(false);
    }
  }

  async function saveAdminHandoffReply(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) {
      return;
    }

    const activeThreadId = activeThreadIdRef.current;
    if (!activeThreadId) {
      setHandoffMessage("답변할 문의 대화를 찾지 못했습니다.");
      return;
    }

    setIsSavingHandoffMessage(true);
    setHandoffMessage(null);
    shouldStickToBottomRef.current = true;

    try {
      const response = await fetch("/api/chat/handoff/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform,
          threadId: activeThreadId,
          content: trimmed,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to save admin reply");
      }

      setInput("");
      setHandoffMessage("답변을 저장했습니다.");
      await loadChatState(activeThreadId);
    } catch (replyError) {
      console.error("Failed to save admin handoff reply", replyError);
      setHandoffMessage("답변을 저장하지 못했습니다.");
    } finally {
      setIsSavingHandoffMessage(false);
    }
  }

  const insertTextAtCursor = (text: string) => {
    const inputEl = inputRef.current;
    if (!inputEl) {
      setInput((prev) => `${prev}${prev ? " " : ""}${text}`);
      return;
    }

    const start = inputEl.selectionStart ?? input.length;
    const end = inputEl.selectionEnd ?? input.length;
    const before = input.slice(0, start);
    const after = input.slice(end);
    const prefix = before && !before.endsWith(" ") ? " " : "";
    const suffix = after && !after.startsWith(" ") ? " " : "";
    const nextInput = `${before}${prefix}${text}${suffix}${after}`;
    const nextCursorPosition = (before + prefix + text).length;

    setInput(nextInput);

    requestAnimationFrame(() => {
      inputEl.focus();
      inputEl.setSelectionRange(nextCursorPosition, nextCursorPosition);
    });
  };

  const handlePaste = async (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    if (isUploadingImage) return;

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

    setIsUploadingImage(true);

    try {
      const markdownImages: string[] = [];

      for (const file of files) {
        const safeFileName =
          file.name
            .normalize("NFKD")
            .replace(/[^\w.-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase() || "image";

        const nextPath = `public/chat/${crypto.randomUUID()}-${safeFileName}`;

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

        markdownImages.push(`![image](${publicUrl})`);
      }

      insertTextAtCursor(markdownImages.join(" "));
    } catch (err) {
      console.error("Chat image paste upload error:", err);
      alert("이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isAdminHandoffView) {
      await saveAdminHandoffReply(input);
      return;
    }

    if (isHandoffDraftMode) {
      await saveHandoffText(input);
      return;
    }

    await sendChatText(input);
  }

  async function handleSuggestedQuestion(question: string) {
    await sendChatText(question);
  }

  async function handleHandoffButton() {
    if (isRequestingHandoff || isLoading) {
      return;
    }

    if (sessionStatus !== "authenticated") {
      setHandoffMessage("로그인 후 현재 대화에 문의를 남길 수 있어요.");
      return;
    }

    if (!isHandoffDraftMode) {
      setHandoffMessage(
        "문의 내용을 입력해 주세요. 입력한 내용에는 AI가 답하지 않아요.",
      );
      setIsHandoffDraftMode(true);
      setHasSentHandoffMessage(false);
      inputRef.current?.focus();
      return;
    }

    let currentHasSent = hasSentHandoffMessage;

    if (input.trim()) {
      const didSave = await saveHandoffText(input);
      if (!didSave) {
        return;
      }
      currentHasSent = true;
    }

    if (!currentHasSent) {
      setIsHandoffDraftMode(false);
      setHandoffMessage(null);
      return;
    }

    setIsRequestingHandoff(true);
    setHandoffMessage(null);

    try {
      const nextThreadId = await ensureActiveThread();
      if (!nextThreadId) {
        throw new Error("Missing thread id");
      }

      const response = await fetch("/api/chat/handoff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform,
          threadId: nextThreadId,
          reason: "사용자가 현재 채팅 대화에 관리자 문의를 남겼습니다.",
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
        alreadyExists?: boolean;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to request handoff");
      }

      setHandoffMessage(
        data?.alreadyExists
          ? "이미 이 대화에 남긴 문의가 접수되어 있어요."
          : "문의가 접수됐어요. 관리자가 확인 후 답변을 남길게요.",
      );
      setIsHandoffDraftMode(false);
      await loadChatState(nextThreadId);
    } catch (handoffError) {
      console.error("Failed to request chat handoff", handoffError);
      setHandoffMessage("문의를 접수하지 못했습니다.");
    } finally {
      setIsRequestingHandoff(false);
    }
  }

  async function handleRenameThread(targetThread: ChatThreadSummary) {
    if (sessionStatus !== "authenticated") {
      return;
    }

    const nextTitle = window.prompt(
      "새 제목을 입력해 주세요.",
      targetThread.title,
    );
    const trimmedTitle = nextTitle?.trim();
    if (!trimmedTitle) {
      return;
    }

    const response = await fetch("/api/chat/threads", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform,
        threadId: targetThread.id,
        title: trimmedTitle,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to rename thread");
    }

    setThreads((currentThreads) =>
      currentThreads.map((thread) =>
        thread.id === targetThread.id
          ? { ...thread, title: trimmedTitle }
          : thread,
      ),
    );
  }

  async function handleDeleteThread(targetThread: ChatThreadSummary) {
    if (sessionStatus !== "authenticated") {
      return;
    }

    const confirmed = window.confirm("이 대화를 삭제할까요?");
    if (!confirmed) {
      return;
    }

    const response = await fetch("/api/chat/threads", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform,
        threadId: targetThread.id,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to delete thread");
    }

    setThreads((currentThreads) =>
      currentThreads.filter((thread) => thread.id !== targetThread.id),
    );

    if (threadId === targetThread.id) {
      applyActiveThread(null);
      setMessages([]);
      setHandoffMeta(null);
    }
  }

  function toggleSearch() {
    setIsSearchOpen((current) => {
      const next = !current;
      if (!next) {
        setSearchQuery("");
        setActiveSearchIndex(0);
      }
      return next;
    });
  }

  function moveSearchMatch(direction: "prev" | "next") {
    if (searchMatches.length === 0) {
      return;
    }

    setActiveSearchIndex((current) => {
      if (direction === "next") {
        return (current + 1) % searchMatches.length;
      }

      return (current - 1 + searchMatches.length) % searchMatches.length;
    });
  }

  function handleThreadSwipeStart(
    event: ReactMouseEvent<HTMLButtonElement>,
    targetThreadId: string,
  ) {
    setThreadSwipeState({
      threadId: targetThreadId,
      startX: event.clientX,
      deltaX: 0,
      isPointerDown: true,
      openDirection: null,
    });
  }

  function handleThreadSwipeMove(
    event: ReactMouseEvent<HTMLButtonElement>,
    targetThreadId: string,
  ) {
    setThreadSwipeState((currentState) => {
      if (
        !currentState ||
        !currentState.isPointerDown ||
        currentState.threadId !== targetThreadId
      ) {
        return currentState;
      }

      return {
        ...currentState,
        deltaX: Math.max(
          -120,
          Math.min(120, event.clientX - currentState.startX),
        ),
      };
    });
  }

  function handleThreadSwipeEnd(targetThread: ChatThreadSummary) {
    const deltaX =
      threadSwipeState?.threadId === targetThread.id
        ? threadSwipeState.deltaX
        : 0;
    if (deltaX <= -80) {
      setThreadSwipeState({
        threadId: targetThread.id,
        startX: 0,
        deltaX: -48,
        isPointerDown: false,
        openDirection: "left",
      });
      return true;
    }

    if (deltaX >= 80) {
      setThreadSwipeState({
        threadId: targetThread.id,
        startX: 0,
        deltaX: 48,
        isPointerDown: false,
        openDirection: "right",
      });
      return true;
    }

    setThreadSwipeState(null);
    return false;
  }

  function renderHighlightedText(
    text: string,
    activeOccurrenceIndexInMessage?: number,
  ) {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      return text;
    }

    const pattern = new RegExp(`(${escapeRegExp(normalizedQuery)})`, "gi");
    const parts = text.split(pattern);
    let cursor = 0;
    let occurrenceCursor = 0;

    return parts.map((part) => {
      const key = `${part}-${cursor}`;
      cursor += part.length;

      if (part.toLocaleLowerCase() !== normalizedQuery.toLocaleLowerCase()) {
        return <span key={key}>{part}</span>;
      }

      const isActiveMatch = activeOccurrenceIndexInMessage === occurrenceCursor;
      occurrenceCursor += 1;

      return (
        <mark
          key={key}
          className={
            platform === "cote"
              ? isActiveMatch
                ? "rounded-sm bg-[#06923E]/30 px-0.5 font-semibold text-[#047a33] dark:bg-[#06923E]/40 dark:text-[#b5f5c8]"
                : "rounded-sm bg-[#06923E]/18 px-0.5 text-[#047a33] dark:bg-[#06923E]/25 dark:text-[#8df0ae]"
              : isActiveMatch
                ? "rounded-sm bg-orange-300/85 px-0.5 font-semibold text-orange-900 dark:bg-orange-400/30 dark:text-orange-100"
                : "rounded-sm bg-orange-200/70 px-0.5 text-orange-800 dark:bg-orange-400/20 dark:text-orange-200"
          }
        >
          {part}
        </mark>
      );
    });
  }

  function handleFloatingDragStart(event: ReactMouseEvent<HTMLButtonElement>) {
    if (isEmbedded || !floatingPosition) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = {
      pointerOffsetX: event.clientX - floatingPosition.x,
      pointerOffsetY: event.clientY - floatingPosition.y,
    };
    dragStartPointRef.current = {
      x: event.clientX,
      y: event.clientY,
    };
    hasDraggedFloatingRef.current = false;
  }

  function handleFloatingResizeStart(
    event: ReactMouseEvent<HTMLButtonElement>,
    direction: ResizeDirection,
  ) {
    if (isEmbedded || !floatingPosition) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      direction,
      startWidth: floatingSize.width,
      startHeight: floatingSize.height,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPositionX: floatingPosition.x,
      startPositionY: floatingPosition.y,
    };
  }

  function handleFloatingToggle() {
    if (hasDraggedFloatingRef.current) {
      hasDraggedFloatingRef.current = false;
      return;
    }

    const nextOpen = !isOpen;

    if (nextOpen && sessionStatus === "authenticated" && !problem) {
      setView("threads");
      setIsSearchOpen(false);
      setSearchQuery("");
      setActiveSearchIndex(0);
      setThreadSwipeState(null);
    }

    setIsOpen(nextOpen);
  }

  async function handleCopyMessage(messageId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      window.setTimeout(() => {
        setCopiedMessageId((current) =>
          current === messageId ? null : current,
        );
      }, 1500);
    } catch (copyError) {
      console.error("Message copy failed", copyError);
    }
  }

  function handleMessagesScroll() {
    const viewport = messagesViewportRef.current;
    if (!viewport) {
      return;
    }

    shouldStickToBottomRef.current = isNearScrollBottom(viewport);
  }

  return (
    <div
      className={cn(
        isEmbedded
          ? "flex h-full min-h-0 flex-col"
          : "pointer-events-none fixed z-40 flex items-end justify-end",
      )}
      style={
        !isEmbedded && floatingPosition
          ? {
              left: floatingPosition.x,
              top: floatingPosition.y,
            }
          : undefined
      }
    >
      <div
        className={cn(
          isEmbedded
            ? "flex h-full min-h-0 flex-col"
            : cn(
                "relative flex flex-col",
                isFloatingPanelLeftOfCenter ? "items-start" : "items-end",
              ),
        )}
        style={
          !isEmbedded
            ? {
                width: FLOATING_BUTTON_SIZE,
                minHeight: FLOATING_BUTTON_SIZE,
              }
            : undefined
        }
      >
        <div
          className={cn(
            isEmbedded
              ? "flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border bg-white dark:bg-zinc-950"
              : cn(
                  "pointer-events-auto absolute bottom-[calc(100%+0.75rem)] flex flex-col overflow-hidden rounded-[24px] border bg-white transition-all duration-300 dark:bg-zinc-950 sm:rounded-[28px]",
                  "right-0",
                ),
            platform === "cote"
              ? "border-[#06923E]/20 dark:border-[#06923E]/30"
              : "border-orange-100 dark:border-orange-400/20",
            !isEmbedded &&
              (isOpen
                ? "translate-y-0 scale-100 opacity-100"
                : "pointer-events-none translate-y-4 scale-95 opacity-0"),
          )}
          style={
            !isEmbedded
              ? {
                  width: floatingSize.width,
                  height: floatingSize.height,
                }
              : undefined
          }
        >
          <div
            className={cn(
              "relative px-3 pt-3 pb-2 text-primary-foreground",
              platform === "cote" ? "bg-[#06923E]" : "bg-primary",
            )}
          >
            {!isEmbedded ? (
              <button
                type="button"
                className="absolute left-1/2 top-1 z-20 flex h-3 w-20 -translate-x-1/2 cursor-grab touch-none items-center justify-center rounded-full transition active:cursor-grabbing"
                aria-label="채팅창 이동"
                onMouseDown={handleFloatingDragStart}
              >
                <span className="h-1 w-10 rounded-full bg-white/55 shadow-sm transition hover:bg-white/80" />
              </button>
            ) : null}
            <div className="relative flex items-center">
              {!isThreadMode && sessionStatus === "authenticated" ? (
                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                  <button
                    type="button"
                    onClick={() => {
                      setView("threads");
                    }}
                    className="p-1 text-primary-foreground transition hover:opacity-80"
                    aria-label="대화 목록 보기"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                </div>
              ) : null}

              <div
                className={cn(
                  "flex h-8 min-w-0 flex-1 items-center justify-center",
                  hasCloseButton ? "mx-8" : "ml-8 mr-0",
                )}
              >
                <p
                  className={cn(
                    "pointer-events-none absolute left-1/2 -translate-x-1/2 text-base font-semibold transition-opacity",
                    isSearchOpen && !isThreadMode ? "opacity-0" : "opacity-100",
                  )}
                >
                  {isAdminHandoffView && handoffMeta?.requester?.name
                    ? handoffMeta.requester.name
                    : "호록이"}
                </p>

                <div
                  className={cn(
                    "absolute inset-y-0 left-8 flex items-center gap-1 transition-opacity",
                    hasCloseButton ? "right-16" : "right-8",
                    isSearchOpen && !isThreadMode
                      ? "pointer-events-auto opacity-100"
                      : "pointer-events-none opacity-0",
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-white/12 px-3 ring-1 ring-white/20 backdrop-blur-sm">
                    <input
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setActiveSearchIndex(0);
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") {
                          return;
                        }

                        event.preventDefault();
                        moveSearchMatch(event.shiftKey ? "prev" : "next");
                      }}
                      placeholder="대화 내용 검색"
                      className="h-8 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/60"
                    />
                    <span className="ml-2 w-8 shrink-0 text-right text-[11px] text-white/80">
                      {searchQuery.trim()
                        ? searchMatches.length > 0
                          ? `${Math.min(activeSearchIndex + 1, searchMatches.length)}/${searchMatches.length}`
                          : "0"
                        : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => moveSearchMatch("prev")}
                    disabled={searchMatches.length === 0}
                    className="p-1 text-primary-foreground transition hover:opacity-80 disabled:cursor-default disabled:opacity-40"
                    aria-label="이전 검색 결과"
                  >
                    <ChevronUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSearchMatch("next")}
                    disabled={searchMatches.length === 0}
                    className="p-1 text-primary-foreground transition hover:opacity-80 disabled:cursor-default disabled:opacity-40"
                    aria-label="다음 검색 결과"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
              </div>

              {!isThreadMode ? (
                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={toggleSearch}
                      className="p-1 text-primary-foreground transition hover:opacity-80"
                      aria-label={isSearchOpen ? "검색 닫기" : "대화 검색"}
                    >
                      <Search className="size-5" />
                    </button>
                    {hasCloseButton ? (
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-1 text-primary-foreground transition hover:opacity-80"
                        aria-label="챗봇 닫기"
                      >
                        <X className="size-5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCreateThread}
                      disabled={isCreatingThread}
                      className="p-1 text-primary-foreground transition hover:opacity-80 disabled:opacity-40"
                      aria-label="새 대화"
                    >
                      <Plus className="size-5" />
                    </button>
                    {!isEmbedded ? (
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-1 text-primary-foreground transition hover:opacity-80"
                        aria-label="챗봇 닫기"
                      >
                        <X className="size-5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            className={cn(
              isEmbedded
                ? "flex min-h-0 flex-1 flex-col"
                : "flex min-h-0 flex-1 flex-col",
              platform === "cote"
                ? "bg-white dark:bg-[linear-gradient(180deg,#111827_0%,#0f172a_100%)]"
                : "bg-white dark:bg-zinc-950",
            )}
          >
            {isThreadMode ? (
              <div
                className={cn(
                  platform === "cote" ? "scrollbar-green" : "scrollbar-orange",
                  "flex-1 overflow-y-auto",
                )}
              >
                <div className="p-3">
                  <div className="mb-3 flex items-center gap-1">
                    {threadCategories.map((category) => {
                      const isActive = threadCategory === category;

                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setThreadCategory(category)}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                            isActive
                              ? platform === "cote"
                                ? "bg-[#06923E] text-white"
                                : "bg-primary text-primary-foreground"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
                          )}
                        >
                          {category === "all"
                            ? "전체"
                            : category === "handoff"
                              ? "문의"
                              : category}
                        </button>
                      );
                    })}
                  </div>

                  {filteredThreads.length > 0 ? (
                    filteredThreads.map((thread) => {
                      const isActive = thread.id === threadId;
                      const swipeOffset =
                        threadSwipeState?.threadId === thread.id
                          ? threadSwipeState.deltaX
                          : 0;
                      const isRightActionOpen =
                        threadSwipeState?.threadId === thread.id &&
                        threadSwipeState.openDirection === "right";
                      const isLeftActionOpen =
                        threadSwipeState?.threadId === thread.id &&
                        threadSwipeState.openDirection === "left";

                      return (
                        <div
                          key={thread.id}
                          className="relative mb-2 overflow-hidden rounded-2xl"
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await handleRenameThread(thread);
                              } catch (error) {
                                console.error("Thread rename failed", error);
                              } finally {
                                setThreadSwipeState(null);
                              }
                            }}
                            className={cn(
                              "absolute inset-y-0 left-0 flex w-12 items-center justify-center rounded-l-2xl rounded-r-none bg-transparent text-sky-700 transition-opacity dark:text-sky-200",
                              isRightActionOpen ? "opacity-100" : "opacity-0",
                            )}
                            aria-label="제목 수정"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await handleDeleteThread(thread);
                              } catch (error) {
                                console.error("Thread delete failed", error);
                              } finally {
                                setThreadSwipeState(null);
                              }
                            }}
                            className={cn(
                              "absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl rounded-l-none bg-transparent text-red-600 transition-opacity dark:text-red-300",
                              isLeftActionOpen ? "opacity-100" : "opacity-0",
                            )}
                            aria-label="대화 삭제"
                          >
                            <Trash2 className="size-4" />
                          </button>
                          <button
                            type="button"
                            onMouseDown={(event) =>
                              handleThreadSwipeStart(event, thread.id)
                            }
                            onMouseMove={(event) =>
                              handleThreadSwipeMove(event, thread.id)
                            }
                            onMouseUp={() => {
                              const handled = handleThreadSwipeEnd(thread);
                              if (!handled) {
                                void handleSelectThread(thread.id);
                              }
                            }}
                            onMouseLeave={() => {
                              if (
                                threadSwipeState?.threadId !== thread.id ||
                                !threadSwipeState?.isPointerDown
                              ) {
                                return;
                              }

                              handleThreadSwipeEnd(thread);
                            }}
                            className={cn(
                              "relative w-full rounded-2xl border px-3 py-3 text-left transition will-change-transform",
                              isActive
                                ? platform === "cote"
                                  ? "border-[#06923E]/45 bg-white shadow-sm dark:border-[#06923E]/45 dark:bg-zinc-900"
                                  : "border-orange-300 bg-white shadow-sm dark:border-orange-400/40 dark:bg-zinc-900"
                                : platform === "cote"
                                  ? "border-slate-200 bg-white/70 hover:border-[#06923E]/25 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-[#06923E]/25"
                                  : "border-slate-200 bg-white/70 hover:border-orange-200 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-orange-400/20",
                            )}
                            style={{
                              transform: `translateX(${swipeOffset}px)`,
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="line-clamp-2 text-sm font-semibold text-slate-800 dark:text-zinc-100">
                                {thread.title}
                              </p>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {formatThreadTime(thread.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {thread.preview || "아직 메시지가 없습니다."}
                            </p>
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                      <p className="text-sm font-medium text-slate-700 dark:text-zinc-100">
                        아직 저장된 대화가 없어요.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        새 대화를 눌러 스레드를 만들고 자유롭게 오가며 대화를
                        이어가세요.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="relative min-h-0 flex-1">
                  <div
                    ref={messagesViewportRef}
                    onScroll={handleMessagesScroll}
                    className={cn(
                      platform === "cote"
                        ? "scrollbar-green"
                        : "scrollbar-orange",
                      "h-full overflow-y-auto",
                    )}
                  >
                    <div
                      className={cn(
                        "flex flex-col space-y-3 px-3 pt-3",
                        isAdminHandoffView ? "pb-3" : "pb-20",
                      )}
                    >
                      {hasMessages
                        ? visibleMessages.map((message, index) => {
                            const text = getMessageText(message.parts).trim();
                            if (!text) {
                              return null;
                            }

                            const isUser = message.role === "user";
                            const isAdminAuthoredMessage =
                              message.sender?.role === "ADMIN";
                            const isRequesterMessage =
                              Boolean(handoffMeta?.isAdminView) && isUser;
                            const isOutgoingMessage =
                              (isUser && !isRequesterMessage) ||
                              (isAdminHandoffView && isAdminAuthoredMessage);
                            const avatarSrc = isRequesterMessage
                              ? (handoffMeta?.requester.image ?? "/logo.png")
                              : isAdminAuthoredMessage
                                ? (message.sender?.image ?? "/logo.png")
                                : "/logo.png";
                            const avatarAlt = isRequesterMessage
                              ? `${handoffMeta?.requester.name ?? "문의자"} 프로필`
                              : isAdminAuthoredMessage
                                ? `${message.sender?.name ?? "관리자"} 프로필`
                                : "호록 프로필";
                            const resolvedTimestamp =
                              message.createdAt ??
                              messageTimes[message.id] ??
                              new Date().toISOString();
                            const previousTimestamp =
                              index > 0
                                ? (visibleMessages[index - 1]?.createdAt ??
                                  messageTimes[
                                    visibleMessages[index - 1]?.id ?? ""
                                  ])
                                : null;
                            const messageTime =
                              formatMessageTime(resolvedTimestamp);
                            const showDateBadge =
                              getMessageDateKey(resolvedTimestamp) !==
                              getMessageDateKey(previousTimestamp);
                            const isSearchMatch = matchedMessageIds.includes(
                              message.id,
                            );
                            const activeOccurrenceIndexInMessage =
                              activeSearchMatch?.messageId === message.id
                                ? activeSearchMatch.occurrenceIndexInMessage
                                : undefined;
                            const shouldAnimateMessage =
                              !isUser &&
                              !isSearchMatch &&
                              index === visibleMessages.length - 1 &&
                              isAssistantResponding &&
                              !message.createdAt;

                            return (
                              <div key={message.id} className="space-y-3">
                                {showDateBadge ? (
                                  <div className="flex justify-center">
                                    <div
                                      className={cn(
                                        "rounded-full px-3 py-1 text-xs",
                                        platform === "cote"
                                          ? "border border-[#06923E]/10 bg-white text-slate-500 dark:border-[#06923E]/20 dark:bg-slate-950 dark:text-zinc-400"
                                          : "bg-slate-100 text-slate-500 dark:bg-zinc-900 dark:text-zinc-400",
                                      )}
                                    >
                                      {formatMessageDateBadge(
                                        resolvedTimestamp,
                                      )}
                                    </div>
                                  </div>
                                ) : null}

                                <div
                                  ref={(element) => {
                                    messageRefs.current[message.id] = element;
                                  }}
                                  className={cn(
                                    "flex w-full min-w-0 items-start gap-2 transition",
                                    isOutgoingMessage
                                      ? "justify-end"
                                      : "justify-start",
                                  )}
                                >
                                  {!isOutgoingMessage ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewImageUrl(avatarSrc)
                                      }
                                      className="relative mt-1 size-8 shrink-0 cursor-pointer rounded-full outline-none transition hover:opacity-85"
                                      aria-label="프로필 보기"
                                    >
                                      <Image
                                        src={avatarSrc}
                                        alt={avatarAlt}
                                        width={32}
                                        height={32}
                                        className={cn(
                                          "relative z-10 size-full rounded-full border object-cover",
                                          ((isRequesterMessage &&
                                            !handoffMeta?.requester.image) ||
                                            (isAdminAuthoredMessage &&
                                              !message.sender?.image)) &&
                                            "grayscale",
                                          platform === "cote"
                                            ? "border-[#06923E]/25 bg-white"
                                            : "border-orange-200 bg-white dark:border-orange-400/30",
                                        )}
                                      />
                                      {isAdminAuthoredMessage ? (
                                        <Crown
                                          className="pointer-events-none absolute -top-2 left-1/2 z-0 h-3.5 w-3.5 -translate-x-1/2 fill-amber-300 text-amber-500 drop-shadow-sm"
                                          strokeWidth={2.5}
                                          aria-hidden="true"
                                        />
                                      ) : null}
                                    </button>
                                  ) : null}
                                  <div
                                    className={cn(
                                      "flex min-w-0 items-end gap-1.5",
                                      isOutgoingMessage
                                        ? "ml-10 max-w-[calc(100%-2.5rem)] flex-row-reverse justify-end"
                                        : "flex-1",
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "min-w-0 max-w-[calc(100%-2.625rem)] overflow-hidden break-words rounded-3xl px-3 py-2 text-sm leading-5 shadow-sm",
                                        isOutgoingMessage
                                          ? platform === "cote"
                                            ? "rounded-br-lg bg-[#06923E] text-white dark:bg-[#06923E] dark:text-white"
                                            : "rounded-br-lg bg-orange-500 text-white dark:bg-orange-500 dark:text-white"
                                          : platform === "cote"
                                            ? "border border-[#06923E]/10 bg-white text-slate-800 dark:border-[#06923E]/20 dark:bg-slate-950 dark:text-slate-100"
                                            : "border border-orange-100 bg-white text-slate-800 dark:border-orange-400/20 dark:bg-zinc-900 dark:text-zinc-100",
                                      )}
                                    >
                                      {isSearchMatch ? (
                                        <p className="whitespace-pre-wrap">
                                          {renderHighlightedText(
                                            text,
                                            activeOccurrenceIndexInMessage,
                                          )}
                                        </p>
                                      ) : (
                                        <AnimatedChatMarkdown
                                          content={text}
                                          shouldAnimate={shouldAnimateMessage}
                                          className={cn(
                                            CHAT_MARKDOWN_CLASS_NAME,
                                            isOutgoingMessage
                                              ? "[&_th]:bg-white/15"
                                              : "",
                                          )}
                                        />
                                      )}
                                    </div>
                                    <div
                                      className={cn(
                                        "flex w-9 shrink-0 flex-col gap-0.5",
                                        isOutgoingMessage
                                          ? "items-end"
                                          : "items-start",
                                      )}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleCopyMessage(
                                            message.id,
                                            text,
                                          )
                                        }
                                        className="p-0.5 text-slate-400 transition hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                                        aria-label="메시지 복사"
                                      >
                                        {copiedMessageId === message.id ? (
                                          <Check className="size-3.5" />
                                        ) : (
                                          <Copy className="size-3.5" />
                                        )}
                                      </button>
                                      {messageTime ? (
                                        <span className="whitespace-nowrap text-[11px] text-slate-400 dark:text-zinc-500">
                                          {messageTime}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                {sessionStatus === "unauthenticated" &&
                                index === 0 &&
                                !isUser ? (
                                  <p className="text-center text-xs text-muted-foreground">
                                    로그인 하시면 대화를 저장할 수 있습니다.
                                  </p>
                                ) : null}
                              </div>
                            );
                          })
                        : null}

                      {isAssistantResponding ? (
                        <div className="flex w-full min-w-0 items-start justify-start gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewImageUrl("/logo.png")}
                            className="mt-1 size-8 shrink-0 cursor-pointer rounded-full outline-none transition hover:opacity-85"
                            aria-label="프로필 보기"
                          >
                            <Image
                              src="/logo.png"
                              alt="호록 프로필"
                              width={32}
                              height={32}
                              className={cn(
                                "size-full rounded-full border object-cover",
                                platform === "cote"
                                  ? "border-[#06923E]/25 bg-white"
                                  : "border-orange-200 bg-white dark:border-orange-400/30",
                              )}
                            />
                          </button>
                          <div className="flex min-w-0 flex-1 items-end gap-1.5">
                            <div
                              className={cn(
                                "min-w-0 max-w-[calc(100%-2.625rem)] overflow-hidden break-words rounded-3xl rounded-bl-lg border bg-white px-3 py-2 text-sm text-slate-500 shadow-sm dark:text-zinc-300",
                                platform === "cote"
                                  ? "border-[#06923E]/10 dark:border-[#06923E]/20 dark:bg-slate-950 dark:text-slate-300"
                                  : "border-orange-100 dark:border-orange-400/20 dark:bg-zinc-900 dark:text-zinc-300",
                              )}
                            >
                              답변을 작성 중입니다...
                            </div>
                            <span className="w-9 shrink-0 whitespace-nowrap text-[11px] text-slate-400 dark:text-zinc-500">
                              {formatMessageTime(new Date().toISOString())}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {error ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
                          챗봇 연결 중 문제가 발생했습니다. 잠시 후 다시 시도해
                          주세요.
                        </div>
                      ) : null}

                      {handoffMessage ? (
                        <p className="px-1 text-center text-xs text-muted-foreground">
                          {handoffMessage}
                        </p>
                      ) : null}

                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  {!isAdminHandoffView ? (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col px-3 pb-2">
                      <div className="pointer-events-auto flex h-10 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowSuggestions(!showSuggestions)}
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white transition hover:bg-slate-50 dark:bg-zinc-950 dark:hover:bg-zinc-900",
                            platform === "cote"
                              ? "border-[#06923E]/30 text-[#06923E] hover:border-[#06923E]/50"
                              : "border-orange-300 text-orange-600 hover:border-orange-400",
                          )}
                          aria-label={
                            showSuggestions
                              ? "추천 질문 숨기기"
                              : "추천 질문 보기"
                          }
                        >
                          {showSuggestions ? (
                            <X className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </button>

                        {showSuggestions && (
                          <div className="scrollbar-native-hidden flex-1 flex items-center flex-nowrap gap-1 overflow-x-auto">
                            <button
                              type="button"
                              onClick={() => void handleHandoffButton()}
                              disabled={isRequestingHandoff || isLoading}
                              className={cn(
                                "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 text-xs font-semibold transition disabled:cursor-default disabled:opacity-45 dark:bg-zinc-950",
                                platform === "cote"
                                  ? "border-[#06923E]/30 text-[#06923E] hover:border-[#06923E]/50 hover:bg-[#eef7f1] dark:border-[#46c86f]/30 dark:text-[#46c86f] dark:hover:bg-[#06923E]/10"
                                  : "border-orange-300 text-orange-600 hover:border-orange-400 hover:bg-orange-50 dark:border-orange-400/35 dark:text-orange-300 dark:hover:bg-orange-950/30",
                              )}
                            >
                              <Headphones className="size-3.5" />
                              {isRequestingHandoff
                                ? "요청 접수 중..."
                                : isHandoffDraftMode
                                  ? "문의 완료"
                                  : "문의 모드"}
                            </button>

                            {CHAT_SUGGESTED_QUESTIONS.map((question) => (
                              <button
                                key={question}
                                type="button"
                                onClick={() =>
                                  void handleSuggestedQuestion(question)
                                }
                                disabled={isLoading || isHandoffDraftMode}
                                className={cn(
                                  "inline-flex h-7 shrink-0 items-center justify-center rounded-full border px-3 text-xs font-semibold text-white transition disabled:cursor-default disabled:opacity-45",
                                  platform === "cote"
                                    ? "border-[#06923E] bg-[#06923E] hover:border-[#047a33] hover:bg-[#047a33]"
                                    : "border-orange-500 bg-orange-500 hover:border-orange-600 hover:bg-orange-600",
                                )}
                              >
                                {question}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <form
                        onSubmit={handleSubmit}
                        className="pointer-events-auto"
                      >
                        <div
                          className={cn(
                            "relative overflow-hidden rounded-3xl border bg-white shadow-md transition-shadow focus-within:shadow-lg",
                            platform === "cote"
                              ? "border-[#06923E]/25 dark:border-[#06923E]/30 dark:bg-slate-950"
                              : "border-orange-200 dark:border-orange-400/25 dark:bg-zinc-900",
                          )}
                        >
                          {/* 드래그 핸들 - 레이아웃에 영향 없는 absolute */}
                          <div
                            className="absolute inset-x-0 top-0 z-10 h-2 cursor-ns-resize"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              inputResizeRef.current = {
                                startY: e.clientY,
                                startHeight: inputHeight,
                              };
                              const onMouseMove = (moveEvent: MouseEvent) => {
                                if (!inputResizeRef.current) return;
                                const delta =
                                  inputResizeRef.current.startY -
                                  moveEvent.clientY;
                                const nextHeight = Math.min(
                                  CHAT_INPUT_MAX_HEIGHT,
                                  Math.max(
                                    CHAT_INPUT_MIN_HEIGHT,
                                    inputResizeRef.current.startHeight + delta,
                                  ),
                                );
                                setInputHeight(nextHeight);
                              };
                              const onMouseUp = () => {
                                inputResizeRef.current = null;
                                window.removeEventListener(
                                  "mousemove",
                                  onMouseMove,
                                );
                                window.removeEventListener(
                                  "mouseup",
                                  onMouseUp,
                                );
                              };
                              window.addEventListener("mousemove", onMouseMove);
                              window.addEventListener("mouseup", onMouseUp);
                            }}
                            aria-hidden="true"
                          />
                          <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            onPaste={handlePaste}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void handleSubmit(
                                  event as unknown as React.FormEvent<HTMLFormElement>,
                                );
                              }
                            }}
                            disabled={isUploadingImage}
                            placeholder={
                              isUploadingImage
                                ? "이미지 업로드 중..."
                                : isHandoffDraftMode
                                  ? "관리자에게 남길 문의를 입력하세요"
                                  : "호록이에게 물어보세요"
                            }
                            rows={1}
                            style={{ height: inputHeight }}
                            className="block w-full resize-none overflow-y-auto bg-transparent pl-3 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500 disabled:opacity-50 [padding-block:0.6875rem]"
                          />
                          <button
                            type="submit"
                            className={cn(
                              "absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-transparent transition disabled:cursor-default",
                              platform === "cote"
                                ? "text-[#06923E] hover:text-[#047a33] disabled:text-[#06923E]/35"
                                : "text-orange-500 hover:text-orange-600 disabled:text-orange-200 dark:text-orange-400 dark:hover:text-orange-300 dark:disabled:text-orange-900",
                            )}
                            disabled={
                              !input.trim() || isLoading || isUploadingImage
                            }
                            aria-label="메시지 전송"
                          >
                            <Send className="size-4" />
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : null}
                </div>

                {isAdminHandoffView ? (
                  <form onSubmit={handleSubmit} className="border-t p-3">
                    <div
                      className={cn(
                        "relative rounded-3xl border bg-white shadow-md transition-shadow focus-within:shadow-lg",
                        platform === "cote"
                          ? "border-[#06923E]/25 dark:border-[#06923E]/30 dark:bg-slate-950"
                          : "border-orange-200 dark:border-orange-400/25 dark:bg-zinc-900",
                      )}
                    >
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(event) => setInput(event.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handleSubmit(
                              event as unknown as React.FormEvent<HTMLFormElement>,
                            );
                          }
                        }}
                        disabled={isUploadingImage}
                        placeholder={
                          isUploadingImage
                            ? "이미지 업로드 중..."
                            : "문의자에게 남길 답변을 입력하세요"
                        }
                        rows={1}
                        style={{ height: inputHeight }}
                        className="w-full resize-none overflow-y-auto bg-transparent pl-3 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-zinc-100 dark:placeholder:text-zinc-500 disabled:opacity-50 [padding-block:0.6875rem]"
                      />
                      <button
                        type="submit"
                        className={cn(
                          "absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-transparent transition disabled:cursor-default",
                          platform === "cote"
                            ? "text-[#06923E] hover:text-[#047a33] disabled:text-[#06923E]/35"
                            : "text-orange-500 hover:text-orange-600 disabled:text-orange-200 dark:text-orange-400 dark:hover:text-orange-300 dark:disabled:text-orange-900",
                        )}
                        disabled={
                          !input.trim() || isLoading || isUploadingImage
                        }
                        aria-label="메시지 전송"
                      >
                        <Send className="size-4" />
                      </button>
                    </div>
                  </form>
                ) : null}
              </>
            )}
          </div>

          {!isEmbedded && isOpen ? (
            <>
              <button
                type="button"
                onMouseDown={(event) => handleFloatingResizeStart(event, "top")}
                className="absolute inset-x-3 top-0 h-2 cursor-ns-resize"
                aria-label="채팅창 위쪽 크기 조절"
              />
              <button
                type="button"
                onMouseDown={(event) =>
                  handleFloatingResizeStart(event, "bottom")
                }
                className="absolute inset-x-3 bottom-0 h-2 cursor-ns-resize"
                aria-label="채팅창 아래쪽 크기 조절"
              />
              <button
                type="button"
                onMouseDown={(event) =>
                  handleFloatingResizeStart(event, "left")
                }
                className="absolute inset-y-3 left-0 w-2 cursor-ew-resize"
                aria-label="채팅창 왼쪽 크기 조절"
              />
              <button
                type="button"
                onMouseDown={(event) =>
                  handleFloatingResizeStart(event, "right")
                }
                className="absolute inset-y-3 right-0 w-2 cursor-ew-resize"
                aria-label="채팅창 오른쪽 크기 조절"
              />
              <button
                type="button"
                onMouseDown={(event) =>
                  handleFloatingResizeStart(event, "top-left")
                }
                className="absolute left-0 top-0 h-3 w-3 cursor-nwse-resize"
                aria-label="채팅창 좌상단 크기 조절"
              />
              <button
                type="button"
                onMouseDown={(event) =>
                  handleFloatingResizeStart(event, "top-right")
                }
                className="absolute right-0 top-0 h-3 w-3 cursor-nesw-resize"
                aria-label="채팅창 우상단 크기 조절"
              />
              <button
                type="button"
                onMouseDown={(event) =>
                  handleFloatingResizeStart(event, "bottom-left")
                }
                className="absolute bottom-0 left-0 h-3 w-3 cursor-nesw-resize"
                aria-label="채팅창 좌하단 크기 조절"
              />
              <button
                type="button"
                onMouseDown={(event) =>
                  handleFloatingResizeStart(event, "bottom-right")
                }
                className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize rounded-sm"
                aria-label="채팅창 우하단 크기 조절"
              >
                <span className="absolute right-0.5 bottom-0.5 h-2.5 w-2.5 border-r-2 border-b-2 border-slate-300 dark:border-zinc-600" />
              </button>
            </>
          ) : null}
        </div>

        {!isEmbedded && platform === "cote" ? (
          <div
            className={cn(
              "pointer-events-none absolute bottom-[calc(100%+1rem)] transition-all duration-300",
              isFloatingPanelLeftOfCenter ? "left-2" : "right-2",
              isOpen ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100",
            )}
            aria-hidden="true"
          >
            <div className="relative min-w-[184px] rounded-2xl bg-[#06923E] px-2.5 py-2 text-center text-xs font-medium text-white shadow-lg">
              잘 모르겠으면 나에게 물어봐!
              <span
                className={cn(
                  "absolute top-full h-0 w-0 border-x-[8px] border-t-[10px] border-x-transparent border-t-[#06923E]",
                  isFloatingPanelLeftOfCenter ? "left-5" : "right-5",
                )}
              />
            </div>
          </div>
        ) : null}

        {!isEmbedded ? (
          <button
            type="button"
            onMouseDown={(event) => {
              if (!isOpen) {
                handleFloatingDragStart(event);
              }
            }}
            onClick={handleFloatingToggle}
            className="pointer-events-auto group relative block size-16 transition hover:-translate-y-0.5 sm:size-[72px]"
            style={
              isOpen && isFloatingPanelLeftOfCenter
                ? {
                    marginLeft: -Math.max(
                      0,
                      floatingSize.width - FLOATING_BUTTON_SIZE,
                    ),
                  }
                : undefined
            }
            aria-label={isOpen ? "챗봇 접기" : "챗봇 열기"}
          >
            <Image
              src="/logo.png"
              alt="호록 챗봇"
              width={64}
              height={64}
              className={cn(
                "size-full object-contain transition",
                platform === "cote"
                  ? "drop-shadow-[0_0_18px_rgba(6,146,62,0.72)] group-hover:drop-shadow-[0_0_28px_rgba(6,146,62,0.88)]"
                  : "drop-shadow-[0_0_18px_rgba(255,154,0,0.82)] group-hover:drop-shadow-[0_0_28px_rgba(255,154,0,0.92)]",
              )}
              priority
            />
          </button>
        ) : null}
      </div>

      {previewImageUrl && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center px-6 animate-in fade-in duration-200"
              role="dialog"
              aria-modal="true"
              aria-label="프로필 이미지"
            >
              <button
                type="button"
                className="absolute inset-0 z-0 bg-black/60"
                onClick={() => setPreviewImageUrl(null)}
                aria-label="프로필 이미지 닫기"
              />
              <div className="relative z-10 rounded-2xl bg-white p-4 shadow-2xl dark:bg-zinc-900 animate-in zoom-in-95 duration-200">
                <Image
                  src={previewImageUrl}
                  alt="프로필 이미지 확대"
                  width={360}
                  height={360}
                  className="max-h-[80vh] max-w-[80vw] object-contain"
                />
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur-sm transition hover:bg-muted hover:text-foreground"
                  aria-label="프로필 이미지 닫기"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
