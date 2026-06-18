import type { Prisma } from "@prisma/client";
import { ensureCategoryByName } from "@/lib/categories";
import { buildVisibleCommentCountWhere } from "@/lib/comment-counts";
import type { DbPostAttachment } from "@/lib/db";
import {
  ALL_NOTICE_TAG_OPTIONS,
  getNoticeCategoryQueryNames,
  isNoticeCategoryName,
  type NoticeTag,
  normalizeNoticeCategory,
  parseNoticeSearchTarget,
} from "@/lib/notice-categories";
import { getAdminReactedPostIdSet } from "@/lib/post-reactions";
import { mapPostAttachments } from "@/lib/post-attachments";
import {
  comparePostMetrics,
  DEFAULT_SORT,
  type SortType,
} from "@/lib/post-sort";
import { prisma } from "@/lib/prisma";
import { getLogNoticePath } from "@/lib/routes";

export const LEGACY_NOTICE_SEED = [
  {
    title: "c.horok 오픈 안내",
    summary:
      "기술 기록과 공유를 위한 c.horok가 문을 열었습니다. 주요 기능과 이용 방향을 안내드립니다.",
    publishedAt: "2026-04-05T00:00:00.000Z",
    isPinned: true,
    content: [
      "안녕하세요. c.horok를 찾아주셔서 감사합니다.",
      "c.horok는 개발 기록을 남기고, 배운 내용을 공유하고, 서로의 성장을 응원하는 공간으로 준비했습니다.",
      "현재는 피드, 북마크, 마이페이지, 공지사항 기능을 중심으로 운영하고 있으며 앞으로 커뮤니티 경험을 더 풍성하게 다듬어갈 예정입니다.",
      "서비스 이용 중 불편한 점이나 제안하고 싶은 기능이 있다면 언제든지 의견을 남겨 주세요. 작은 피드백도 꼼꼼히 반영하겠습니다.",
      "앞으로의 업데이트와 운영 소식은 공지사항 탭을 통해 가장 먼저 전달드리겠습니다. 감사합니다.",
    ],
  },
  {
    title: "서비스 업데이트 예정 안내",
    summary:
      "게시글 탐색성과 커뮤니티 편의성을 높이기 위한 다음 업데이트 방향을 공유합니다.",
    publishedAt: "2026-04-05T00:00:00.000Z",
    isPinned: false,
    content: [
      "다음 업데이트에서는 공지사항 고도화, 피드 탐색 개선, 사용자 경험 안정화 작업을 우선적으로 진행할 예정입니다.",
      "특히 자주 찾는 정보에 더 빠르게 접근할 수 있도록 목록 구성과 상세 페이지 흐름을 정리하고 있습니다.",
      "업데이트 일정은 개발 진행 상황에 따라 일부 조정될 수 있으며, 확정되는 내용은 별도 공지로 안내드리겠습니다.",
    ],
  },
  {
    title: "커뮤니티 이용 가이드",
    summary:
      "모두가 편안하게 기록하고 소통할 수 있도록 기본 운영 원칙을 안내드립니다.",
    publishedAt: "2026-04-05T00:00:00.000Z",
    isPinned: false,
    content: [
      "서로를 존중하는 표현과 태도를 기본으로 해 주세요.",
      "광고성 도배, 타인을 불쾌하게 하는 표현, 서비스 운영을 방해하는 행위는 제한될 수 있습니다.",
      "기술 기록과 질문, 회고, 배운 점 공유 등 커뮤니티에 도움이 되는 내용을 환영합니다.",
    ],
  },
] as const;

export const LEGACY_BANNER_NOTICE_SEED = [
  {
    title:
      "호록 기술 블로그가 2026년 1월 6일부로 개설되었어요! 많은 관심 가져 주세요.  🎉",
    summary:
      "호록 기술 블로그 오픈 소식을 배너에서 보셨던 문구 그대로 공지사항에도 남겨둡니다.",
    publishedAt: "2026-01-06T00:00:00.000Z",
    categoryName: "공지" as NoticeTag,
    content: [
      "호록 기술 블로그가 2026년 1월 6일부로 개설되었어요! 많은 관심 가져 주세요.  🎉",
      "기존 배너에서 안내하던 오픈 문구를 공지사항 게시물로도 함께 보관합니다.",
      "앞으로 서비스 오픈, 주요 변경, 운영 안내는 공지사항과 배너에 함께 반영됩니다.",
    ],
  },
  {
    title: "2026년 붉은🔥 말🐴의 해가 밝았어요. 새해 복 많이 받으세요!",
    summary: "기존 새해 배너 문구를 공지사항 게시물로 옮겨 보관합니다.",
    publishedAt: "2026-01-01T00:00:00.000Z",
    categoryName: "공지" as NoticeTag,
    content: [
      "2026년 붉은🔥 말🐴의 해가 밝았어요. 새해 복 많이 받으세요!",
      "배너에 노출되던 새해 인사 문구도 공지사항 게시물로 함께 저장합니다.",
      "앞으로 배너에 보여주는 운영 메시지는 가능한 한 공지사항 데이터와 같은 원본을 사용합니다.",
    ],
  },
] as const;

