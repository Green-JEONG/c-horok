"use client";

import { Search, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  Fragment,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isNoticeCategoryName } from "@/lib/notice-categories";
import {
  getTechFaqPath,
  getTechFeedPostPath,
  getTechNoticePath,
} from "@/lib/routes";

type SearchSuggestion = {
  id: number;
  title: string;
  content: string;
  thumbnail: string | null;
  category_name: string;
  author_name: string;
};

type UserSuggestion = {
  id: number;
  name: string | null;
  image: string | null;
  followerCount: number;
  postCount: number;
};

type SearchSuggestionResponse = {
  users: UserSuggestion[];
  posts: SearchSuggestion[];
  userCount: number;
  postCount: number;
  postCounts: SearchPreviewPostCounts;
  totalCount: number;
};

type SearchPreviewPostCounts = {
  posts: number;
  notice: number;
  faq: number;
  qna: number;
};

const SEARCH_PREVIEW_GROUPS = [
  {
    label: "게시물",
    countKey: "posts",
    matches: (post: SearchSuggestion) =>
      !isNoticeCategoryName(post.category_name),
  },
  {
    label: "공지",
    countKey: "notice",
    matches: (post: SearchSuggestion) => post.category_name === "공지",
  },
  {
    label: "FAQ",
    countKey: "faq",
    matches: (post: SearchSuggestion) => post.category_name === "FAQ",
  },
  {
    label: "문의",
    countKey: "qna",
    matches: (post: SearchSuggestion) => post.category_name === "QnA",
  },
] as const;

type HeaderSearchState = {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
};

const HeaderSearchStateContext = createContext<HeaderSearchState | null>(null);

export function HeaderSearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);

  return (
    <HeaderSearchStateContext.Provider value={value}>
      {children}
    </HeaderSearchStateContext.Provider>
  );
}

function useHeaderSearchState() {
  const sharedState = useContext(HeaderSearchStateContext);
  const [localQuery, setLocalQuery] = useState("");

  return sharedState ?? { query: localQuery, setQuery: setLocalQuery };
}

function getSuggestionHref(post: SearchSuggestion) {
  return post.category_name === "FAQ"
    ? getTechFaqPath(post.id)
    : isNoticeCategoryName(post.category_name)
      ? getTechNoticePath(post.id)
      : getTechFeedPostPath(post.id);
}

