import { Prisma } from "@prisma/client";
import { buildVisibleCommentCountWhere } from "@/lib/comment-counts";
import { mapPostAttachments } from "@/lib/post-attachments";
import { parsePostThumbnailCrop, resolvePostThumbnailCrop } from "@/lib/post-thumbnail-crop";
import type { PostThumbnailCrop } from "@/lib/post-thumbnail-crop";
import { getPostThumbnailCropsByPostIds } from "@/lib/post-thumbnail-crop-access";
import { ALL_NOTICE_TAG_OPTIONS } from "@/lib/notice-categories";
import { getPostCategoryNameMap } from "@/lib/post-categories";
import { canViewSecretPost } from "@/lib/post-secret-password";
import { getPostReactionCountsByPostId } from "@/lib/post-reactions";
import { DEFAULT_SORT, type SortType } from "@/lib/post-sort";
import { prisma } from "@/lib/prisma";

export type DbUser = {
  id: string;
  email: string;
  password: string | null;
  name: string | null;
  image: string | null;
  oauth_image: string | null;
  role: "USER" | "ADMIN";
  provider: "credentials" | "github" | "google";
  sns_id: string | null;
};

export type DbPost = {
  id: number;
  title: string;
  content: string;
  thumbnail: string | null;
  thumbnail_crop?: PostThumbnailCrop | null;
  created_at: Date;
  updated_at: Date;
  author_name: string;
  author_image: string | null;
  category_name: string;
  category_names?: string[];
  view_count: number;
  likes_count: number;
  reactions_count: number;
  comments_count: number;
  download_count?: number;
  markdown_download_count?: number;
  pdf_download_count?: number;
  is_banner: boolean;
  is_resolved: boolean;
  is_hidden: boolean;
  is_secret: boolean;
  can_view_secret: boolean;
  user_id?: number;
  copied_from_post?: DbCopiedPost | null;
  attachments?: DbPostAttachment[];
};

export type DbCopiedPost = {
  id: number;
  title: string;
  content: string;
  thumbnail: string | null;
  author_name: string;
  author_image: string | null;
  created_at: Date;
};

export type DbPostAttachment = {
  id: number;
  file_name: string;
  file_url: string;
  file_size: number | null;
};

export type DbPostSeriesItem = {
  id: number;
  title: string;
  created_at: Date;
  author_name: string;
  view_count: number;
  comments_count: number;
  is_hidden: boolean;
  is_secret: boolean;
};

export type DbContribution = {
  date: string;
  count: number;
};

function bigintToNumber(value: bigint | number) {
  return typeof value === "bigint" ? Number(value) : value;
}

