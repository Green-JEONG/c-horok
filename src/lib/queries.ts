import type { Prisma } from "@prisma/client";
import { buildVisibleCommentCountWhere } from "@/lib/comment-counts";
import {
  ALL_NOTICE_TAG_OPTIONS,
  getNoticeCategoryQueryNames,
  isNoticeCategoryName,
  normalizeNoticeCategory,
} from "@/lib/notice-categories";
import {
  getAdminReactedPostIdSet,
  getPostReactionCountsByPostId,
} from "@/lib/post-reactions";
import {
  type PostSearchTarget,
  parsePostSearchTarget,
} from "@/lib/post-search-target";
import {
  comparePostMetrics,
  DEFAULT_SORT,
  type SortType,
} from "@/lib/post-sort";
import { prisma } from "@/lib/prisma";
import { normalizeSearchText, tokenizeSearchQuery } from "@/lib/search";
import { parsePostThumbnailCrop, resolvePostThumbnailCrop } from "@/lib/post-thumbnail-crop";
import type { PostThumbnailCrop } from "@/lib/post-thumbnail-crop";
import { getPostThumbnailCropsByPostIds } from "@/lib/post-thumbnail-crop-access";
import {
  parseUserSearchSort,
  type UserSearchSort,
} from "@/lib/user-search-sort";

export type DbPost = {
  id: number;
  title: string;
  content: string;
  thumbnail: string | null;
  thumbnail_crop?: PostThumbnailCrop | null;
  created_at: Date;
  author_name: string;
  author_image: string | null;
  category_name: string;
  view_count: number;
  likes_count: number;
  reactions_count: number;
  comments_count: number;
  is_resolved: boolean;
  has_admin_answer?: boolean;
  is_hidden: boolean;
  is_secret: boolean;
  can_view_secret: boolean;
};

export type DbUserSearchResult = {
  id: number;
  name: string | null;
  image: string | null;
  followerCount: number;
  postCount: number;
};

export type SearchPostGroup = "posts" | "notice" | "faq" | "qna";

function buildVisibleUserPostCountWhere(
  userId: number,
  viewerUserId?: number | null,
): Prisma.PostWhereInput {
  const canSeePrivatePosts = viewerUserId === userId;

  return {
    userId: BigInt(userId),
    isDeleted: false,
    ...(canSeePrivatePosts ? {} : { isHidden: false, isSecret: false }),
    category: {
      is: {
        name: {
          notIn: [...ALL_NOTICE_TAG_OPTIONS],
        },
      },
    },
  };
}

export async function countVisibleUserPosts(
  userId: number,
  viewerUserId?: number | null,
) {
  return prisma.post.count({
    where: buildVisibleUserPostCountWhere(userId, viewerUserId),
  });
}

function mapPost(
  post: {
    id: bigint;
    title: string;
    content: string;
    thumbnail: string | null;
    thumbnailCrop?: unknown;
    createdAt: Date;
    isHidden: boolean;
    isSecret: boolean;
    userId: bigint;
    isResolved?: boolean;
    user: { name: string | null; image?: string | null };
    category: { name: string } | null;
    views?: { viewCount: bigint | number } | null;
    _count: { likes: number; comments: number };
  },
  options?: {
    viewerUserId?: number | null;
    isAdmin?: boolean;
  },
) {
  const ownerUserId = Number(post.userId);
  const isSecretQna = post.category?.name === "QnA" && post.isSecret;
  const canViewSecret =
    !post.isSecret ||
    (typeof options?.viewerUserId === "number" &&
      ownerUserId === options.viewerUserId) ||
    (isSecretQna && Boolean(options?.isAdmin));

  return {
    id: Number(post.id),
    title: post.title,
    content: canViewSecret ? post.content : "비밀글입니다.",
    thumbnail: canViewSecret ? post.thumbnail : null,
    thumbnail_crop: canViewSecret ? parsePostThumbnailCrop(post.thumbnailCrop) : null,
    created_at: post.createdAt,
    author_name: post.user.name ?? "Unknown",
    author_image: post.user.image ?? null,
    category_name: post.category?.name ?? "",
    view_count: Number(post.views?.viewCount ?? 0),
    likes_count: post._count.likes,
    reactions_count: 0,
    comments_count: post._count.comments,
    is_resolved: post.isResolved ?? false,
    is_hidden: post.isHidden,
    is_secret: post.isSecret,
    can_view_secret: canViewSecret,
  };
}

