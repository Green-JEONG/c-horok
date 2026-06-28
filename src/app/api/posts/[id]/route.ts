import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDbUserIdFromSession } from "@/lib/auth-db";
import {
  isNoticeCategoryName,
  isPublicNoticeCategory,
} from "@/lib/notice-categories";
import type { PostAttachmentInput } from "@/lib/post-attachments";
import { getPostByIdWithSecretAccess } from "@/lib/post-detail-access";
import { validatePostSecretPassword } from "@/lib/post-secret-access";
import { parseThumbnailCropFromRequestBody } from "@/lib/post-thumbnail-crop";
import {
  deletePost,
  getPostById,
  setPostHidden,
  updatePost,
} from "@/lib/posts";
import { prisma } from "@/lib/prisma";

function getAttachments(body: {
  attachments?: unknown;
}): PostAttachmentInput[] {
  if (!Array.isArray(body.attachments)) {
    return [];
  }

  return body.attachments
    .filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object",
    )
    .map((item) => ({
      fileName: typeof item.fileName === "string" ? item.fileName.trim() : "",
      fileUrl: typeof item.fileUrl === "string" ? item.fileUrl.trim() : "",
      fileSize:
        typeof item.fileSize === "number" && Number.isFinite(item.fileSize)
          ? item.fileSize
          : null,
    }))
    .filter((item) => item.fileName && item.fileUrl);
}

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

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    return NextResponse.json({ message: "Invalid post id" }, { status: 400 });
  }

  const dbUserId = await getDbUserIdFromSession();
  const session = await auth();
  const post = await getPostByIdWithSecretAccess(postId, {
    includeHiddenForUserId: dbUserId,
    includeHiddenForAdmin: session?.user?.role === "ADMIN",
  });
  if (!post) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(post);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    return NextResponse.json({ message: "Invalid post id" }, { status: 400 });
  }

  const dbUserId = await getDbUserIdFromSession();
  if (!dbUserId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const session = await auth();

  const post = await getPostById(postId, {
    includeHiddenForUserId: dbUserId,
    includeHiddenForAdmin: session?.user?.role === "ADMIN",
  });
  if (!post) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const postCategory = await prisma.post.findUnique({
    where: { id: BigInt(postId) },
    select: { category: { select: { name: true } } },
  });
  const postCategoryName = postCategory?.category?.name;
  const isNotice = isNoticeCategoryName(postCategoryName);
  const isQnaNotice = postCategoryName === "QnA";
  const isOwner = isNotice
    ? isQnaNotice
      ? post.user_id === dbUserId
      : session?.user?.role === "ADMIN" ||
        (isPublicNoticeCategory(postCategoryName) && post.user_id === dbUserId)
    : post.user_id === dbUserId;

  if (!isOwner) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    title,
    content,
    categoryName,
    thumbnailUrl,
    isBanner,
    isSecret,
    isHidden,
    secretPassword,
  } = body;
  const thumbnailCrop = parseThumbnailCropFromRequestBody(body);
  const categoryNames = getCategoryNames(body);
  const attachments = getAttachments(body);
  const normalizedCategoryName =
    categoryNames[0] ??
    (typeof categoryName === "string" ? categoryName.trim() : "");

  if (!title || !content) {
    return NextResponse.json({ message: "Invalid input" }, { status: 400 });
  }

  const nextIsSecret =
    typeof isSecret === "boolean" ? isSecret : post.is_secret;
  const secretPasswordValue =
    typeof secretPassword === "string" ? secretPassword.trim() : "";

  if (nextIsSecret && secretPasswordValue) {
    const validationMessage = validatePostSecretPassword(secretPasswordValue);

    if (validationMessage) {
      return NextResponse.json({ message: validationMessage }, { status: 400 });
    }
  }

  if (
    categoryNames.some((name) => isNoticeCategoryName(name)) &&
    session?.user?.role !== "ADMIN" &&
    categoryNames.some((name) => !isPublicNoticeCategory(name))
  ) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const updated = await updatePost({
    postId,
    title,
    content,
    categoryName: normalizedCategoryName,
    categoryNames,
    isBanner:
      typeof isBanner === "boolean" &&
      isNoticeCategoryName(normalizedCategoryName)
        ? isBanner
        : false,
    isSecret: typeof isSecret === "boolean" ? isSecret : undefined,
    secretPassword: secretPasswordValue || null,
    isHidden: typeof isHidden === "boolean" ? isHidden : undefined,
    thumbnailUrl:
      typeof thumbnailUrl === "string"
        ? thumbnailUrl.trim() || null
        : thumbnailUrl === null
          ? null
          : undefined,
    thumbnailCrop,
    attachments,
  });

  return NextResponse.json(updated);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    return NextResponse.json({ message: "Invalid post id" }, { status: 400 });
  }

  const dbUserId = await getDbUserIdFromSession();
  if (!dbUserId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const session = await auth();

  const post = await getPostById(postId, {
    includeHiddenForUserId: dbUserId,
    includeHiddenForAdmin: session?.user?.role === "ADMIN",
  });
  if (!post) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const postCategory = await prisma.post.findUnique({
    where: { id: BigInt(postId) },
    select: { category: { select: { name: true } } },
  });
  const categoryName = postCategory?.category?.name;
  const isNotice = isNoticeCategoryName(categoryName);
  const isQnaNotice = categoryName === "QnA";
  const canManage = isNotice
    ? isQnaNotice
      ? post.user_id === dbUserId || session?.user?.role === "ADMIN"
      : session?.user?.role === "ADMIN" ||
        (isPublicNoticeCategory(categoryName) && post.user_id === dbUserId)
    : post.user_id === dbUserId;

  if (!canManage) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { inquiryStatus, isHidden } = body;

  if (inquiryStatus === "checking" || inquiryStatus === "resolved") {
    const normalizedCategory =
      categoryName === "QnA" || categoryName === "버그 제보"
        ? categoryName
        : null;

    if (!normalizedCategory || session?.user?.role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.post.update({
      where: { id: BigInt(postId) },
      data: { isResolved: inquiryStatus === "resolved" },
      select: { isResolved: true },
    });

    return NextResponse.json({
      inquiryStatus: updated.isResolved ? "resolved" : "checking",
    });
  }

  if (typeof isHidden !== "boolean") {
    return NextResponse.json({ message: "Invalid input" }, { status: 400 });
  }

  const updated = await setPostHidden({ postId, isHidden });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    return NextResponse.json({ message: "Invalid post id" }, { status: 400 });
  }

  const dbUserId = await getDbUserIdFromSession();
  if (!dbUserId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const session = await auth();

  const post = await getPostById(postId, {
    includeHiddenForUserId: dbUserId,
    includeHiddenForAdmin: session?.user?.role === "ADMIN",
  });
  if (!post) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const postCategory = await prisma.post.findUnique({
    where: { id: BigInt(postId) },
    select: { category: { select: { name: true } } },
  });
  const categoryName = postCategory?.category?.name;
  const isNotice = isNoticeCategoryName(categoryName);
  const isQnaNotice = categoryName === "QnA";
  const isOwner = isNotice
    ? isQnaNotice
      ? post.user_id === dbUserId
      : session?.user?.role === "ADMIN" ||
        (isPublicNoticeCategory(categoryName) && post.user_id === dbUserId)
    : post.user_id === dbUserId;

  if (!isOwner) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await deletePost(postId);

  return NextResponse.json({ ok: true });
}