function parseBigIntId(value?: string) {
  if (!value || !/^\d+$/.test(value)) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function mapUser(user: {
  id: bigint;
  email: string;
  password: string | null;
  name: string | null;
  image: string | null;
  oauthImage: string | null;
  role: "USER" | "ADMIN";
  provider: "credentials" | "github" | "google";
  snsId: string | null;
}): DbUser {
  return {
    id: user.id.toString(),
    email: user.email,
    password: user.password,
    name: user.name,
    image: user.image,
    oauth_image: user.oauthImage,
    role: user.role,
    provider: user.provider,
    sns_id: user.snsId,
  };
}

function mapPost(
  post: {
    id: bigint;
    title: string;
    content: string;
    thumbnail: string | null;
    thumbnailCrop?: unknown;
    createdAt: Date;
    updatedAt: Date;
    isBanner: boolean;
    isResolved?: boolean;
    isHidden: boolean;
    isSecret: boolean;
    userId?: bigint;
    user: { name: string | null; image?: string | null };
    category: { name: string } | null;
    categoryNames?: string[];
    views?: { viewCount: bigint | number } | null;
    downloadCounts?: {
      markdownCount: number;
      pdfCount: number;
    } | null;
    _count?: { likes?: number; comments?: number };
    quotedPost?: {
      id: bigint;
      title: string;
      content: string;
      thumbnail: string | null;
      createdAt: Date;
      user: { name: string | null; image?: string | null };
      downloadCounts?: {
        markdownCount: number;
        pdfCount: number;
      } | null;
    } | null;
    attachments?: Array<{
      id: bigint;
      fileName: string;
      fileUrl: string;
      fileSize: number | null;
    }>;
  },
  options?: {
    viewerUserId?: number | null;
    isAdmin?: boolean;
    hasSecretPasswordAccess?: boolean;
  },
): DbPost {
  const ownerUserId = post.userId ? bigintToNumber(post.userId) : undefined;
  const categoryName = post.category?.name ?? post.categoryNames?.[0] ?? null;
  const canViewSecret = canViewSecretPost({
    isSecret: post.isSecret,
    ownerUserId: ownerUserId ?? -1,
    viewerUserId: options?.viewerUserId,
    isAdmin: options?.isAdmin,
    categoryName,
    hasSecretPasswordAccess: options?.hasSecretPasswordAccess,
  });
  const categoryNames =
    post.categoryNames && post.categoryNames.length > 0
      ? post.categoryNames
      : post.category?.name
        ? [post.category.name]
        : [];

  return {
    id: bigintToNumber(post.id),
    title: post.title,
    content: canViewSecret ? post.content : "비밀글입니다.",
    thumbnail: canViewSecret ? post.thumbnail : null,
    thumbnail_crop: canViewSecret ? parsePostThumbnailCrop(post.thumbnailCrop) : null,
    created_at: post.createdAt,
    updated_at: post.updatedAt,
    author_name: post.user.name ?? "Unknown",
    author_image: post.user.image ?? null,
    category_name: categoryNames[0] ?? "",
    category_names: categoryNames,
    view_count: Number(post.views?.viewCount ?? 0),
    likes_count: post._count?.likes ?? 0,
    reactions_count: 0,
    comments_count: post._count?.comments ?? 0,
    download_count:
      (post.downloadCounts?.markdownCount ?? 0) +
      (post.downloadCounts?.pdfCount ?? 0),
    markdown_download_count: post.downloadCounts?.markdownCount ?? 0,
    pdf_download_count: post.downloadCounts?.pdfCount ?? 0,
    is_banner: post.isBanner,
    is_resolved: post.isResolved ?? false,
    is_hidden: post.isHidden,
    is_secret: post.isSecret,
    can_view_secret: canViewSecret,
    user_id: ownerUserId,
    copied_from_post: post.quotedPost
      ? {
          id: bigintToNumber(post.quotedPost.id),
          title: post.quotedPost.title,
          content: post.quotedPost.content,
          thumbnail: post.quotedPost.thumbnail,
          author_name: post.quotedPost.user.name ?? "Unknown",
          author_image: post.quotedPost.user.image ?? null,
          created_at: post.quotedPost.createdAt,
        }
      : null,
    attachments: canViewSecret
      ? mapPostAttachments(post.attachments ?? [])
      : [],
  };
}

async function mapPostsWithReactionCounts(
  posts: Array<Parameters<typeof mapPost>[0]>,
  options?: Parameters<typeof mapPost>[1],
) {
  const postIds = posts.map((post) => post.id);
  const downloadCountIds = [
    ...postIds,
    ...posts
      .map((post) => post.quotedPost?.id)
      .filter((postId): postId is bigint => Boolean(postId)),
  ];
  const categoryNameMap = await getPostCategoryNameMap(postIds);
  const [reactionCounts, downloadCountMap, thumbnailCropMap] = await Promise.all([
    getPostReactionCountsByPostId(postIds),
    getPostDownloadCountMap(downloadCountIds),
    getPostThumbnailCropsByPostIds(postIds),
  ]);

  return posts.map((post) => {
    const mappedPost = mapPost(
      {
        ...post,
        thumbnailCrop: resolvePostThumbnailCrop(
          thumbnailCropMap.get(post.id.toString()),
          post.thumbnailCrop,
        ),
        categoryNames: categoryNameMap.get(post.id.toString()),
        downloadCounts: downloadCountMap.get(post.id.toString()),
        quotedPost: post.quotedPost
          ? {
              ...post.quotedPost,
              downloadCounts: downloadCountMap.get(
                post.quotedPost.id.toString(),
              ),
            }
          : null,
      },
      options,
    );

    return {
      ...mappedPost,
      reactions_count: reactionCounts.get(mappedPost.id) ?? 0,
    };
  });
}

async function getPostDownloadCountMap(postIds: bigint[]) {
  const uniquePostIds = Array.from(new Set(postIds.map((postId) => postId)));

  if (uniquePostIds.length === 0) {
    return new Map<string, { markdownCount: number; pdfCount: number }>();
  }

  const rows = await prisma.$queryRaw<
    Array<{
      postId: bigint;
      markdownCount: number;
      pdfCount: number;
    }>
  >`
    SELECT
      post_id AS "postId",
      markdown_count AS "markdownCount",
      pdf_count AS "pdfCount"
    FROM horok_log.post_download_counts
    WHERE post_id IN (${Prisma.join(uniquePostIds)})
  `;

  return new Map(
    rows.map((row) => [
      row.postId.toString(),
      {
        markdownCount: Number(row.markdownCount),
        pdfCount: Number(row.pdfCount),
      },
    ]),
  );
}

function getFeedPostWhere(): Prisma.PostWhereInput {
  return {
    isDeleted: false,
    isHidden: false,
    category: {
      is: {
        name: {
          notIn: [...ALL_NOTICE_TAG_OPTIONS],
        },
      },
    },
  };
}

function getFeedPostOrderBy(
  sort: SortType,
): Prisma.PostOrderByWithRelationInput[] {
  const fallbackOrder: Prisma.PostOrderByWithRelationInput[] = [
    { createdAt: "desc" },
    { id: "desc" },
  ];

  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "likes":
      return [{ likes: { _count: "desc" } }, ...fallbackOrder];
    case "comments":
      return [{ comments: { _count: "desc" } }, ...fallbackOrder];
    case "views":
      return [{ views: { viewCount: "desc" } }, ...fallbackOrder];
    case "category":
      return [{ category: { name: "asc" } }, ...fallbackOrder];
    case "categoryDesc":
      return [{ category: { name: "desc" } }, ...fallbackOrder];
    default:
      return fallbackOrder;
  }
}

