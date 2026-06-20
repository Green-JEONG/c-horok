import Link from "next/link";
import type { ReactNode } from "react";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getUserIdByEmail } from "@/lib/db";
import { getPostReactionSummary } from "@/lib/post-reactions";
import { prisma } from "@/lib/prisma";
import CopyPostButton from "./CopyPostButton";
import LikeButton from "./LikeButton";
import PostReactionButton from "./PostReactionButton";

type Props = {
  postId: number;
  backHref?: string;
  showLikeButton?: boolean;
  likeActionSlot?: ReactNode;
  markCheckingOnAdminReaction?: boolean;
};

export default async function PostFooter({
  postId,
  backHref = "/horok-log/feeds",
  showLikeButton = true,
  likeActionSlot,
  markCheckingOnAdminReaction = false,
}: Props) {
  const [likeCount, copyCount, session] = await Promise.all([
    prisma.postLike.count({
      where: { postId: BigInt(postId) },
    }),
    prisma.post.count({
      where: {
        quotedPostId: BigInt(postId),
        isDeleted: false,
      },
    }),
    auth(),
  ]);

  let liked = false;
  let userId: number | null = null;

  if (session?.user?.email) {
    userId = await getUserIdByEmail(session.user.email);

    if (userId) {
      const like = await prisma.postLike.findUnique({
        where: {
          postId_userId: {
            postId: BigInt(postId),
            userId: BigInt(userId),
          },
        },
        select: { postId: true },
      });
      liked = Boolean(like);
    }
  }
  const reactions = await getPostReactionSummary(postId, userId);

  return (
    <footer
      className={`flex items-center border-t pt-2 ${
        showLikeButton ? "justify-between" : "justify-end"
      }`}
    >
      {showLikeButton ? (
        <div className="flex items-center gap-2">
          <LikeButton
            postId={postId}
            initialLiked={liked}
            initialCount={likeCount}
            disabled={!session?.user?.email}
          />
          {likeActionSlot}
          <CopyPostButton
            postId={postId}
            initialCount={copyCount}
            disabled={!session?.user?.email}
          />
          <PostReactionButton
            postId={postId}
            initialReactions={reactions}
            disabled={!session?.user?.email}
            markCheckingOnAdminReaction={markCheckingOnAdminReaction}
          />
        </div>
      ) : null}

      <Link
        href={backHref}
        className="box-border inline-flex h-7 items-center justify-center rounded-md border px-3 py-1.5 text-xs leading-none transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
      >
        목록
      </Link>
    </footer>
  );
}
