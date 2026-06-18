import Image from "next/image";
import CopiedPostCard from "@/components/posts/CopiedPostCard";
import PostAttachmentsAccordion from "@/components/posts/PostAttachmentsAccordion";
import MarkdownRenderer from "@/components/posts/MarkdownRenderer";
import PostHashScroll from "@/components/posts/PostHashScroll";
import type { DbPost } from "@/lib/db";

function contentIncludesImageUrl(content: string, imageUrl?: string | null) {
  const normalizedImageUrl = imageUrl?.trim();

  return Boolean(normalizedImageUrl && content.includes(normalizedImageUrl));
}

export default function PostContent({ post }: { post: DbPost }) {
  if (post.is_secret && !post.can_view_secret) {
    return (
      <section className="my-6 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
        비밀글입니다. 작성자와 관리자만 내용을 확인할 수 있습니다.
      </section>
    );
  }

  const thumbnail = post.thumbnail;
  const isCopiedOriginalThumbnail =
    Boolean(post.copied_from_post?.thumbnail) &&
    thumbnail === post.copied_from_post?.thumbnail;
  const shouldShowThumbnail =
    thumbnail &&
    !isCopiedOriginalThumbnail &&
    !contentIncludesImageUrl(post.content, thumbnail);

  return (
    <section className="">
      {post.copied_from_post ? (
        <CopiedPostCard copiedPost={post.copied_from_post} />
      ) : null}

      {shouldShowThumbnail ? (
        <div className="relative mb-6 aspect-[16/9] overflow-hidden rounded-xl">
          <Image
            src={thumbnail}
            alt={post.title}
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      ) : null}
      <PostHashScroll />
      {post.attachments && post.attachments.length > 0 ? (
        <div className="mb-4 flex justify-end">
          <PostAttachmentsAccordion attachments={post.attachments} />
        </div>
      ) : null}
      <MarkdownRenderer content={post.content} />
    </section>
  );
}
