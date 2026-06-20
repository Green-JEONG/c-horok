import {
  Bookmark,
  Eye,
  MessageCircle,
  PenSquare,
  SmilePlus,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import PostCroppedThumbnail from "@/components/posts/PostCroppedThumbnail";
import PostTitleStatusIcons from "@/components/posts/PostTitleStatusIcons";
import { getPostCardPreviewText } from "@/lib/post-card-preview";
import {
  isDefaultPostThumbnailUrl,
  isGifImageUrl,
  POST_CARD_THUMBNAIL_SIZES,
} from "@/lib/post-thumbnails";
import type { PostThumbnailCrop } from "@/lib/post-thumbnail-crop";
import {
  getLogFaqPath,
  getLogFeedPostPath,
  getLogLikesPostPath,
  getLogNoticePath,
} from "@/lib/routes";
import { cn, formatSeoulDate } from "@/lib/utils";

type Props = {
  id: number;
  title: string;
  description: string;
  category: string;
  author: string;
  authorImage?: string | null;
  likes: number;
  reactions?: number;
  comments: number;
  views?: number;
  createdAt: Date;
  thumbnail?: string | null;
  thumbnailCrop?: PostThumbnailCrop | null;
  isHidden?: boolean;
  isSecret?: boolean;
  isDraft?: boolean;
  canViewSecret?: boolean;
  categoryBadgeText?: string;
  categoryBadgeClassName?: string;
  showCategoryBadge?: boolean;
  statusBadges?: Array<{
    text: string;
    className: string;
  }>;
  postRouteSection?: "feeds" | "likes";
  hrefOverride?: string;
  className?: string;
  thumbnailLoading?: "eager" | "lazy";
  thumbnailPriority?: boolean;
};

export default function PostCard({
  id,
  title,
  thumbnail,
  thumbnailCrop = null,
  description,
  category,
  author,
  authorImage = null,
  likes,
  reactions = 0,
  comments,
  views = 0,
  createdAt,
  isHidden = false,
  isSecret = false,
  isDraft = false,
  canViewSecret = true,
  categoryBadgeText,
  categoryBadgeClassName,
  showCategoryBadge = true,
  statusBadges = [],
  postRouteSection = "feeds",
  hrefOverride,
  className = "",
  thumbnailLoading = "lazy",
  thumbnailPriority = false,
}: Props) {
  const isNotice = ["공지", "FAQ", "QnA"].includes(category);
  const isUncategorized = !category || category === "미분류";
  const href =
    hrefOverride ??
    (category === "FAQ"
      ? getLogFaqPath(id)
      : isNotice
        ? getLogNoticePath(id)
        : postRouteSection === "likes"
          ? getLogLikesPostPath(id)
          : getLogFeedPostPath(id));
  const defaultBadge = isUncategorized
    ? null
    : {
        text: `#${category === "QnA" ? "문의" : category.toLocaleLowerCase()}`,
        className: "border-border bg-background text-foreground",
      };
  const primaryBadge = statusBadges[0]
    ? statusBadges[0]
    : showCategoryBadge && defaultBadge
      ? {
          text: categoryBadgeText ?? defaultBadge.text,
          className: categoryBadgeClassName ?? defaultBadge.className,
        }
      : null;
  const normalizedThumbnail = thumbnail?.trim() || null;
  const isDefaultThumbnail = isDefaultPostThumbnailUrl(normalizedThumbnail);
  const isAnimatedGifThumbnail = Boolean(
    normalizedThumbnail && isGifImageUrl(normalizedThumbnail),
  );
  const previewText = getPostCardPreviewText(description);

  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-background shadow-sm",
        isAnimatedGifThumbnail ? "card-hover-lift" : "card-hover-scale",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex w-full items-center justify-center bg-zinc-900",
          isDefaultThumbnail ? "h-30" : "aspect-video",
        )}
      >
        <PostCroppedThumbnail
          src={normalizedThumbnail ?? "/thumbnails.png"}
          alt={title}
          crop={isDefaultThumbnail ? null : thumbnailCrop}
          fill
          sizes={POST_CARD_THUMBNAIL_SIZES}
          loading={thumbnailLoading}
          priority={thumbnailPriority}
          unoptimized={!isDefaultThumbnail}
          quality={90}
          objectFit={isDefaultThumbnail ? "contain" : "cover"}
          className={isDefaultThumbnail ? "p-8" : undefined}
        />
        <div className="absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pb-2 pt-10">
          <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-white drop-shadow">
            <span className="inline-flex items-center gap-1">
              <Bookmark className="h-3.5 w-3.5" />
              {likes}
            </span>
            <span className="inline-flex items-center gap-1">
              <SmilePlus className="h-3.5 w-3.5" />
              {reactions}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3.5 w-3.5" />
              {comments}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {views}
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="mb-1.5 flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Image
              src={authorImage ?? "/logo.png"}
              alt={`${author} 프로필`}
              width={20}
              height={20}
              className={`h-5 w-5 shrink-0 rounded-full border object-cover ${!authorImage ? "grayscale" : ""}`}
            />
            <p className="min-w-0 flex-1 truncate">{author}</p>
            <span className="shrink-0 whitespace-nowrap">
              {formatSeoulDate(createdAt)}
            </span>
          </div>
          <div className="flex min-h-6 min-w-0">
            {primaryBadge ? (
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${primaryBadge.className}`}
              >
                {primaryBadge.text}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mb-1 flex min-w-0 items-start gap-1.5">
          {isHidden || isSecret || isDraft ? (
            <span className="inline-flex shrink-0 items-center gap-1 pt-0.5">
              <PostTitleStatusIcons
                showHidden={isHidden}
                showSecret={isSecret}
                iconClassName="h-3.5 w-3.5"
                className="gap-1"
              />
              {isDraft ? (
                <PenSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : null}
            </span>
          ) : null}
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug">
            {title}
          </h3>
        </div>

        <p className="line-clamp-1 text-xs text-muted-foreground">
          {isSecret && !canViewSecret ? "비밀글입니다." : previewText}
        </p>

        <div className="mt-auto" />
      </div>
    </Link>
  );
}