async function mapPostsWithReactionCounts(
  posts: Array<Parameters<typeof mapPost>[0]>,
  options?: Parameters<typeof mapPost>[1],
) {
  const postIds = posts.map((post) => post.id);
  const [reactionCounts, thumbnailCropMap] = await Promise.all([
    getPostReactionCountsByPostId(postIds),
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
      },
      options,
    );

    return {
      ...mappedPost,
      reactions_count: reactionCounts.get(mappedPost.id) ?? 0,
    };
  });
}

function buildSearchWhere(
  tokens: string[],
  includeNotices: boolean,
  searchTarget: PostSearchTarget,
): Prisma.PostWhereInput {
  const baseWhere: Prisma.PostWhereInput = {
    isDeleted: false,
    isHidden: false,
    OR: tokens.map((token) =>
      searchTarget === "all"
        ? {
            OR: [
              { title: { contains: token, mode: "insensitive" } },
              { content: { contains: token, mode: "insensitive" } },
              {
                user: {
                  is: {
                    name: { contains: token, mode: "insensitive" },
                  },
                },
              },
              {
                category: {
                  is: {
                    name: { contains: token, mode: "insensitive" },
                  },
                },
              },
            ],
          }
        : searchTarget === "author"
          ? {
              user: {
                is: {
                  name: { contains: token, mode: "insensitive" },
                },
              },
            }
          : searchTarget === "category"
            ? {
                category: {
                  is: {
                    name: { contains: token, mode: "insensitive" },
                  },
                },
              }
            : {
                OR: [
                  { title: { contains: token, mode: "insensitive" } },
                  { content: { contains: token, mode: "insensitive" } },
                ],
              },
    ),
  };

  if (includeNotices) {
    return baseWhere;
  }

  return {
    ...baseWhere,
    category: {
      is: {
        name: {
          notIn: [...ALL_NOTICE_TAG_OPTIONS],
        },
      },
    },
  };
}

function buildSearchPostGroupWhere(
  group?: SearchPostGroup,
): Prisma.PostWhereInput {
  if (group === "posts") {
    return {
      OR: [
        { category: null },
        {
          category: {
            is: {
              name: {
                notIn: [...ALL_NOTICE_TAG_OPTIONS],
              },
            },
          },
        },
      ],
    };
  }

  if (group === "notice" || group === "faq" || group === "qna") {
    const noticeCategory =
      group === "notice" ? "공지" : group === "faq" ? "FAQ" : "QnA";

    return {
      category: {
        is: {
          name: {
            in: getNoticeCategoryQueryNames(noticeCategory),
          },
        },
      },
    };
  }

  return {};
}

async function getAdminAnsweredQnaPostIdSet(
  posts: Array<{
    id: bigint;
    category: { name: string } | null;
  }>,
) {
  const qnaPostIds = posts
    .filter((post) => {
      const normalizedCategory = normalizeNoticeCategory(post.category?.name);
      return normalizedCategory === "QnA" || normalizedCategory === "버그 제보";
    })
    .map((post) => post.id);

  if (qnaPostIds.length === 0) {
    return new Set<number>();
  }

  const answeredRows = await prisma.comment.findMany({
    where: {
      postId: {
        in: qnaPostIds,
      },
      isDeleted: false,
      user: {
        is: {
          role: "ADMIN",
        },
      },
    },
    select: {
      postId: true,
    },
    distinct: ["postId"],
  });

  const adminReactedPostIdSet = await getAdminReactedPostIdSet(qnaPostIds);

  return new Set([
    ...answeredRows.map((row) => Number(row.postId)),
    ...adminReactedPostIdSet,
  ]);
}