export async function findUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  return user ? mapUser(user) : null;
}

export async function findUserByEmailOrNickname(identifier: string) {
  // Try email exact match first
  let user = await prisma.user.findUnique({
    where: { email: identifier },
  });

  // If not found, try name (nickname) case-insensitive match
  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        name: { equals: identifier, mode: "insensitive" },
      },
    });
  }

  return user ? mapUser(user) : null;
}

export async function findUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });

  return user ? mapUser(user) : null;
}

export async function findUserByName(name: string, excludeUserId?: string) {
  const excludeId = parseBigIntId(excludeUserId);

  const user = await prisma.user.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId
        ? {
            NOT: {
              id: excludeId,
            },
          }
        : {}),
    },
  });

  return user ? mapUser(user) : null;
}

export async function findUserByEmailAndName(email: string, name: string) {
  const user = await prisma.user.findFirst({
    where: {
      email,
      name: { equals: name, mode: "insensitive" },
    },
  });

  return user ? mapUser(user) : null;
}

export async function getUserIdByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  return user ? bigintToNumber(user.id) : null;
}

export async function createUser(params: {
  email: string;
  passwordHash: string;
  name?: string | null;
  image?: string | null;
  oauthImage?: string | null;
  role?: "USER" | "ADMIN";
}) {
  const {
    email,
    passwordHash,
    name = null,
    image = null,
    oauthImage = null,
    role = "USER",
  } = params;

  const user = await prisma.user.create({
    data: {
      email,
      password: passwordHash,
      name,
      image,
      oauthImage,
      role,
      provider: "credentials",
    },
  });

  return mapUser(user);
}