export type NoticeListItem = {
  id: number;
  title: string;
  categoryName: NoticeTag;
  summary: string;
  content: string;
  thumbnail: string | null;
  publishedAt: string;
  authorName: string;
  authorImage: string | null;
  isPinned: boolean;
  isLocked: boolean;
  isHidden: boolean;
  isSecret: boolean;
  canViewSecret: boolean;
  isBanner: boolean;
  isOwner: boolean;
  canManageBanner: boolean;
  isResolved: boolean;
  hasAdminAnswer: boolean;
  likesCount: number;
  commentsCount: number;
  viewCount: number;
};

export type NoticeDetail = {
  id: number;
  title: string;
  content: string;
  summary: string;
  publishedAt: Date;
  updatedAt: Date;
  authorName: string;
  authorImage: string | null;
  categoryName: string;
  thumbnail: string | null;
  viewCount: number;
  likesCount: number;
  commentsCount: number;
  isHidden: boolean;
  isBanner: boolean;
  userId: number;
  isPinned: boolean;
  isSecret: boolean;
  canViewSecret: boolean;
  isResolved: boolean;
  hasAdminAnswer: boolean;
  attachments: DbPostAttachment[];
};

export type NoticeBannerItem = {
  id: number;
  title: string;
  href: string;
};

export type NoticeAccessMeta = {
  exists: boolean;
  categoryName: NoticeTag | null;
  isDeleted: boolean;
  isSecret: boolean;
};

function extractPlainText(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[[^\]]+]\([^)]+\)/g, "$1")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/[>*_~[\]()|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSummary(markdown: string) {
  const plainText = extractPlainText(markdown);
  return plainText.length > 140 ? `${plainText.slice(0, 140)}...` : plainText;
}

function stripLegacyNoticePrefix(title: string) {
  const match = title.match(/^\[([^\]]+)\]\s*(.+)$/);

  if (match && isNoticeCategoryName(match[1])) {
    return match[2];
  }

  return title;
}

export function isPinnedNotice(categoryName: string, title: string) {
  const normalizedTitle = title.trim();
  return categoryName !== "공지" || normalizedTitle === "c.horok 오픈 안내";
}

function buildNoticeSearchWhere(
  query?: string | null,
  searchTarget?: ReturnType<typeof parseNoticeSearchTarget>,
): Prisma.PostWhereInput {
  const normalizedQuery = query?.trim();
  const parsedSearchTarget = parseNoticeSearchTarget(searchTarget);

  if (!normalizedQuery) {
    return {};
  }

  if (parsedSearchTarget === "author") {
    return {
      user: {
        is: {
          name: { contains: normalizedQuery, mode: "insensitive" },
        },
      },
    };
  }

  if (parsedSearchTarget === "category") {
    return {
      category: {
        is: {
          name: { contains: normalizedQuery, mode: "insensitive" },
        },
      },
    };
  }

  return {
    OR: [
      { title: { contains: normalizedQuery, mode: "insensitive" } },
      { content: { contains: normalizedQuery, mode: "insensitive" } },
    ],
  };
}

function buildNoticeWhere(
  category?: NoticeTag,
  options?: {
    query?: string | null;
    searchTarget?: ReturnType<typeof parseNoticeSearchTarget>;
  },
): Prisma.PostWhereInput {
  const searchWhere = buildNoticeSearchWhere(
    options?.query,
    options?.searchTarget,
  );

  return {
    isDeleted: false,
    isHidden: false,
    category: {
      is: {
        name: {
          in: getNoticeCategoryQueryNames(category),
        },
      },
    },
    ...(options?.query?.trim() ? { AND: [searchWhere] } : {}),
  };
}

export async function countNoticesByCategory(
  queryByCategory: Partial<Record<NoticeTag, string | undefined>>,
  searchTarget?: ReturnType<typeof parseNoticeSearchTarget>,
) {
  const entries = await Promise.all(
    (["공지", "FAQ", "QnA", "버그 제보"] as NoticeTag[]).map(
      async (category) => {
        const count = await prisma.post.count({
          where: buildNoticeWhere(category, {
            query: queryByCategory[category],
            searchTarget,
          }),
        });

        return [category, count] as const;
      },
    ),
  );

  return Object.fromEntries(entries) as Record<NoticeTag, number>;
}

