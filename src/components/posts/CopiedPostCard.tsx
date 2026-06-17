import Image from "next/image";
import Link from "next/link";
import type { DbCopiedPost } from "@/lib/db";
import { getTechFeedPostPath } from "@/lib/routes";
import { formatSeoulDateTime } from "@/lib/utils";

type Props = {
  copiedPost: DbCopiedPost;
};

function getPlainPreview(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\(([^)]*)\)/g, " ")
    .replace(/[#>*_`~|[\]-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function CopiedPostCard({ copiedPost }: Props) {
  const preview = getPlainPreview(copiedPost.content);

  return (
    <div className="mb-6">
      <span className="block text-xl font-bold text-primary">
        복사한 글
      </span>
      <Link
        href={getTechFeedPostPath(copiedPost.id)}
        className="group grid w-full min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-3 border-b border-border py-4 text-left transition hover:text-foreground sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-5 lg:grid-cols-[144px_minmax(0,1fr)]"
      >
        <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          <Image
            src={copiedPost.thumbnail ?? "/thumbnails.png"}
            alt={`${copiedPost.title} 썸네일`}
            fill
            unoptimized
            className="object-cover"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 pt-0.5 sm:gap-3">
          <span className="block min-w-0 overflow-hidden text-base font-bold leading-tight text-foreground group-hover:underline sm:text-2xl">
            {copiedPost.title}
          </span>
          {preview ? (
            <span
              className="block min-w-0 overflow-hidden text-sm leading-5 text-muted-foreground sm:leading-6"
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                maxHeight: "3rem",
              }}
            >
              {preview}
            </span>
          ) : null}
          <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-muted-foreground sm:text-lg">
            <span className="inline-flex min-w-0 items-center gap-2">
              <Image
                src={copiedPost.author_image ?? "/logo.png"}
                alt={`${copiedPost.author_name} 프로필`}
                width={28}
                height={28}
                unoptimized
                className={`h-6 w-6 rounded-full border object-cover sm:h-7 sm:w-7 ${
                  !copiedPost.author_image ? "grayscale" : ""
                }`}
              />
              <span className="truncate">{copiedPost.author_name}</span>
            </span>
            <span className="text-muted-foreground/60">|</span>
            <span>{formatSeoulDateTime(copiedPost.created_at)}</span>
          </span>
        </div>
      </Link>
    </div>
  );
}