export async function updateUserPasswordById(
  userId: string,
  passwordHash: string,
) {
  const user = await prisma.user.update({
    where: { id: BigInt(userId) },
    data: { password: passwordHash },
  });

  return mapUser(user);
}

export async function deleteUserById(userId: string) {
  await prisma.user.delete({
    where: { id: BigInt(userId) },
  });
}

export async function upsertOAuthUser(params: {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: "github" | "google";
  providerId: string;
}) {
  const { email, name = null, image = null, provider, providerId } = params;
  const role = email === "th2gr22n@gmail.com" ? "ADMIN" : "USER";

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: name ?? undefined,
      oauthImage: image ?? undefined,
      provider,
      snsId: providerId,
    },
    create: {
      email,
      name,
      image,
      oauthImage: image,
      role,
      provider,
      snsId: providerId,
    },
  });

  return mapUser(user);
}

export async function findPostsPaged(
  limit: number,
  offset: number,
  sort: SortType = DEFAULT_SORT,
  options?: {
    viewerUserId?: number | null;
    isAdmin?: boolean;
  },
): Promise<DbPost[]> {
  const posts = await prisma.post.findMany({
    omit: {
      isResolved: true,
    },
    where: getFeedPostWhere(),
    include: {
      user: { select: { name: true, image: true } },
      category: { select: { name: true } },
      quotedPost: {
        select: {
          id: true,
          title: true,
          content: true,
          thumbnail: true,
          createdAt: true,
          user: { select: { name: true, image: true } },
        },
      },
      views: { select: { viewCount: true } },
      _count: {
        select: {
          likes: true,
          comments: {
            where: buildVisibleCommentCountWhere(options?.viewerUserId),
          },
        },
      },
    },
    orderBy: getFeedPostOrderBy(sort),
    skip: offset,
    take: limit,
  });

  return mapPostsWithReactionCounts(posts, options);
}

export async function countFeedPosts() {
  return prisma.post.count({
    where: getFeedPostWhere(),
  });
}

export async function findPostById(
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
      user: { select: { name: true, image: true } },
      category: { select: { name: true } },
      quotedPost: {
        select: {
          id: true,
          title: true,
          content: true,
          thumbnail: true,
          createdAt: true,
          user: { select: { name: true, image: true } },
        },
      },
      views: { select: { viewCount: true } },
      attachments: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          fileSize: true,
        },
      },
      _count: {
        select: {
          likes: true,
          comments: {
            where: buildVisibleCommentCountWhere(
              options?.includeHiddenForUserId,
            ),
          },
        },
      },
    },
  });

  if (!post) {
    return null;
  }

  const categoryNameMap = await getPostCategoryNameMap([post.id]);
  const downloadCountMap = await getPostDownloadCountMap(
    [post.id, post.quotedPost?.id].filter((postId): postId is bigint =>
      Boolean(postId),
    ),
  );
  const thumbnailCropMap = await getPostThumbnailCropsByPostIds([post.id]);

  return mapPost(
    {
      ...post,
      thumbnailCrop: resolvePostThumbnailCrop(
        thumbnailCropMap.get(post.id.toString()),
        post.thumbnailCrop,
      ),
      categoryNames: categoryNameMap.get(post.id.toString()),
      downloadCounts: downloadCountMap.get(post.id.toString()),
      quotedPost: post.quotedPost
        ? {
            ...post.quotedPost,
            downloadCounts: downloadCountMap.get(post.quotedPost.id.toString()),
          }
        : null,
    },
    {
      viewerUserId: options?.includeHiddenForUserId ?? null,
      isAdmin: options?.includeHiddenForAdmin,
      hasSecretPasswordAccess: options?.hasSecretPasswordAccess,
    },
  );
}

export function extractPostSeriesName(title: string) {
  const [, seriesName = ""] = title.match(/\[([^\]\n]{1,80})\]/) ?? [];
  const normalizedSeriesName = seriesName.trim();

  return normalizedSeriesName.length > 0 ? normalizedSeriesName : null;
}

