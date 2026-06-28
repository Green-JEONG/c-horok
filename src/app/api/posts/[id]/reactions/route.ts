import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getUserIdByEmail } from "@/lib/db";
import { createPostReactionNotificationMessage } from "@/lib/notification-messages";
import { getPostByIdWithSecretAccess } from "@/lib/post-detail-access";
import { isPostReactionEmoji } from "@/lib/post-reaction-options";
import {
  getPostReactionSummary,
  togglePostReaction,
} from "@/lib/post-reactions";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    return NextResponse.json({ message: "Invalid post id" }, { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.email
    ? await getUserIdByEmail(session.user.email)
    : null;
  const post = await getPostByIdWithSecretAccess(postId, {
    includeHiddenForUserId: userId,
  });

  if (!post) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (post.is_secret && !post.can_view_secret) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const reactions = await getPostReactionSummary(postId, userId);

  return NextResponse.json({ reactions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    return NextResponse.json({ message: "Invalid post id" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userId = await getUserIdByEmail(session.user.email);
  if (!userId) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const post = await getPostByIdWithSecretAccess(postId, {
    includeHiddenForUserId: userId,
  });
  if (!post) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (post.is_secret && !post.can_view_secret) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { emoji } = await req.json();
  if (!isPostReactionEmoji(emoji)) {
    return NextResponse.json({ message: "Invalid emoji" }, { status: 400 });
  }

  const result = await togglePostReaction({ postId, userId, emoji });
  const reactions = await getPostReactionSummary(postId, userId);

  if (result.reacted && post.user_id !== userId) {
    try {
      const actor = await prisma.user.findUnique({
        where: { id: BigInt(userId) },
        select: { name: true, email: true },
      });

      await prisma.notification.create({
        data: {
          userId: BigInt(post.user_id),
          actorId: BigInt(userId),
          type: "POST_REACTION",
          content: createPostReactionNotificationMessage({
            actorName: actor?.name ?? actor?.email,
            postTitle: post.title,
            emoji,
          }),
          postId: BigInt(postId),
        },
      });
    } catch (error) {
      console.error("🔔 게시글 반응 알림 생성 실패", error);
    }
  }

  return NextResponse.json({ ...result, reactions });
}
