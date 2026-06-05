import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import {
  getCommentReactionSummary,
  toggleCommentReaction,
} from "@/lib/comment-reactions";
import { getUserIdByEmail } from "@/lib/db";
import { createCommentReactionNotificationMessage } from "@/lib/notification-messages";
import { isPostReactionEmoji } from "@/lib/post-reaction-options";
import { prisma } from "@/lib/prisma";

async function getViewableComment(
  commentId: number,
  options?: {
    userId?: number | null;
    isAdmin?: boolean;
  },
) {
  const comment = await prisma.comment.findUnique({
    where: { id: BigInt(commentId) },
    select: {
      id: true,
      userId: true,
      postId: true,
      content: true,
      isDeleted: true,
      isHidden: true,
      isSecret: true,
      post: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!comment || comment.isDeleted) {
    return null;
  }

  if (comment.isHidden && Number(comment.userId) !== options?.userId) {
    return null;
  }

  const canView =
    !comment.isSecret ||
    Number(comment.userId) === options?.userId ||
    Number(comment.post.userId) === options?.userId ||
    Boolean(options?.isAdmin);

  return canView ? comment : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const commentId = Number(id);

  if (Number.isNaN(commentId)) {
    return NextResponse.json(
      { message: "Invalid comment id" },
      { status: 400 },
    );
  }

  const session = await auth();
  const userId = session?.user?.email
    ? await getUserIdByEmail(session.user.email)
    : null;
  const comment = await getViewableComment(commentId, {
    userId,
    isAdmin: session?.user?.role === "ADMIN",
  });

  if (!comment) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const reactions = await getCommentReactionSummary(commentId, userId);

  return NextResponse.json({ reactions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const commentId = Number(id);

  if (Number.isNaN(commentId)) {
    return NextResponse.json(
      { message: "Invalid comment id" },
      { status: 400 },
    );
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = await getUserIdByEmail(session.user.email);
  if (!userId) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const comment = await getViewableComment(commentId, {
    userId,
    isAdmin: session.user.role === "ADMIN",
  });
  if (!comment) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const { emoji } = await req.json();
  if (!isPostReactionEmoji(emoji)) {
    return NextResponse.json({ message: "Invalid emoji" }, { status: 400 });
  }

  const result = await toggleCommentReaction({ commentId, userId, emoji });
  const reactions = await getCommentReactionSummary(commentId, userId);

  if (result.reacted && Number(comment.userId) !== userId) {
    try {
      const actor = await prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { name: true, email: true },
      });

      await prisma.notification.create({
        data: {
          userId: comment.userId,
          actorId: BigInt(userId),
          type: "COMMENT_REACTION",
          content: createCommentReactionNotificationMessage({
            actorName: actor?.name ?? actor?.email,
            commentContent: comment.content,
            emoji,
          }),
          postId: comment.postId,
          commentId: BigInt(commentId),
        },
      });
    } catch (error) {
      console.error("🔔 댓글 반응 알림 생성 실패", error);
    }
  }

  return NextResponse.json({ ...result, reactions });
}
