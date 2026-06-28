import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getUserIdByEmail } from "@/lib/db";
import {
  isNoticeCategoryName,
  normalizeNoticeCategory,
} from "@/lib/notice-categories";
import {
  createCommentNotificationMessage,
  createCommentReactionNotificationMessage,
  createFollowerNotificationMessage,
  createNewInquiryNotificationMessage,
  createNewPostNotificationMessage,
  createPostBookmarkNotificationMessage,
  createPostReactionNotificationMessage,
} from "@/lib/notification-messages";
import { prisma } from "@/lib/prisma";
import { getLogFeedPostPath } from "@/lib/routes";

function normalizeNotificationType(type: string | null) {
  if (type === "NEW_COMMENT") return "POST_COMMENT";
  if (type === "NEW_LIKE") return "POST_LIKE";
  if (type === "chat_handoff" || type === "chat_handoff_reply")
    return "CHAT_HANDOFF";
  return type ?? "UNKNOWN";
}

function getNotificationActorName(row: {
  actor?: { name: string | null; email: string } | null;
}) {
  return row.actor?.name ?? row.actor?.email ?? null;
}

function getNotificationMessage(row: {
  type: string;
  content: string | null;
  actor?: { name: string | null; email: string } | null;
  post?: {
    title: string;
    category: { name: string } | null;
  } | null;
  comment?: {
    content: string;
  } | null;
}) {
  const actorName = getNotificationActorName(row);
  const normalizedType = normalizeNotificationType(row.type);
  const postCategory = normalizeNoticeCategory(row.post?.category?.name);

  if (normalizedType === "POST_COMMENT" && postCategory === "QnA") {
    return createNewInquiryNotificationMessage({
      actorName,
      postTitle: row.post?.title,
    });
  }

  if (normalizedType === "POST_COMMENT" && row.comment?.content) {
    return createCommentNotificationMessage({
      actorName,
      content: row.comment.content,
      postTitle: row.post?.title,
      isAnswer: postCategory === "버그 제보",
    });
  }

  if (normalizedType === "COMMENT_REPLY" && row.comment?.content) {
    return createCommentNotificationMessage({
      actorName,
      content: row.comment.content,
      postTitle: row.post?.title,
      isReply: true,
    });
  }

  if (normalizedType === "POST_LIKE" && row.post?.title) {
    return createPostBookmarkNotificationMessage({
      actorName,
      postTitle: row.post.title,
    });
  }

  if (normalizedType === "NEW_FOLLOWER") {
    return createFollowerNotificationMessage({ actorName });
  }

  if (normalizedType === "NEW_POST" && row.post?.title) {
    return createNewPostNotificationMessage({
      actorName,
      postTitle: row.post.title,
    });
  }

  if (normalizedType === "POST_REACTION" && row.post?.title && row.content) {
    const emoji = row.content.match(/\s(\S+)\s반응했습니다\.$/)?.[1];

    if (emoji) {
      return createPostReactionNotificationMessage({
        actorName,
        postTitle: row.post.title,
        emoji,
      });
    }
  }

  if (
    normalizedType === "COMMENT_REACTION" &&
    row.comment?.content &&
    row.content
  ) {
    const emoji = row.content.match(/\s(\S+)\s반응했습니다\.$/)?.[1];

    if (emoji) {
      return createCommentReactionNotificationMessage({
        actorName,
        commentContent: row.comment.content,
        emoji,
      });
    }
  }

  return row.content ?? null;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json([], { status: 401 });
    }

    const userId = await getUserIdByEmail(session.user.email);
    if (!userId) {
      return NextResponse.json([], { status: 404 });
    }

    const rows = await prisma.notification.findMany({
      where: { userId: BigInt(userId) },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        actor: {
          select: { name: true, email: true, image: true },
        },
        post: {
          select: {
            id: true,
            title: true,
            isDeleted: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
        comment: {
          select: {
            content: true,
            isDeleted: true,
          },
        },
      },
    });

    return NextResponse.json(
      rows.map((row) => ({
        id: Number(row.id),
        type: normalizeNotificationType(row.type),
        message: getNotificationMessage(row),
        actor_name: row.actor?.name ?? null,
        actor_image: row.actor?.image ?? null,
        actor_id: row.actorId ? Number(row.actorId) : null,
        post_id: row.postId ? Number(row.postId) : null,
        comment_id: row.commentId ? Number(row.commentId) : null,
        chat_thread_id: row.chatThreadId ? Number(row.chatThreadId) : null,
        post_path: row.postId
          ? isNoticeCategoryName(row.post?.category?.name)
            ? `/horok-log/notices/${Number(row.postId)}`
            : getLogFeedPostPath(Number(row.postId))
          : null,
        is_post_deleted: row.post?.isDeleted ?? false,
        is_notice_post: isNoticeCategoryName(row.post?.category?.name),
        is_comment_deleted: row.comment?.isDeleted ?? false,
        is_read: row.isRead ? 1 : 0,
        created_at: row.createdAt.toISOString(),
      })),
    );
  } catch (e) {
    console.error("🔔 NOTIFICATIONS API ERROR", e);
    return NextResponse.json([], { status: 500 });
  }
}
