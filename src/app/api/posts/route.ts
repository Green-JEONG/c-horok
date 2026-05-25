import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { findPostsPaged, getUserIdByEmail } from "@/lib/db";
import {
  isNoticeCategoryName,
  isPublicNoticeCategory,
} from "@/lib/notice-categories";
import {
  createNewInquiryNotificationMessage,
  createNewPostNotificationMessage,
} from "@/lib/notification-messages";
import { parseSortType } from "@/lib/post-sort";
import { createPost } from "@/lib/posts";
import { prisma } from "@/lib/prisma";

function getCategoryNames(body: {
  categoryName?: unknown;
  categoryNames?: unknown;
}) {
  if (Array.isArray(body.categoryNames)) {
    return body.categoryNames
      .filter(
        (categoryName): categoryName is string =>
          typeof categoryName === "string",
      )
      .map((categoryName) => categoryName.trim())
      .filter(Boolean);
  }

  return typeof body.categoryName === "string" && body.categoryName.trim()
    ? [body.categoryName.trim()]
    : [];
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = Number(url.searchParams.get("page") ?? "1");
  const sort = parseSortType(url.searchParams.get("sort"));
  const requestedLimit = Number(url.searchParams.get("limit") ?? "12");
  const requestedOffset = Number(url.searchParams.get("offset") ?? "");
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 15)
      : 12;
  const offset =
    Number.isFinite(requestedOffset) && requestedOffset >= 0
      ? requestedOffset
      : Math.max(page - 1, 0) * limit;
  const session = await auth();
  const viewerUserId =
    typeof session?.user?.id === "string" ? Number(session.user.id) : null;

  const posts = await findPostsPaged(limit, offset, sort, {
    viewerUserId:
      typeof viewerUserId === "number" && !Number.isNaN(viewerUserId)
        ? viewerUserId
        : null,
    isAdmin: session?.user?.role === "ADMIN",
  });

  return NextResponse.json(posts);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // DB용 userId 조회 (핵심)
  const userId = await getUserIdByEmail(session.user.email);
  if (!userId) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const { title, content, thumbnailUrl, isBanner, isSecret } = body;
  const categoryNames = getCategoryNames(body);
  const normalizedCategoryName = categoryNames[0] ?? "";

  if (!title || !content) {
    return NextResponse.json({ message: "Invalid input" }, { status: 400 });
  }

  if (
    categoryNames.some((name) => isNoticeCategoryName(name)) &&
    session.user.role !== "ADMIN" &&
    categoryNames.some((name) => !isPublicNoticeCategory(name))
  ) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const post = await createPost({
    userId,
    categoryName: normalizedCategoryName || undefined,
    categoryNames,
    title,
    content,
    isBanner: Boolean(isBanner) && isNoticeCategoryName(normalizedCategoryName),
    isSecret: Boolean(isSecret),
    thumbnailUrl:
      typeof thumbnailUrl === "string" && thumbnailUrl.trim()
        ? thumbnailUrl.trim()
        : null,
  });

  if (normalizedCategoryName === "QnA" && session.user.role !== "ADMIN") {
    try {
      const adminUsers = await prisma.user.findMany({
        where: {
          role: "ADMIN",
        },
        select: {
          id: true,
        },
      });

      if (adminUsers.length > 0) {
        await prisma.notification.createMany({
          data: adminUsers.map((adminUser) => ({
            userId: adminUser.id,
            actorId: BigInt(userId),
            postId: BigInt(post.id),
            type: "NEW_COMMENT",
            content: createNewInquiryNotificationMessage({
              actorName: session.user.name ?? session.user.email,
              postTitle: title,
            }),
          })),
        });
      }
    } catch (error) {
      console.error("🔔 문의 질문 알림 생성 실패", error);
    }
  }

  if (normalizedCategoryName === "공지") {
    try {
      const recipients = await prisma.user.findMany({
        where: {
          id: {
            not: BigInt(userId),
          },
        },
        select: {
          id: true,
        },
      });

      if (recipients.length > 0) {
        await prisma.notification.createMany({
          data: recipients.map((recipient) => ({
            userId: recipient.id,
            actorId: BigInt(userId),
            postId: BigInt(post.id),
            type: "NEW_POST",
            content: "새 공지사항이 등록되었어요",
          })),
        });
      }
    } catch (error) {
      console.error("🔔 공지사항 알림 생성 실패", error);
    }
  }

  if (normalizedCategoryName !== "FAQ" && normalizedCategoryName !== "QnA") {
    try {
      const followers = await prisma.friend.findMany({
        where: {
          friendUserId: BigInt(userId),
        },
        select: {
          userId: true,
        },
      });

      if (followers.length > 0) {
        await prisma.notification.createMany({
          data: followers.map((follower) => ({
            userId: follower.userId,
            actorId: BigInt(userId),
            postId: BigInt(post.id),
            type: "NEW_POST",
            content: createNewPostNotificationMessage({
              actorName: session.user.name ?? session.user.email,
              postTitle: title,
            }),
          })),
        });
      }
    } catch (error) {
      console.error("🔔 구독 유저 새 글 알림 생성 실패", error);
    }
  }

  return NextResponse.json(post, { status: 201 });
}
