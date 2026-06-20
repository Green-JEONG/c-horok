import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import PostDownloadMenu from "@/components/posts/PostDownloadMenu";
import PostSeriesTable from "@/components/posts/PostSeriesTable";
import PostTitleStatusIcons, {
  getTitleStatusIndent,
} from "@/components/posts/PostTitleStatusIcons";
import type { DbPost, DbPostSeriesItem } from "@/lib/db";
import { isNoticeCategoryName } from "@/lib/notice-categories";
import { formatSeoulDateTime } from "@/lib/utils";

export default function PostHeader({
  post,
  actionSlot,
  titleAddon,
  seriesItems = [],
  isOwner = false,
  titleSection,
  titleStatusSection,
  titleStatusIndent,
  tagsSection,
}: {
  post: DbPost;
  actionSlot?: ReactNode;
  titleAddon?: ReactNode;
  seriesItems?: DbPostSeriesItem[];
  isOwner?: boolean;
  titleSection?: ReactNode;
  titleStatusSection?: ReactNode;
  titleStatusIndent?: string;
  tagsSection?: ReactNode;
}) {
  const createdDateTime = formatSeoulDateTime(post.created_at);
  const [, createdDateText = createdDateTime, createdTimeText = ""] =
    createdDateTime.match(/^(.+) (\d{2}:\d{2}:\d{2})$/) ?? [];
  const showSecretLock = post.is_secret;
  const showHiddenIcon = post.is_hidden;
  const categoryNames =
    post.category_names && post.category_names.length > 0
      ? post.category_names
      : [post.category_name];
  const visibleCategoryNames = categoryNames.filter(
    (categoryName) =>
      Boolean(categoryName) &&
      categoryName !== "미분류" &&
      !isNoticeCategoryName(categoryName),
  );
  const authorProfile = (
    <>
      <Image
        src={post.author_image ?? "/logo.png"}
        alt={`${post.author_name} 프로필`}
        width={28}
        height={28}
        className={`h-7 w-7 rounded-full border object-cover ${!post.author_image ? "grayscale" : ""}`}
      />
      <span>{post.author_name}</span>
    </>
  );

  const statusIcons =
    titleStatusSection ??
    (showHiddenIcon || showSecretLock ? (
      <PostTitleStatusIcons
        showHidden={showHiddenIcon}
        showSecret={showSecretLock}
      />
    ) : null);
  const titleStatusIndentValue =
    titleStatusIndent ??
    (statusIcons
      ? getTitleStatusIndent(showHiddenIcon, showSecretLock)
      : undefined);
  const applyWrapperTitleIndent = Boolean(statusIcons && !titleSection);

  return (
    <header className="mb-3">
      <PostSeriesTable currentPostId={post.id} items={seriesItems} />

      <h1 className="flex items-start gap-x-2 gap-y-2 text-3xl font-bold leading-tight">
        <div className="relative min-w-0 flex-1">
          {statusIcons ? (
            <span className="absolute top-0 left-0 flex items-center pt-1">
              {statusIcons}
            </span>
          ) : null}
          <div
            className="min-w-0 break-words [overflow-wrap:anywhere]"
            style={{
              textIndent: applyWrapperTitleIndent
                ? titleStatusIndentValue
                : undefined,
            }}
          >
            {titleSection ?? (
              <span className="whitespace-pre-wrap break-words">{post.title}</span>
            )}
          </div>
        </div>
        {titleAddon ? (
          <span className="inline-flex shrink-0 items-center self-start">
            {titleAddon}
          </span>
        ) : null}
        <span className="ml-auto shrink-0 self-start">
          <PostDownloadMenu
            postId={post.id}
            title={post.title}
            content={post.content}
            authorName={post.author_name}
            createdAt={post.created_at}
            initialMarkdownCount={post.markdown_download_count ?? 0}
            initialPdfCount={post.pdf_download_count ?? 0}
          />
        </span>
      </h1>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-h-7 flex-wrap items-center gap-3 text-base leading-7 text-foreground">
          {post.user_id ? (
            <Link
              href={isOwner ? "/horok-log" : `/users/${post.user_id}`}
              className="inline-flex h-7 items-center gap-2 transition hover:text-foreground"
            >
              {authorProfile}
            </Link>
          ) : (
            <span className="inline-flex h-7 items-center gap-2">
              {authorProfile}
            </span>
          )}
          <span className="text-muted-foreground/60">|</span>
          <span className="inline-flex h-7 items-center">
            <time dateTime={post.created_at.toISOString()}>
              {createdDateText}
            </time>
          </span>
          {createdTimeText ? (
            <>
              <span className="text-muted-foreground/60">|</span>
              <span className="inline-flex h-7 items-center">
                {createdTimeText}
              </span>
            </>
          ) : null}
          <span className="text-muted-foreground/60">|</span>
          <span className="inline-flex h-7 items-center">
            조회 {post.view_count}
          </span>
          <span className="text-muted-foreground/60">|</span>
          <span className="inline-flex h-7 items-center">
            댓글 {post.comments_count}
          </span>
          <span className="text-muted-foreground/60">|</span>
          <span className="inline-flex h-7 items-center">
            반응 {post.reactions_count}
          </span>
        </div>

        {actionSlot ? (
          <div className="shrink-0 self-end sm:self-auto">{actionSlot}</div>
        ) : null}
      </div>

      {tagsSection ? (
        <div className="mt-3">{tagsSection}</div>
      ) : visibleCategoryNames.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleCategoryNames.map((categoryName) => (
            <span
              key={categoryName}
              className="inline-flex h-7 items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 text-sm font-medium text-foreground"
            >
              #{categoryName.toLocaleLowerCase()}
            </span>
          ))}
        </div>
      ) : null}

      <hr className="mt-2" />
    </header>
  );
}