export default function HeaderSearch() {
  const { query, setQuery } = useHeaderSearchState();
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [totalResultCount, setTotalResultCount] = useState<number | null>(null);
  const [userResultCount, setUserResultCount] = useState(0);
  const [mobileSuggestionTop, setMobileSuggestionTop] = useState<number | null>(
    null,
  );
  const [postGroupResultCounts, setPostGroupResultCounts] =
    useState<SearchPreviewPostCounts>({
      posts: 0,
      notice: 0,
      faq: 0,
      qna: 0,
    });
  const router = useRouter();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const deferredQuery = useDeferredValue(query);

  function clearSearch() {
    setQuery("");
    setSuggestions([]);
    setUserSuggestions([]);
    setTotalResultCount(null);
    setUserResultCount(0);
    setPostGroupResultCounts({ posts: 0, notice: 0, faq: 0, qna: 0 });
    setIsOpen(false);
    setIsLoading(false);
    inputRef.current?.focus();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setIsOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  useEffect(() => {
    const trimmedQuery = deferredQuery.trim();

    if (trimmedQuery.length < 2) {
      setSuggestions([]);
      setUserSuggestions([]);
      setTotalResultCount(null);
      setUserResultCount(0);
      setPostGroupResultCounts({ posts: 0, notice: 0, faq: 0, qna: 0 });
      setIsLoading(false);
      return;
    }

    setTotalResultCount(null);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(trimmedQuery)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          setSuggestions([]);
          setUserSuggestions([]);
          setTotalResultCount(0);
          setUserResultCount(0);
          setPostGroupResultCounts({ posts: 0, notice: 0, faq: 0, qna: 0 });
          return;
        }

        const data = (await response.json()) as SearchSuggestionResponse;
        setUserSuggestions(Array.isArray(data.users) ? data.users : []);
        setSuggestions(Array.isArray(data.posts) ? data.posts : []);
        setTotalResultCount(
          typeof data.totalCount === "number" ? data.totalCount : 0,
        );
        setUserResultCount(
          typeof data.userCount === "number" ? data.userCount : 0,
        );
        setPostGroupResultCounts({
          posts:
            typeof data.postCounts?.posts === "number"
              ? data.postCounts.posts
              : 0,
          notice:
            typeof data.postCounts?.notice === "number"
              ? data.postCounts.notice
              : 0,
          faq:
            typeof data.postCounts?.faq === "number" ? data.postCounts.faq : 0,
          qna:
            typeof data.postCounts?.qna === "number" ? data.postCounts.qna : 0,
        });
        setIsOpen(true);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
          setUserSuggestions([]);
          setTotalResultCount(0);
          setUserResultCount(0);
          setPostGroupResultCounts({ posts: 0, notice: 0, faq: 0, qna: 0 });
        }
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [deferredQuery]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const shouldShowSuggestions = query.trim().length >= 2 && isOpen;

  useEffect(() => {
    if (!shouldShowSuggestions) {
      setMobileSuggestionTop(null);
      return;
    }

    function updateMobileSuggestionTop() {
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      setMobileSuggestionTop(wrapperRect ? wrapperRect.bottom : null);
    }

    updateMobileSuggestionTop();
    window.addEventListener("resize", updateMobileSuggestionTop);
    window.addEventListener("scroll", updateMobileSuggestionTop, true);

    return () => {
      window.removeEventListener("resize", updateMobileSuggestionTop);
      window.removeEventListener("scroll", updateMobileSuggestionTop, true);
    };
  }, [shouldShowSuggestions]);

  const canSubmitSearch = query.trim().length > 0;
  const hasSuggestions = userSuggestions.length > 0 || suggestions.length > 0;
  const suggestionGroups = SEARCH_PREVIEW_GROUPS.map((group) => ({
    label: group.label,
    countKey: group.countKey,
    posts: suggestions.filter(group.matches).slice(0, 3),
  })).filter((group) => group.posts.length > 0);
  const visibleUserSuggestions = userSuggestions.slice(0, 3);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form
        onSubmit={onSubmit}
        className="flex h-9 w-full items-center overflow-hidden rounded-full border bg-background transition-colors focus-within:bg-primary/5 focus-within:ring-2 focus-within:ring-primary"
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          placeholder="검색"
          className="h-full min-w-0 flex-1 bg-transparent pl-3 text-sm outline-none"
        />
        <span className="flex h-9 w-6 shrink-0 items-center justify-center text-[11px] text-muted-foreground">
          {query.trim().length >= 2 && totalResultCount !== null
            ? totalResultCount
            : ""}
        </span>
        {query ? (
          <button
            type="button"
            onClick={clearSearch}
            className="flex h-9 w-6 shrink-0 items-center justify-center"
            aria-label="검색어 지우기"
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/20 bg-muted-foreground/20 text-muted-foreground transition hover:bg-muted-foreground/30 hover:text-foreground">
              <X className="h-2 w-2" />
            </span>
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!canSubmitSearch}
          className={`flex h-9 w-9 shrink-0 items-center justify-center transition-colors ${
            canSubmitSearch
              ? "text-muted-foreground hover:text-foreground"
              : "cursor-not-allowed text-muted-foreground/35"
          }`}
          aria-label="검색"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>

      {shouldShowSuggestions ? (
        <div
          className="fixed top-[var(--header-search-suggestion-top)] right-4 left-4 z-50 mt-2 overflow-hidden rounded-2xl border bg-background shadow-xl sm:absolute sm:top-full sm:right-0 sm:left-0"
          style={
            mobileSuggestionTop === null
              ? undefined
              : ({
                  "--header-search-suggestion-top": `${mobileSuggestionTop}px`,
                } as React.CSSProperties)
          }
        >
          {isLoading ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              검색 결과를 찾는 중...
            </p>
          ) : hasSuggestions ? (
            <ul>
              {visibleUserSuggestions.length > 0 ? (
                <>
                  <li className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span>유저</span>
                      <span>{userResultCount}</span>
                    </span>
                  </li>
                  {visibleUserSuggestions.map((user) => (
                    <li
                      key={`user-${user.id}`}
                      className="border-b last:border-b-0"
                    >
                      <Link
                        href={`/users/${user.id}`}
                        onClick={() => setIsOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/60"
                      >
                        <Image
                          src={user.image ?? "/logo.png"}
                          alt={`${user.name ?? "사용자"} 프로필`}
                          width={40}
                          height={40}
                          className={`h-10 w-10 rounded-full border object-cover ${!user.image ? "grayscale" : ""}`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {user.name ?? "이름 없는 사용자"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {`팔로워 ${user.followerCount}명 · 글 ${user.postCount}개`}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </>
              ) : null}
              {suggestionGroups.map((group) => (
                <Fragment key={group.label}>
                  <li className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <span>{group.label}</span>
                      <span>{postGroupResultCounts[group.countKey]}</span>
                    </span>
                  </li>
                  {group.posts.map((post) => (
                    <li key={post.id} className="border-b last:border-b-0">
                      <Link
                        href={getSuggestionHref(post)}
                        onClick={() => setIsOpen(false)}
                        className="flex items-stretch gap-3 px-4 py-3 transition hover:bg-muted/60"
                      >
                        <div className="relative w-14 shrink-0 self-stretch overflow-hidden rounded-lg bg-zinc-900">
                          <Image
                            src={post.thumbnail ?? "/thumbnails.png"}
                            alt={post.title}
                            fill
                            sizes="56px"
                            unoptimized={Boolean(post.thumbnail)}
                            className={
                              post.thumbnail
                                ? "object-cover"
                                : "object-contain p-3"
                            }
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-semibold text-foreground">
                            {post.title}
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            #{post.category_name.toLocaleLowerCase()} ·{" "}
                            {post.author_name}
                          </p>
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                            {post.content}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </Fragment>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">
              검색 결과가 없습니다.
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              router.push(`/search?q=${encodeURIComponent(query)}`);
            }}
            className="w-full border-t px-4 py-3 text-left text-sm font-medium text-foreground transition hover:bg-muted/60"
          >
            전체 검색 결과 보기
          </button>
        </div>
      ) : null}
    </div>
  );
}