function scoreSearchMatch(
  post: {
    title: string;
    content: string;
    user: { name: string | null };
    category: { name: string } | null;
  },
  keyword: string,
  tokens: string[],
  searchTarget: PostSearchTarget,
) {
  const normalizedKeyword = normalizeSearchText(keyword);
  const normalizedTarget = normalizeSearchText(
    searchTarget === "all"
      ? `${post.title} ${post.content} ${post.user.name ?? ""} ${
          post.category?.name ?? ""
        }`
      : searchTarget === "author"
        ? (post.user.name ?? "")
        : searchTarget === "category"
          ? (post.category?.name ?? "")
          : `${post.title} ${post.content}`,
  );

  let score = 0;

  if (normalizedKeyword.length > 0) {
    if (normalizedTarget === normalizedKeyword) score += 120;
    if (normalizedTarget.startsWith(normalizedKeyword)) score += 80;
    if (normalizedTarget.includes(normalizedKeyword)) score += 60;
  }

  for (const token of tokens) {
    if (normalizedTarget.startsWith(token)) score += 14;
    else if (normalizedTarget.includes(token)) score += 10;
  }

  return score;
}

export async function searchPosts(
  keyword: string,
  limit: number,
  offset: number,
  sort: SortType = DEFAULT_SORT,
  options?: {
    includeNotices?: boolean;
    viewerUserId?: number | null;
    isAdmin?: boolean;
    searchTarget?: PostSearchTarget;
    postGroup?: SearchPostGroup;
  },
): Promise<DbPost[]> {
  const tokens = tokenizeSearchQuery(keyword);
  const includeNotices = options?.includeNotices ?? false;
  const searchTarget =
    options?.searchTarget === "all"
      ? "all"
      : parsePostSearchTarget(options?.searchTarget);

  if (tokens.length === 0) {
    return [];
  }

  const posts = await prisma.post.findMany({
    where: {
      AND: [
        buildSearchWhere(tokens, includeNotices, searchTarget),
        buildSearchPostGroupWhere(options?.postGroup),
      ],
    },
    take: Math.max(limit + offset, 48),
    include: {
      user: { select: { name: true, image: true } },
      category: { select: { name: true } },
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
  });

  const sortedPosts = posts
    .sort((a, b) => {
      const scoreDiff =
        scoreSearchMatch(b, keyword, tokens, searchTarget) -
        scoreSearchMatch(a, keyword, tokens, searchTarget);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return comparePostMetrics(
        sort,
        {
          id: a.id,
          createdAt: a.createdAt,
          likeCount: a._count.likes,
          commentsCount: a._count.comments,
          viewCount: Number(a.views?.viewCount ?? 0),
          categoryName: a.category?.name,
        },
        {
          id: b.id,
          createdAt: b.createdAt,
          likeCount: b._count.likes,
          commentsCount: b._count.comments,
          viewCount: Number(b.views?.viewCount ?? 0),
          categoryName: b.category?.name,
        },
      );
    })
    .slice(offset, offset + limit);
  const adminAnsweredQnaPostIdSet =
    await getAdminAnsweredQnaPostIdSet(sortedPosts);
  const reactionCounts = await getPostReactionCountsByPostId(
    sortedPosts.map((post) => post.id),
  );

  return sortedPosts
    .map((post) => {
      const mappedPost = mapPost(post, options);

      return {
        ...mappedPost,
        reactions_count: reactionCounts.get(mappedPost.id) ?? 0,
        has_admin_answer:
          normalizeNoticeCategory(post.category?.name) === "QnA" ||
          normalizeNoticeCategory(post.category?.name) === "버그 제보"
            ? adminAnsweredQnaPostIdSet.has(Number(post.id))
            : false,
      };
    })
    .filter(
      (post) => includeNotices || !isNoticeCategoryName(post.category_name),
    );
}

export async function countSearchPosts(
  keyword: string,
  options?: {
    includeNotices?: boolean;
    searchTarget?: PostSearchTarget;
  },
) {
  const tokens = tokenizeSearchQuery(keyword);
  const includeNotices = options?.includeNotices ?? false;
  const searchTarget =
    options?.searchTarget === "all"
      ? "all"
      : parsePostSearchTarget(options?.searchTarget);

  if (tokens.length === 0) {
    return 0;
  }

  return prisma.post.count({
    where: buildSearchWhere(tokens, includeNotices, searchTarget),
  });
}

export async function countSearchPostsByPreviewGroup(
  keyword: string,
  options?: {
    searchTarget?: PostSearchTarget;
  },
) {
  const tokens = tokenizeSearchQuery(keyword);
  const searchTarget =
    options?.searchTarget === "all"
      ? "all"
      : parsePostSearchTarget(options?.searchTarget);

  if (tokens.length === 0) {
    return {
      posts: 0,
      notice: 0,
      faq: 0,
      qna: 0,
    };
  }

  const baseWhere = buildSearchWhere(tokens, true, searchTarget);
  const countWithCategoryWhere = (where: Prisma.PostWhereInput) =>
    prisma.post.count({
      where: {
        AND: [baseWhere, where],
      },
    });

  const [posts, notice, faq, qna] = await Promise.all([
    countWithCategoryWhere({
      OR: [
        { category: null },
        {
          category: {
            is: {
              name: {
                notIn: [...ALL_NOTICE_TAG_OPTIONS],
              },
            },
          },
        },
      ],
    }),
    countWithCategoryWhere({
      category: {
        is: {
          name: {
            in: getNoticeCategoryQueryNames("공지"),
          },
        },
      },
    }),
    countWithCategoryWhere({
      category: {
        is: {
          name: {
            in: getNoticeCategoryQueryNames("FAQ"),
          },
        },
      },
    }),
    countWithCategoryWhere({
      category: {
        is: {
          name: {
            in: getNoticeCategoryQueryNames("QnA"),
          },
        },
      },
    }),
  ]);

  return {
    posts,
    notice,
    faq,
    qna,
  };
}

export async function countUsersByName(keyword: string) {
  const query = keyword.trim();

  if (!query) {
    return 0;
  }

  return prisma.user.count({
    where: {
      isBlocked: false,
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
  });
}

export async function searchUsersByName(
  keyword: string,
  limit = 12,
  sort: UserSearchSort = "nameAsc",
  viewerUserId?: number | null,
  offset = 0,
): Promise<DbUserSearchResult[]> {
  const query = keyword.trim();
  const parsedSort = parseUserSearchSort(sort);

  if (!query) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      isBlocked: false,
      name: {
        contains: query,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      image: true,
      _count: {
        select: {
          followers: true,
        },
      },
    },
    orderBy:
      parsedSort === "followers"
        ? [{ followers: { _count: "desc" } }, { name: "asc" }]
        : parsedSort === "posts"
          ? [{ posts: { _count: "desc" } }, { name: "asc" }]
          : [{ name: parsedSort === "nameDesc" ? "desc" : "asc" }],
    ...(parsedSort === "posts" ? {} : { skip: offset, take: limit }),
  });

  const usersWithPostCount = await Promise.all(
    users.map(async (user) => ({
      id: Number(user.id),
      name: user.name,
      image: user.image,
      followerCount: user._count.followers,
      postCount: await countVisibleUserPosts(
        Number(user.id),
        viewerUserId ?? null,
      ),
    })),
  );

  if (parsedSort === "posts") {
    return usersWithPostCount
      .sort(
        (a, b) =>
          b.postCount - a.postCount ||
          (a.name ?? "").localeCompare(b.name ?? ""),
      )
      .slice(offset, offset + limit);
  }

  return usersWithPostCount;
}

