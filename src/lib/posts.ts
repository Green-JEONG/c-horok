import { Prisma } from "@prisma/client";
import { deleteUnusedCategories, ensureCategoryByName } from "@/lib/categories";
import { INTERNAL_UNCATEGORIZED_CATEGORY_NAME } from "@/lib/category-labels";
import { ALL_NOTICE_TAG_OPTIONS } from "@/lib/notice-categories";
import type { PostAttachmentInput } from "@/lib/post-attachments";
import { syncPostAttachments } from "@/lib/post-attachments.server";
import {
  normalizeCategoryNames,
  syncPostCategories,
} from "@/lib/post-categories";
import {
  ensurePostSecretPasswordColumn,
  hashPostSecretPassword,
} from "@/lib/post-secret-access";
import { canViewSecretPost } from "@/lib/post-secret-password";
import {
  normalizePostStorageMarkdown,
  normalizePostStorageReference,
  signPostStorageMarkdown,
} from "@/lib/post-storage.server";
import type { PostThumbnailCrop } from "@/lib/post-thumbnail-crop";
import {
  ensurePostThumbnailCropColumn,
  setPostThumbnailCrop,
} from "@/lib/post-thumbnail-crop-access";
import { prisma } from "@/lib/prisma";

export type PostRow = {
  id: number;
  user_id: number;
  category_id: number | null;
  title: string;
  content: string;
  is_banner: boolean;
  is_resolved: boolean;
  is_secret: boolean;
  can_view_secret: boolean;
  created_at: string;
  updated_at: string;
  is_hidden: boolean;
  is_deleted: boolean;
};

export type PopularPostRow = {
  id: number;
  title: string;
  viewCount: number;
};

function mapPost(
  post: {
    id: bigint;
    userId: bigint;
    categoryId: bigint | null;
    title: string;
    content: string;
    isBanner: boolean;
    isResolved?: boolean;
    isSecret: boolean;
    createdAt: Date;
    updatedAt: Date;
    isHidden: boolean;
    isDeleted: boolean;
  },
  options?: {
    viewerUserId?: number | null;
    isAdmin?: boolean;
    hasSecretPasswordAccess?: boolean;
    categoryName?: string | null;
  },
) {
  const ownerUserId = Number(post.userId);
  const canViewSecret = canViewSecretPost({
    isSecret: post.isSecret,
    ownerUserId,
    viewerUserId: options?.viewerUserId,
    isAdmin: options?.isAdmin,
    categoryName: options?.categoryName,
    hasSecretPasswordAccess: options?.hasSecretPasswordAccess,
  });

  return {
    id: Number(post.id),
    user_id: ownerUserId,
    category_id: post.categoryId ? Number(post.categoryId) : null,
    title: post.title,
    content: canViewSecret ? post.content : "비밀글입니다.",
    is_banner: post.isBanner,
    is_resolved: post.isResolved ?? false,
    is_secret: post.isSecret,
    can_view_secret: canViewSecret,
    created_at: post.createdAt.toISOString(),
    updated_at: post.updatedAt.toISOString(),
    is_hidden: post.isHidden,
    is_deleted: post.isDeleted,
  };
}

async function signMappedPostMedia(post: ReturnType<typeof mapPost>) {
  if (!post.can_view_secret) {
    return post;
  }

  return {
    ...post,
    content: await signPostStorageMarkdown(post.content),
  };
}

export async function getPostById(
  id: number,
  options?: {
    includeHiddenForUserId?: number | null;
    includeHiddenForAdmin?: boolean;
    hasSecretPasswordAccess?: boolean;
  },
) {
  const post = await prisma.post.findFirst({
    omit: {
      isResolved: true,
    },
    where: {
      id: BigInt(id),
      isDeleted: false,
      OR: [
        { isHidden: false },
        ...(options?.includeHiddenForAdmin ? [{}] : []),
        ...(options?.includeHiddenForUserId
          ? [{ userId: BigInt(options.includeHiddenForUserId) }]
          : []),
      ],
    },
    include: {
      category: {
        select: { name: true },
      },
    },
  });

  return post
    ? signMappedPostMedia(
        mapPost(post, {
          viewerUserId: options?.includeHiddenForUserId ?? null,
          isAdmin: options?.includeHiddenForAdmin,
          hasSecretPasswordAccess: options?.hasSecretPasswordAccess,
          categoryName: post.category?.name ?? null,
        }),
      )
    : null;
}