export async function findPostSeriesByTitle(
  title: string,
  options?: {
    authorUserId?: number | null;
    includeHiddenForUserId?: number | null;
    includeHiddenForAdmin?: boolean;
  },
): Promise<DbPostSeriesItem[]> {
  const seriesName = extractPostSeriesName(title);

  if (!seriesName) {
    return [];
  }

  const posts = await prisma.post.findMany({
    where: {
      isDeleted: false,
      ...(options?.authorUserId
        ? { userId: BigInt(options.authorUserId) }
        : {}),
      title: {
        contains: `[${seriesName}]`,
      },
      category: {
        is: {
          name: {
            notIn: [...ALL_NOTICE_TAG_OPTIONS],
          },
        },
      },
      OR: [
        { isHidden: false },
        ...(options?.includeHiddenForAdmin ? [{}] : []),
        ...(options?.includeHiddenForUserId
          ? [{ userId: BigInt(options.includeHiddenForUserId) }]
          : []),
      ],
    },
    include: {
      user: { select: { name: true } },
      views: { select: { viewCount: true } },
      _count: {
        select: {
          comments: {
            where: buildVisibleCommentCountWhere(
              options?.includeHiddenForUserId,
            ),
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return posts.map((post) => ({
    id: bigintToNumber(post.id),
    title: post.title,
    created_at: post.createdAt,
    author_name: post.user.name ?? "Unknown",
    view_count: Number(post.views?.viewCount ?? 0),
    comments_count: post._count.comments,
    is_hidden: post.isHidden,
    is_secret: post.isSecret,
  }));
}

export async function findPostAccessMetaById(id: number) {
  const post = await prisma.post.findUnique({
    where: { id: BigInt(id) },
    select: {
      isDeleted: true,
      isSecret: true,
      secretPasswordHash: true,
    },
  });

  return {
    exists: Boolean(post),
    isDeleted: post?.isDeleted ?? false,
    isSecret: post?.isSecret ?? false,
    hasSecretPassword: Boolean(post?.secretPasswordHash),
  };
}

async function searchPostsInternal(
  keyword: string,
  limit: number,
  offset: number,
) {
  const where: Prisma.PostWhereInput = {
    isDeleted: false,
    isHidden: false,
    category: {
      is: {
        name: {
          notIn: [...ALL_NOTICE_TAG_OPTIONS],
        },
      },
    },
    OR: [
      { title: { contains: keyword, mode: "insensitive" } },
      { content: { contains: keyword, mode: "insensitive" } },
    ],
  };

  const posts = await prisma.post.findMany({
    omit: {
      isResolved: true,
    },
    where,
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
    include: {
      user: { select: { name: true } },
      category: { select: { name: true } },
      _count: {
        select: {
          likes: true,
          comments: {
            where: buildVisibleCommentCountWhere(),
          },
        },
      },
    },
  });

  return mapPostsWithReactionCounts(posts);
}

export async function findPostsByKeywordPaged(
  keyword: string,
  limit: number,
  offset: number,
) {
  return searchPostsInternal(keyword, limit, offset);
}

export async function findUserContributions(userId: number) {
  const userBigIntId = BigInt(userId);
  const [posts, solvedProblems] = await Promise.all([
    prisma.post.findMany({
      where: {
        userId: userBigIntId,
        isDeleted: false,
        category: {
          is: {
            name: {
              notIn: [...ALL_NOTICE_TAG_OPTIONS],
            },
          },
        },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.codingProblemProgress.findMany({
      where: {
        userId: userBigIntId,
        status: "solved",
        solvedAt: {
          not: null,
        },
      },
      select: { solvedAt: true },
      orderBy: { solvedAt: "asc" },
    }),
  ]);

  const counts = new Map<string, number>();

  for (const post of posts) {
    const date = formatLocalDate(post.createdAt);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  for (const solvedProblem of solvedProblems) {
    if (!solvedProblem.solvedAt) {
      continue;
    }

    const date = formatLocalDate(solvedProblem.solvedAt);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function searchPosts(
  keyword: string,
  limit: number,
  offset: number,
) {
  return searchPostsInternal(keyword, limit, offset);
}