export async function getPostsByCategorySlug(
  slug: string,
  limit: number,
  offset: number,
  sort: SortType = DEFAULT_SORT,
  options?: {
    viewerUserId?: number | null;
    isAdmin?: boolean;
  },
): Promise<{ categoryName: string | null; posts: DbPost[] }> {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { name: true },
  });

  if (!category) {
    return {
      categoryName: null,
      posts: [],
    };
  }

  const noticeCategory = normalizeNoticeCategory(category.name);

  if (noticeCategory !== null) {
    return {
      categoryName: null,
      posts: [],
    };
  }

  if (category.name === "미분류") {
    return {
      categoryName: null,
      posts: [],
    };
  }

  const posts = await prisma.post.findMany({
    where: {
      isDeleted: false,
      isHidden: false,
      category: {
        is: { slug },
      },
    },
    include: {
      user: { select: { name: true, image: true } },
      category: { select: { name: true } },
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
  });

  const pagedPosts = posts
    .sort((a, b) => {
      return comparePostMetrics(
        sort,
        {
          id: a.id,
          createdAt: a.createdAt,
          likeCount: a._count.likes,
          commentsCount: a._count.comments,
          viewCount: Number(a.views?.viewCount ?? 0),
          categoryName: a.category?.name,
        },
        {
          id: b.id,
          createdAt: b.createdAt,
          likeCount: b._count.likes,
          commentsCount: b._count.comments,
          viewCount: Number(b.views?.viewCount ?? 0),
          categoryName: b.category?.name,
        },
      );
    })
    .slice(offset, offset + limit);

  return {
    categoryName: category.name,
    posts: await mapPostsWithReactionCounts(pagedPosts, options),
  };
}