export async function incrementPostViews(postId: number) {
  await prisma.postView.upsert({
    where: { postId: BigInt(postId) },
    update: {
      viewCount: {
        increment: 1,
      },
    },
    create: {
      postId: BigInt(postId),
      viewCount: 1,
    },
  });
}

export async function getPopularPosts(limit = 5): Promise<PopularPostRow[]> {
  const posts = await prisma.post.findMany({
    omit: {
      isResolved: true,
    },
    where: {
      isDeleted: false,
      isHidden: false,
      isSecret: false,
      category: {
        is: {
          name: {
            notIn: [...ALL_NOTICE_TAG_OPTIONS],
          },
        },
      },
    },
    include: {
      views: {
        select: { viewCount: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return posts
    .map((post) => ({
      id: Number(post.id),
      title: post.title,
      viewCount: Number(post.views?.viewCount ?? 0),
    }))
    .sort((a, b) => b.viewCount - a.viewCount || b.id - a.id)
    .slice(0, limit);
}

export async function createPost(params: {
  userId: number;
  categoryName?: string;
  categoryNames?: string[];
  title: string;
  content: string;
  thumbnailUrl?: string | null;
  thumbnailCrop?: PostThumbnailCrop | null;
  isBanner?: boolean;
  isSecret?: boolean;
  secretPassword?: string | null;
  copiedFromPostId?: number | null;
  attachments?: PostAttachmentInput[];
}) {
  const {
    userId,
    categoryName,
    categoryNames,
    title,
    content,
    thumbnailUrl = null,
    thumbnailCrop = null,
    isBanner = false,
    isSecret = false,
    secretPassword = null,
    copiedFromPostId = null,
    attachments = [],
  } = params;
  const normalizedCategoryNames = normalizeCategoryNames(
    categoryNames ?? (categoryName ? [categoryName] : []),
  );
  const resolvedCategoryNames =
    normalizedCategoryNames.length > 0
      ? normalizedCategoryNames
      : [INTERNAL_UNCATEGORIZED_CATEGORY_NAME];
  const categories = await Promise.all(
    resolvedCategoryNames.map((name) => ensureCategoryByName(name)),
  );
  const [primaryCategory] = categories;

  await ensurePostSecretPasswordColumn();
  await ensurePostThumbnailCropColumn();

  const secretPasswordHash =
    isSecret && secretPassword?.trim()
      ? await hashPostSecretPassword(secretPassword)
      : null;

  const post = await prisma.post.create({
    data: {
      user: {
        connect: { id: BigInt(userId) },
      },
      category: {
        connect: { id: BigInt(primaryCategory.id) },
      },
      title,
      content: normalizePostStorageMarkdown(content),
      thumbnail: normalizePostStorageReference(thumbnailUrl),
      thumbnailCrop:
        thumbnailUrl && thumbnailCrop ? thumbnailCrop : Prisma.DbNull,
      isBanner,
      isSecret,
      secretPasswordHash,
      ...(copiedFromPostId
        ? {
            quotedPost: {
              connect: { id: BigInt(copiedFromPostId) },
            },
          }
        : {}),
    },
  });

  await syncPostCategories(
    post.id,
    categories.map((category) => category.id),
  );

  await syncPostAttachments(
    post.id,
    normalizePostAttachmentInputs(attachments),
  );

  await setPostThumbnailCrop(
    post.id,
    thumbnailUrl && thumbnailCrop ? thumbnailCrop : null,
  );

  return signMappedPostMedia(
    mapPost(post, {
      viewerUserId: userId,
      categoryName: primaryCategory.name,
    }),
  );
}

export async function setPostHidden(params: {
  postId: number;
  isHidden: boolean;
}) {
  const post = await prisma.post.update({
    where: { id: BigInt(params.postId) },
    data: {
      isHidden: params.isHidden,
      hiddenAt: params.isHidden ? new Date() : null,
    },
  });

  return signMappedPostMedia(mapPost(post));
}

export async function updatePost(params: {
  postId: number;
  categoryName?: string;
  categoryNames?: string[];
  title: string;
  content: string;
  thumbnailUrl?: string | null;
  thumbnailCrop?: PostThumbnailCrop | null;
  isBanner?: boolean;
  isSecret?: boolean;
  secretPassword?: string | null;
  isHidden?: boolean;
  attachments?: PostAttachmentInput[];
}) {
  const {
    postId,
    categoryName,
    categoryNames,
    title,
    content,
    thumbnailUrl,
    thumbnailCrop,
    isBanner,
    isSecret,
    secretPassword,
    isHidden,
    attachments,
  } = params;
  const normalizedCategoryNames =
    categoryNames !== undefined
      ? normalizeCategoryNames(categoryNames)
      : categoryName === undefined
        ? undefined
        : normalizeCategoryNames([categoryName]);
  const category =
    normalizedCategoryNames === undefined
      ? null
      : await ensureCategoryByName(
          normalizedCategoryNames[0] || INTERNAL_UNCATEGORIZED_CATEGORY_NAME,
        );
  const categories =
    normalizedCategoryNames === undefined
      ? null
      : await Promise.all(
          (normalizedCategoryNames.length > 0
            ? normalizedCategoryNames
            : [INTERNAL_UNCATEGORIZED_CATEGORY_NAME]
          ).map((name) => ensureCategoryByName(name)),
        );

  await ensurePostSecretPasswordColumn();
  await ensurePostThumbnailCropColumn();

  const secretPasswordHash =
    isSecret === false
      ? null
      : secretPassword?.trim()
        ? await hashPostSecretPassword(secretPassword)
        : undefined;

  const nextThumbnailCrop =
    thumbnailUrl === null
      ? null
      : thumbnailCrop !== undefined
        ? thumbnailCrop
        : undefined;

  const post = await prisma.post.update({
    where: { id: BigInt(postId) },
    data: {
      title,
      content: normalizePostStorageMarkdown(content),
      ...(isBanner !== undefined ? { isBanner } : {}),
      ...(isSecret !== undefined ? { isSecret } : {}),
      ...(secretPasswordHash !== undefined ? { secretPasswordHash } : {}),
      ...(isHidden !== undefined
        ? { isHidden, hiddenAt: isHidden ? new Date() : null }
        : {}),
      ...(category
        ? {
            category: {
              connect: { id: BigInt(category.id) },
            },
          }
        : {}),
      ...(thumbnailUrl !== undefined
        ? { thumbnail: normalizePostStorageReference(thumbnailUrl) }
        : {}),
      ...(nextThumbnailCrop !== undefined
        ? {
            thumbnailCrop:
              nextThumbnailCrop === null ? Prisma.DbNull : nextThumbnailCrop,
          }
        : {}),
    },
  });

  if (categories) {
    await syncPostCategories(
      post.id,
      categories.map((category) => category.id),
    );
  }

  if (attachments !== undefined) {
    await syncPostAttachments(
      post.id,
      normalizePostAttachmentInputs(attachments),
    );
  }

  if (nextThumbnailCrop !== undefined) {
    await setPostThumbnailCrop(
      post.id,
      thumbnailUrl === null || !nextThumbnailCrop ? null : nextThumbnailCrop,
    );
  } else if (thumbnailUrl === null) {
    await setPostThumbnailCrop(post.id, null);
  }

  return signMappedPostMedia(mapPost(post));
}

function normalizePostAttachmentInputs(attachments: PostAttachmentInput[]) {
  return attachments.map((attachment) => ({
    ...attachment,
    fileUrl: normalizePostStorageReference(attachment.fileUrl) ?? "",
  }));
}

export async function deletePost(postId: number) {
  const post = await prisma.post.update({
    where: { id: BigInt(postId) },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
    select: {
      categoryId: true,
    },
  });

  const activeCount = await prisma.post.count({
    where: {
      categoryId: post.categoryId,
      isDeleted: false,
      isHidden: false,
    },
  });

  if (activeCount === 0) {
    await deleteUnusedCategories();
  }
}
