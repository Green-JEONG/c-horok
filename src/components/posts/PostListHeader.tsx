"use client";

import { ChevronDown, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { parsePostSearchTarget } from "@/lib/post-search-target";
import { parseSortType, type SortType } from "@/lib/post-sort";
import HomeWriteButton from "../home/HomeWriteButton";
import SearchTargetDropdown from "./SearchTargetDropdown";

const SORT_LABEL: Record<SortType, string> = {
  latest: "최신순",
  oldest: "오래된순",
  views: "조회순",
  likes: "북마크순",
  comments: "댓글순",
  category: "카테고리순 (오름차)",
  categoryDesc: "카테고리순 (내림차)",
};

const DEFAULT_SORT_OPTIONS: SortType[] = [
  "latest",
  "oldest",
  "views",
  "likes",
  "comments",
  "category",
  "categoryDesc",
];

function getSortMenuWidth(trigger: HTMLButtonElement, sortOptions: SortType[]) {
  const context = document.createElement("canvas").getContext("2d");
  const font = window.getComputedStyle(trigger).font;
  const labelWidth =
    context && font
      ? Math.ceil(
          Math.max(
            ...sortOptions.map((option) => {
              context.font = font;
              return context.measureText(SORT_LABEL[option]).width;
            }),
          ),
        )
      : 112;

  return labelWidth + 24;
}

type Props = {
  title?: ReactNode;
  showWriteButton?: boolean;
  titleAction?: ReactNode;
  headerActions?: ReactNode;
  sortOptions?: SortType[];
  writeButtonHref?: string;
  writeButtonLabel?: string;
  searchPlaceholder?: string;
  searchQueryParam?: string;
  searchTargetParam?: string;
  showSortButton?: boolean;
};

export default function PostListHeader({
  title: customTitle,
  showWriteButton,
  titleAction,
  headerActions,
  sortOptions = DEFAULT_SORT_OPTIONS,
  writeButtonHref,
  writeButtonLabel,
  searchPlaceholder,
  searchQueryParam = "q",
  searchTargetParam,
  showSortButton = true,
}: Props = {}) {
  const [open, setOpen] = useState(false);
  const [searchHighlighted, setSearchHighlighted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const searchFormRef = useRef<HTMLFormElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sort = parseSortType(searchParams.get("sort"));
  const category = searchParams.get("category");
  const searchQuery = searchParams.get(searchQueryParam) ?? "";
  const searchTarget = parsePostSearchTarget(
    searchTargetParam ? searchParams.get(searchTargetParam) : null,
  );
  const showSearch = Boolean(searchPlaceholder);
  const showSearchTarget = Boolean(searchTargetParam);

  const isFeedPage =
    pathname === "/horok-log/feeds" ||
    pathname.startsWith("/horok-log/feeds/");
  const isLikesPage =
    pathname === "/horok-log/likes" ||
    pathname.startsWith("/horok-log/likes/");

  const title =
    customTitle ??
    (category
      ? `#${category}`
      : isLikesPage
        ? "북마크"
        : isFeedPage
          ? "소식"
          : "내 글");

  const canShowWriteButton = showWriteButton ?? false;

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (!showSearch) {
      setSearchHighlighted(false);
    }
  }, [showSearch]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updateMenuPosition = () => {
      const trigger = buttonRef.current;

      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const padding = 8;
      const menuWidth = getSortMenuWidth(trigger, sortOptions);
      const estimatedHeight = 168;
      const canOpenDownward =
        rect.bottom + padding + estimatedHeight <= window.innerHeight - padding;

      setMenuStyle({
        top: canOpenDownward
          ? rect.bottom + padding
          : Math.max(padding, rect.top - estimatedHeight - padding),
        left: Math.min(
          Math.max(padding, rect.right - menuWidth),
          window.innerWidth - menuWidth - padding,
        ),
        width: menuWidth,
      });
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        buttonRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

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
  }, [open, sortOptions]);

  useEffect(() => {
    if (!showSearch) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (searchFormRef.current?.contains(target)) {
        return;
      }

      setSearchHighlighted(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchHighlighted(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSearch]);

  useEffect(() => {
    if (!showSearch) {
      return;
    }

    const timeout = window.setTimeout(() => {
      if (searchQuery) {
        searchInputRef.current?.focus();
      }
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [showSearch, searchQuery]);

  useEffect(() => {
    if (!showSearch) {
      return;
    }

    const nextQuery = searchInput.trim();

    if (nextQuery === searchQuery) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (nextQuery) {
        params.set(searchQueryParam, nextQuery);
      } else {
        params.delete(searchQueryParam);
      }

      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [
    pathname,
    router,
    searchInput,
    searchParams,
    searchQuery,
    searchQueryParam,
    showSearch,
  ]);

  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex shrink-0 items-center gap-2">
        <h2 className="min-w-0 whitespace-nowrap text-lg font-bold tracking-tight text-foreground">
          {title}
        </h2>
        {titleAction}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {headerActions}
        {canShowWriteButton ? (
          <HomeWriteButton href={writeButtonHref} label={writeButtonLabel} />
        ) : null}
        {showSearch ? (
          <form
            ref={searchFormRef}
            onSubmit={(event) => {
              event.preventDefault();
            }}
            onFocusCapture={() => {
              setSearchHighlighted(true);
            }}
            className={`flex h-9 items-center overflow-hidden rounded-md border bg-background transition-colors ${
              searchHighlighted
                ? "border-primary bg-primary/5"
                : "border-border bg-background"
            } ${showSearchTarget ? "min-w-0 flex-1 sm:max-w-80" : "min-w-0 flex-1 sm:max-w-64"}`}
          >
            {showSearchTarget && searchTargetParam ? (
              <SearchTargetDropdown
                value={searchTarget}
                onChange={(nextTarget) => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set(searchTargetParam, nextTarget);
                  params.delete("page");
                  router.replace(`${pathname}?${params.toString()}`);
                  searchInputRef.current?.focus();
                }}
              />
            ) : null}
            <input
              ref={searchInputRef}
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onFocus={() => setSearchHighlighted(true)}
              placeholder={
                showSearchTarget ? `${searchPlaceholder}` : searchPlaceholder
              }
              className="h-full min-w-0 flex-1 bg-transparent pl-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setSearchHighlighted(true);
                searchInputRef.current?.focus();
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center"
              aria-label="검색"
              aria-expanded
            >
              <Search className="h-4 w-4" />
            </button>
          </form>
        ) : null}
        {showSortButton ? (
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="flex items-center gap-1 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <span className="whitespace-nowrap">
              {SORT_LABEL[sortOptions.includes(sort) ? sort : sortOptions[0]]}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </button>
        ) : null}
      </div>

      {showSortButton && open && menuStyle
        ? createPortal(
            <ul
              ref={menuRef}
              className="fixed z-100 rounded-md border bg-background text-sm shadow-md"
              style={menuStyle}
            >
              {sortOptions.map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => {
                      const params = new URLSearchParams(
                        searchParams.toString(),
                      );
                      params.set("sort", key);
                      router.push(`${pathname}?${params.toString()}`);
                      setOpen(false);
                    }}
                    className="w-full whitespace-nowrap px-3 py-2 text-left hover:bg-muted"
                  >
                    {SORT_LABEL[key]}
                  </button>
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
