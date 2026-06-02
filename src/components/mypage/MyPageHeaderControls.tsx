"use client";

import { ChevronDown, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type MyPageControlOption = {
  value: string;
  label: string;
};

type Props = {
  searchTargets?: MyPageControlOption[];
  sortOptions?: MyPageControlOption[];
};

const DEFAULT_SEARCH_TARGETS: MyPageControlOption[] = [
  { value: "text", label: "제목 및 본문" },
  { value: "category", label: "카테고리" },
];
const DEFAULT_SORT_OPTIONS: MyPageControlOption[] = [
  { value: "latest", label: "최신순" },
  { value: "oldest", label: "오래된순" },
  { value: "views", label: "조회순" },
  { value: "likes", label: "북마크순" },
  { value: "comments", label: "댓글순" },
  { value: "category", label: "카테고리순 (오름차)" },
  { value: "categoryDesc", label: "카테고리순 (내림차)" },
];

function getActiveOption(options: MyPageControlOption[], value: string | null) {
  return (
    options.find((option) => option.value === value) ??
    options[0] ?? { value: "", label: "" }
  );
}

function getMenuWidth(
  trigger: HTMLButtonElement,
  options: MyPageControlOption[],
  minWidth: number,
) {
  const context = document.createElement("canvas").getContext("2d");
  const font = window.getComputedStyle(trigger).font;
  const labelWidth =
    context && font
      ? Math.ceil(
          Math.max(
            ...options.map((option) => {
              context.font = font;
              return context.measureText(option.label).width;
            }),
          ),
        )
      : minWidth;

  return Math.max(trigger.getBoundingClientRect().width, labelWidth + 24);
}

export default function MyPageHeaderControls({
  searchTargets = DEFAULT_SEARCH_TARGETS,
  sortOptions = DEFAULT_SORT_OPTIONS,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const targetButtonRef = useRef<HTMLButtonElement>(null);
  const targetMenuRef = useRef<HTMLUListElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLUListElement>(null);
  const [focused, setFocused] = useState(false);
  const [targetMenuOpen, setTargetMenuOpen] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [targetMenuStyle, setTargetMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [sortMenuStyle, setSortMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const searchQuery = searchParams.get("q") ?? "";
  const activeTarget = getActiveOption(
    searchTargets,
    searchParams.get("searchTarget"),
  );
  const activeSort = getActiveOption(sortOptions, searchParams.get("sort"));
  const [searchInput, setSearchInput] = useState(searchQuery);
  const showSearchTarget = searchTargets.length > 1;

  const replaceSearchParams = useCallback(
    (nextParams: URLSearchParams) => {
      nextParams.delete("postId");
      nextParams.delete("qnaPostId");
      nextParams.delete("commentId");
      nextParams.delete("friendId");

      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router],
  );

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const nextQuery = searchInput.trim();

    if (nextQuery === searchQuery) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextQuery) {
        params.set("q", nextQuery);
      } else {
        params.delete("q");
      }

      replaceSearchParams(params);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [replaceSearchParams, searchInput, searchParams, searchQuery]);

  useEffect(() => {
    const updateMenuPosition = () => {
      if (showSearchTarget && targetMenuOpen && targetButtonRef.current) {
        const rect = targetButtonRef.current.getBoundingClientRect();
        const padding = 8;
        const menuWidth = getMenuWidth(
          targetButtonRef.current,
          searchTargets,
          104,
        );
        setTargetMenuStyle({
          top: rect.bottom + padding,
          left: Math.min(
            Math.max(padding, rect.right - menuWidth),
            window.innerWidth - menuWidth - padding,
          ),
          width: menuWidth,
        });
      }

      if (sortMenuOpen && sortButtonRef.current) {
        const rect = sortButtonRef.current.getBoundingClientRect();
        const padding = 8;
        const menuWidth = getMenuWidth(sortButtonRef.current, sortOptions, 112);
        setSortMenuStyle({
          top: rect.bottom + padding,
          left: Math.min(
            Math.max(padding, rect.right - menuWidth),
            window.innerWidth - menuWidth - padding,
          ),
          width: menuWidth,
        });
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        targetButtonRef.current?.contains(target) ||
        targetMenuRef.current?.contains(target)
      ) {
        return;
      }

      if (
        sortButtonRef.current?.contains(target) ||
        sortMenuRef.current?.contains(target)
      ) {
        return;
      }

      setTargetMenuOpen(false);
      setSortMenuOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setTargetMenuOpen(false);
        setSortMenuOpen(false);
      }
    };

    if (!targetMenuOpen && !sortMenuOpen) {
      return;
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    searchTargets,
    showSearchTarget,
    sortMenuOpen,
    sortOptions,
    targetMenuOpen,
  ]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    replaceSearchParams(params);
  }

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
        className={`flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-md border bg-background transition-colors sm:w-80 sm:flex-none ${
          focused
            ? "border-primary bg-primary/5"
            : "border-border bg-background"
        }`}
      >
        {showSearchTarget ? (
          <button
            ref={targetButtonRef}
            type="button"
            onClick={() => setTargetMenuOpen((value) => !value)}
            className="flex h-full max-w-28 shrink-0 items-center gap-1 border-r bg-transparent px-2 text-xs font-medium outline-none transition-colors hover:bg-muted sm:max-w-none"
            aria-haspopup="menu"
            aria-expanded={targetMenuOpen}
            aria-label="검색 범위"
          >
            <span className="min-w-0 truncate">{activeTarget.label}</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <input
          ref={inputRef}
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={`${activeTarget.label} 검색`}
          className="h-full min-w-0 flex-1 bg-transparent pl-2 text-sm outline-none sm:pl-3"
        />
        <button
          type="button"
          onClick={() => {
            setFocused(true);
            inputRef.current?.focus();
          }}
          className="flex h-9 w-8 shrink-0 items-center justify-center sm:w-9"
          aria-label="마이페이지 검색"
        >
          <Search className="h-4 w-4" />
        </button>
      </form>

      <button
        ref={sortButtonRef}
        type="button"
        onClick={() => setSortMenuOpen((value) => !value)}
        className="flex h-9 max-w-20 shrink-0 items-center gap-1 rounded-md border px-2 text-sm transition-colors hover:bg-muted sm:max-w-44 sm:px-3"
        aria-haspopup="menu"
        aria-expanded={sortMenuOpen}
      >
        <span className="min-w-0 truncate">{activeSort.label}</span>
        <ChevronDown className="h-4 w-4 shrink-0" />
      </button>

      {showSearchTarget && targetMenuOpen && targetMenuStyle
        ? createPortal(
            <ul
              ref={targetMenuRef}
              className="fixed z-100 rounded-md border bg-background text-sm shadow-md"
              style={targetMenuStyle}
            >
              {searchTargets.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      setParam("searchTarget", option.value);
                      setTargetMenuOpen(false);
                      inputRef.current?.focus();
                    }}
                    className="w-full whitespace-nowrap px-3 py-2 text-left hover:bg-muted"
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}

      {sortMenuOpen && sortMenuStyle
        ? createPortal(
            <ul
              ref={sortMenuRef}
              className="fixed z-100 rounded-md border bg-background text-sm shadow-md"
              style={sortMenuStyle}
            >
              {sortOptions.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      setParam("sort", option.value);
                      setSortMenuOpen(false);
                    }}
                    className="w-full whitespace-nowrap px-3 py-2 text-left hover:bg-muted"
                  >
                    {option.label}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </>
  );
}