export async function findNotices(
  sort: SortType = DEFAULT_SORT,
  category?: NoticeTag,
  options?: {
    viewerUserId?: number | null;
    isAdmin?: boolean;
    query?: string | null;
    searchTarget?: ReturnType<typeof parseNoticeSearchTarget>;
  },
) {
  const where = buildNoticeWhere(category, {
    query: options?.query,
    searchTarget: options?.searchTarget,
  });
  const notices = await prisma.post.findMany({
    where,
    include: {
      user: {
        select: { name: true, image: true },
      },
      category: {
        select: { name: true },
      },
      views: {
        select: { viewCount: true },
      },
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
  const qnaPostIds = notices
    .filter((notice) => {
      const normalizedCategory = normalizeNoticeCategory(notice.category?.name);
      return normalizedCategory === "QnA" || normalizedCategory === "버그 제보";
    })
    .map((notice) => notice.id);
  const adminAnswerRows =
    qnaPostIds.length > 0
      ? await prisma.comment.findMany({
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
        })
      : [];
  const adminAnsweredQnaPostIdSet = new Set(
    adminAnswerRows.map((comment) => Number(comment.postId)),
  );
  const adminReactedQnaPostIdSet = await getAdminReactedPostIdSet(qnaPostIds);

  return notices
    .sort((a, b) =>
      comparePostMetrics(
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
      ),
    )
    .map<NoticeListItem>((notice) => {
      const normalizedCategory =
        normalizeNoticeCategory(notice.category?.name) ?? "공지";
      const isSecretQna = normalizedCategory === "QnA" && notice.isSecret;
      const canViewSecret =
        !notice.isSecret ||
        (typeof options?.viewerUserId === "number" &&
          Number(notice.userId) === options.viewerUserId) ||
        (isSecretQna && Boolean(options?.isAdmin));

      return {
        id: Number(notice.id),
        title: stripLegacyNoticePrefix(notice.title),
        categoryName: normalizedCategory,
        summary: canViewSecret ? getSummary(notice.content) : "비밀글입니다.",
        content: canViewSecret ? notice.content : "비밀글입니다.",
        thumbnail: notice.thumbnail,
        publishedAt: notice.createdAt.toISOString().slice(0, 10),
        authorName: notice.user.name ?? "c.horok 운영팀",
        authorImage: notice.user.image ?? null,
        isPinned: isPinnedNotice(normalizedCategory, notice.title),
        isLocked: notice.isSecret,
        isHidden: notice.isHidden,
        isSecret: notice.isSecret,
        canViewSecret,
        isBanner: notice.isBanner,
        isOwner:
          typeof options?.viewerUserId === "number" &&
          Number(notice.userId) === options.viewerUserId,
        canManageBanner:
          Boolean(options?.isAdmin) &&
          typeof options?.viewerUserId === "number" &&
          Number(notice.userId) === options.viewerUserId,
        isResolved: notice.isResolved,
        hasAdminAnswer:
          normalizedCategory === "QnA" || normalizedCategory === "버그 제보"
            ? adminAnsweredQnaPostIdSet.has(Number(notice.id)) ||
              adminReactedQnaPostIdSet.has(Number(notice.id))
            : false,
        likesCount: notice._count.likes,
        commentsCount: notice._count.comments,
        viewCount: Number(notice.views?.viewCount ?? 0),
      };
    });
}

export async function findBannerNotices(limit = 5) {
  const notices = await prisma.post.findMany({
    omit: {
      isResolved: true,
    },
    where: {
      isDeleted: false,
      isHidden: false,
      isBanner: true,
      category: {
        is: {
          name: {
            in: [...ALL_NOTICE_TAG_OPTIONS],
          },
        },
      },
    },
    include: {
      category: {
        select: { name: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });

  return notices.slice(0, limit).map<NoticeBannerItem>((notice) => ({
    id: Number(notice.id),
    title: stripLegacyNoticePrefix(notice.title),
    href: getLogNoticePath(Number(notice.id)),
  }));
}

export async function seedLegacyBannerNotices(userId: number) {
  const category = await ensureCategoryByName("공지");
  const titles = LEGACY_BANNER_NOTICE_SEED.map((notice) => notice.title);
  const existingPosts = await prisma.post.findMany({
    where: {
      isDeleted: false,
      title: {
        in: titles,
      },
      categoryId: BigInt(category.id),
    },
    select: {
      id: true,
      title: true,
      isBanner: true,
    },
  });

  const existingTitleSet = new Set(existingPosts.map((post) => post.title));
  const postsToUpdate = existingPosts.filter((post) => !post.isBanner);
  const noticesToCreate = LEGACY_BANNER_NOTICE_SEED.filter(
    (notice) => !existingTitleSet.has(notice.title),
  );

  if (postsToUpdate.length === 0 && noticesToCreate.length === 0) {
    return { createdCount: 0, updatedCount: 0 };
  }

  await prisma.$transaction([
    ...postsToUpdate.map((post) =>
      prisma.post.update({
        where: { id: post.id },
        data: { isBanner: true },
      }),
    ),
    ...noticesToCreate.map((notice) =>
      prisma.post.create({
        data: {
          userId: BigInt(userId),
          categoryId: BigInt(category.id),
          title: notice.title,
          content: notice.content.join("\n\n"),
          isBanner: true,
          createdAt: new Date(notice.publishedAt),
          updatedAt: new Date(notice.publishedAt),
        },
      }),
    ),
  ]);

  return {
    createdCount: noticesToCreate.length,
    updatedCount: postsToUpdate.length,
  };
}

export async function findNoticeById(
  id: number,
  options?: {
    includeHiddenForUserId?: number | null;
    isAdmin?: boolean;
  },
) {
  const [notice, adminAnswerCount, adminReactedPostIdSet] = await Promise.all([
    prisma.post.findFirst({
      where: {
        id: BigInt(id),
        isDeleted: false,
        category: {
          is: {
            name: {
              in: [...ALL_NOTICE_TAG_OPTIONS],
            },
          },
        },
        OR: [
          { isHidden: false },
          ...(options?.includeHiddenForUserId
            ? [{ userId: BigInt(options.includeHiddenForUserId) }]
            : []),
        ],
      },
      include: {
        user: {
          select: { name: true, image: true },
        },
        category: {
          select: { name: true },
        },
        views: {
          select: { viewCount: true },
        },
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
    }),
    prisma.comment.count({
      where: {
        postId: BigInt(id),
        isDeleted: false,
        user: {
          is: {
            role: "ADMIN",
          },
        },
      },
    }),
    getAdminReactedPostIdSet([BigInt(id)]),
  ]);

  if (!notice) {
    return null;
  }

  const normalizedCategory = normalizeNoticeCategory(notice.category?.name);
  const isSecretQna = normalizedCategory === "QnA" && notice.isSecret;
  const canViewSecret =
    !notice.isSecret ||
    (options?.includeHiddenForUserId
      ? Number(notice.userId) === options.includeHiddenForUserId
      : false) ||
    (isSecretQna && Boolean(options?.isAdmin));

  if (notice.isSecret && !canViewSecret) {
    return null;
  }

  return {
    id: Number(notice.id),
    title: stripLegacyNoticePrefix(notice.title),
    content: canViewSecret ? notice.content : "비밀글입니다.",
    summary: canViewSecret ? getSummary(notice.content) : "비밀글입니다.",
    publishedAt: notice.createdAt,
    updatedAt: notice.updatedAt,
    authorName: notice.user.name ?? "c.horok 운영팀",
    authorImage: notice.user.image ?? null,
    categoryName: normalizedCategory ?? "공지",
    thumbnail: canViewSecret ? notice.thumbnail : null,
    viewCount: Number(notice.views?.viewCount ?? 0),
    likesCount: notice._count.likes,
    commentsCount: notice._count.comments,
    isHidden: notice.isHidden,
    isBanner: notice.isBanner,
    userId: Number(notice.userId),
    isPinned: isPinnedNotice(
      normalizedCategory ?? notice.category?.name ?? "공지",
      notice.title,
    ),
    isSecret: notice.isSecret,
    canViewSecret,
    isResolved: notice.isResolved,
    hasAdminAnswer:
      normalizedCategory === "QnA" || normalizedCategory === "버그 제보"
        ? adminAnswerCount > 0 || adminReactedPostIdSet.has(id)
        : false,
    attachments: canViewSecret
      ? mapPostAttachments(notice.attachments ?? [])
      : [],
  } satisfies NoticeDetail;
}

export async function findNoticeAccessMetaById(
  id: number,
): Promise<NoticeAccessMeta> {
  const notice = await prisma.post.findFirst({
    where: {
      id: BigInt(id),
      category: {
        is: {
          name: {
            in: [...ALL_NOTICE_TAG_OPTIONS],
          },
        },
      },
    },
    select: {
      isDeleted: true,
      isSecret: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!notice) {
    return {
      exists: false,
      categoryName: null,
      isDeleted: false,
      isSecret: false,
    };
  }

  return {
    exists: true,
    categoryName: normalizeNoticeCategory(notice.category?.name),
    isDeleted: notice.isDeleted,
    isSecret: notice.isSecret,
  };
}