export async function getUserPosts(
  userId: number,
  sort: SortType = DEFAULT_SORT,
  limit?: number,
  offset = 0,
  options?: {
    viewerUserId?: number | null;
    isAdmin?: boolean;
    query?: string;
    searchTarget?: PostSearchTarget;
    categorySlug?: string;
  },
): Promise<DbPost[]> {
  const canSeeHiddenPosts = options?.viewerUserId === userId;
  const normalizedQuery = options?.query?.trim();
  const normalizedCategorySlug = options?.categorySlug?.trim();
  const searchTarget =
    options?.searchTarget === "all"
      ? "all"
      : parsePostSearchTarget(options?.searchTarget);
  const orderBy: Prisma.PostOrderByWithRelationInput[] =
    sort === "oldest"
      ? [{ createdAt: "asc" }, { id: "asc" }]
      : sort === "views"
        ? [
            { views: { viewCount: "desc" } },
            { createdAt: "desc" },
            { id: "desc" },
          ]
        : sort === "likes"
          ? [
              { likes: { _count: "desc" } },
              { createdAt: "desc" },
              { id: "desc" },
            ]
          : sort === "comments"
            ? [
                { comments: { _count: "desc" } },
                { createdAt: "desc" },
                { id: "desc" },
              ]
            : sort === "category"
              ? [
                  { category: { name: "asc" } },
                  { createdAt: "desc" },
                  { id: "desc" },
                ]
              : sort === "categoryDesc"
                ? [
                    { category: { name: "desc" } },
                    { createdAt: "desc" },
                    { id: "desc" },
                  ]
                : [{ createdAt: "desc" }, { id: "desc" }];
  const searchWhere: Prisma.PostWhereInput =
    normalizedQuery && searchTarget === "category"
      ? {
          category: {
            is: {
              name: { contains: normalizedQuery, mode: "insensitive" },
            },
          },
        }
      : normalizedQuery && searchTarget === "text"
        ? {
            OR: [
              { title: { contains: normalizedQuery, mode: "insensitive" } },
              { content: { contains: normalizedQuery, mode: "insensitive" } },
            ],
          }
        : normalizedQuery
          ? {
              OR: [
                { title: { contains: normalizedQuery, mode: "insensitive" } },
                { content: { contains: normalizedQuery, mode: "insensitive" } },
                {
                  category: {
                    is: {
                      name: {
                        contains: normalizedQuery,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }
          : {};

  const posts = await prisma.post.findMany({
    where: {
      userId: BigInt(userId),
      isDeleted: false,
      ...(canSeeHiddenPosts ? {} : { isHidden: false, isSecret: false }),
      category: {
        is: {
          ...(normalizedCategorySlug ? { slug: normalizedCategorySlug } : {}),
          name: {
            notIn: [...ALL_NOTICE_TAG_OPTIONS],
          },
        },
      },
      ...(normalizedQuery ? { AND: [searchWhere] } : {}),
    },
    orderBy,
    skip: offset,
    ...(typeof limit === "number" ? { take: limit } : {}),
    include: {
      user: { select: { name: true, image: true } },
      category: { select: { name: true } },
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
  });

  return mapPostsWithReactionCounts(posts, {
    viewerUserId: options?.viewerUserId ?? null,
    isAdmin: options?.isAdmin,
  });
}

export async function countUserPosts(
  userId: number,
  options?: {
    viewerUserId?: number | null;
    categorySlug?: string;
    query?: string;
    searchTarget?: PostSearchTarget;
  },
) {
  const canSeeHiddenPosts = options?.viewerUserId === userId;
  const normalizedQuery = options?.query?.trim();
  const normalizedCategorySlug = options?.categorySlug?.trim();
  const searchTarget =
    options?.searchTarget === "all"
      ? "all"
      : parsePostSearchTarget(options?.searchTarget);
  const searchWhere: Prisma.PostWhereInput =
    normalizedQuery && searchTarget === "category"
      ? {
          category: {
            is: {
              name: { contains: normalizedQuery, mode: "insensitive" },
            },
          },
        }
      : normalizedQuery && searchTarget === "text"
        ? {
            OR: [
              { title: { contains: normalizedQuery, mode: "insensitive" } },
              { content: { contains: normalizedQuery, mode: "insensitive" } },
            ],
          }
        : normalizedQuery
          ? {
              OR: [
                { title: { contains: normalizedQuery, mode: "insensitive" } },
                { content: { contains: normalizedQuery, mode: "insensitive" } },
                {
                  category: {
                    is: {
                      name: {
                        contains: normalizedQuery,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }
          : {};

  return prisma.post.count({
    where: {
      userId: BigInt(userId),
      isDeleted: false,
      ...(canSeeHiddenPosts ? {} : { isHidden: false, isSecret: false }),
      category: {
        is: {
          ...(normalizedCategorySlug ? { slug: normalizedCategorySlug } : {}),
          name: {
            notIn: [...ALL_NOTICE_TAG_OPTIONS],
          },
        },
      },
      ...(normalizedQuery ? { AND: [searchWhere] } : {}),
    },
  });
}

export async function getMyPosts(
  userId: number,
  sort: SortType = DEFAULT_SORT,
  limit?: number,
  offset = 0,
  options?: {
    categorySlug?: string;
    query?: string;
    searchTarget?: PostSearchTarget;
  },
): Promise<DbPost[]> {
  return getUserPosts(userId, sort, limit, offset, {
    viewerUserId: userId,
    categorySlug: options?.categorySlug,
    query: options?.query,
    searchTarget: options?.searchTarget,
  });
}

export async function getMyQnaPosts(
  userId: number,
  sort: SortType = DEFAULT_SORT,
  limit?: number,
  offset = 0,
  options?: {
    query?: string;
    searchTarget?: PostSearchTarget;
  },
): Promise<DbPost[]> {
  const normalizedQuery = options?.query?.trim();
  const searchTarget =
    options?.searchTarget === "all"
      ? "all"
      : parsePostSearchTarget(options?.searchTarget);
  const searchWhere: Prisma.PostWhereInput =
    normalizedQuery && searchTarget === "category"
      ? {
          category: {
            is: {
              name: { contains: normalizedQuery, mode: "insensitive" },
            },
          },
        }
      : normalizedQuery && searchTarget === "text"
        ? {
            OR: [
              { title: { contains: normalizedQuery, mode: "insensitive" } },
              { content: { contains: normalizedQuery, mode: "insensitive" } },
            ],
          }
        : normalizedQuery
          ? {
              OR: [
                { title: { contains: normalizedQuery, mode: "insensitive" } },
                { content: { contains: normalizedQuery, mode: "insensitive" } },
                {
                  category: {
                    is: {
                      name: {
                        contains: normalizedQuery,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }
          : {};

  const posts = await prisma.post.findMany({
    where: {
      userId: BigInt(userId),
      isDeleted: false,
      category: {
        is: {
          name: "QnA",
        },
      },
      ...(normalizedQuery ? { AND: [searchWhere] } : {}),
    },
    include: {
      user: { select: { name: true, image: true } },
      category: { select: { name: true } },
      views: { select: { viewCount: true } },
      _count: {
        select: {
          likes: true,
          comments: {
            where: buildVisibleCommentCountWhere(userId),
          },
        },
      },
    },
  });

  const pagedPosts = posts
    .sort((a, b) => {
      return comparePostMetrics(
        sort,
        {
          id: a.id,
          createdAt: a.createdAt,
          likeCount: a._count.likes,
          commentsCount: a._count.comments,
          viewCount: Number(a.views?.viewCount ?? 0),
          categoryName: a.category?.name,
        },
        {
          id: b.id,
          createdAt: b.createdAt,
          likeCount: b._count.likes,
          commentsCount: b._count.comments,
          viewCount: Number(b.views?.viewCount ?? 0),
          categoryName: b.category?.name,
        },
      );
    })
    .slice(offset, limit ? offset + limit : undefined);
  const adminAnsweredQnaPostIdSet =
    await getAdminAnsweredQnaPostIdSet(pagedPosts);
  const mappedPosts = await mapPostsWithReactionCounts(pagedPosts, {
    viewerUserId: userId,
  });

  return mappedPosts.map((post) => ({
    ...post,
    has_admin_answer: adminAnsweredQnaPostIdSet.has(post.id),
  }));
}

export async function countMyQnaPosts(
  userId: number,
  options?: {
    query?: string;
    searchTarget?: PostSearchTarget;
  },
) {
  const normalizedQuery = options?.query?.trim();
  const searchTarget =
    options?.searchTarget === "all"
      ? "all"
      : parsePostSearchTarget(options?.searchTarget);
  const searchWhere: Prisma.PostWhereInput =
    normalizedQuery && searchTarget === "category"
      ? {
          category: {
            is: {
              name: { contains: normalizedQuery, mode: "insensitive" },
            },
          },
        }
      : normalizedQuery && searchTarget === "text"
        ? {
            OR: [
              { title: { contains: normalizedQuery, mode: "insensitive" } },
              { content: { contains: normalizedQuery, mode: "insensitive" } },
            ],
          }
        : normalizedQuery
          ? {
              OR: [
                { title: { contains: normalizedQuery, mode: "insensitive" } },
                { content: { contains: normalizedQuery, mode: "insensitive" } },
                {
                  category: {
                    is: {
                      name: {
                        contains: normalizedQuery,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }
          : {};

  return prisma.post.count({
    where: {
      userId: BigInt(userId),
      isDeleted: false,
      category: {
        is: {
          name: "QnA",
        },
      },
      ...(normalizedQuery ? { AND: [searchWhere] } : {}),
    },
  });
}

export async function getLikedPosts(
  userId: number,
  sort: SortType = DEFAULT_SORT,
  limit?: number,
  offset = 0,
  options?: {
    isAdmin?: boolean;
    query?: string;
    searchTarget?: PostSearchTarget;
  },
): Promise<DbPost[]> {
  const normalizedQuery = options?.query?.trim();
  const searchTarget = parsePostSearchTarget(options?.searchTarget);
  const searchWhere: Prisma.PostWhereInput =
    normalizedQuery && searchTarget === "author"
      ? {
          user: {
            is: {
              name: { contains: normalizedQuery, mode: "insensitive" },
            },
          },
        }
      : normalizedQuery && searchTarget === "category"
        ? {
            category: {
              is: {
                name: { contains: normalizedQuery, mode: "insensitive" },
              },
            },
          }
        : normalizedQuery
          ? {
              OR: [
                { title: { contains: normalizedQuery, mode: "insensitive" } },
                { content: { contains: normalizedQuery, mode: "insensitive" } },
              ],
            }
          : {};

  const posts = await prisma.post.findMany({
    omit: {
      isResolved: true,
    },
    where: {
      isDeleted: false,
      isHidden: false,
      category: {
        is: {
          name: {
            notIn: [...ALL_NOTICE_TAG_OPTIONS],
          },
        },
      },
      likes: {
        some: {
          userId: BigInt(userId),
        },
      },
      ...(normalizedQuery ? { AND: [searchWhere] } : {}),
    },
    include: {
      user: { select: { name: true, image: true } },
      category: { select: { name: true } },
      views: { select: { viewCount: true } },
      _count: {
        select: {
          likes: true,
          comments: {
            where: buildVisibleCommentCountWhere(userId),
          },
        },
      },
    },
  });

  const pagedPosts = posts
    .sort((a, b) => {
      return comparePostMetrics(
        sort,
        {
          id: a.id,
          createdAt: a.createdAt,
          likeCount: a._count.likes,
          commentsCount: a._count.comments,
          viewCount: Number(a.views?.viewCount ?? 0),
          categoryName: a.category?.name,
        },
        {
          id: b.id,
          createdAt: b.createdAt,
          likeCount: b._count.likes,
          commentsCount: b._count.comments,
          viewCount: Number(b.views?.viewCount ?? 0),
          categoryName: b.category?.name,
        },
      );
    })
    .slice(offset, limit ? offset + limit : undefined);

  return mapPostsWithReactionCounts(pagedPosts, {
    viewerUserId: userId,
    isAdmin: options?.isAdmin,
  });
}

export async function countLikedPosts(
  userId: number,
  query?: string,
  searchTarget?: PostSearchTarget,
) {
  const normalizedQuery = query?.trim();
  const parsedSearchTarget = parsePostSearchTarget(searchTarget);
  const searchWhere: Prisma.PostWhereInput =
    normalizedQuery && parsedSearchTarget === "author"
      ? {
          user: {
            is: {
              name: { contains: normalizedQuery, mode: "insensitive" },
            },
          },
        }
      : normalizedQuery && parsedSearchTarget === "category"
        ? {
            category: {
              is: {
                name: { contains: normalizedQuery, mode: "insensitive" },
              },
            },
          }
        : normalizedQuery
          ? {
              OR: [
                { title: { contains: normalizedQuery, mode: "insensitive" } },
                { content: { contains: normalizedQuery, mode: "insensitive" } },
              ],
            }
          : {};

  return prisma.post.count({
    where: {
      isDeleted: false,
      isHidden: false,
      category: {
        is: {
          name: {
            notIn: [...ALL_NOTICE_TAG_OPTIONS],
          },
        },
      },
      likes: {
        some: {
          userId: BigInt(userId),
        },
      },
      ...(normalizedQuery ? { AND: [searchWhere] } : {}),
    },
  });
}

export async function getRandomPosts(
  limit: number,
  options?: {
    viewerUserId?: number | null;
    isAdmin?: boolean;
  },
): Promise<DbPost[]> {
  const posts = await prisma.post.findMany({
    omit: {
      isResolved: true,
    },
    where: {
      isDeleted: false,
      isHidden: false,
      category: {
        is: {
          name: {
            notIn: [...ALL_NOTICE_TAG_OPTIONS],
          },
        },
      },
    },
    include: {
      user: { select: { name: true, image: true } },
      category: { select: { name: true } },
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
  });

  const randomPosts = posts.sort(() => Math.random() - 0.5).slice(0, limit);

  return mapPostsWithReactionCounts(randomPosts, options);
}
