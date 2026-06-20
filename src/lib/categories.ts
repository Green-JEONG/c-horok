import { normalizeNoticeCategory } from "@/lib/notice-categories";
import { INTERNAL_UNCATEGORIZED_CATEGORY_NAME } from "@/lib/category-labels";
import { prisma } from "@/lib/prisma";

export {
  INTERNAL_UNCATEGORIZED_CATEGORY_NAME,
  filterVisibleCategoryNames,
  isInternalUncategorizedCategory,
} from "@/lib/category-labels";

function normalizeCategoryName(name: string) {
  const normalizedName = name.replace(/\s+/g, " ").trim();
  const noticeCategory = normalizeNoticeCategory(normalizedName);

  return noticeCategory ?? normalizedName.toLocaleLowerCase();
}

function slugifyCategoryName(name: string) {
  return normalizeCategoryName(name)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

export async function getCategoryBySlug(
  slug: string,
  options?: {
    requireVisiblePosts?: boolean;
  },
) {
  const requireVisiblePosts = options?.requireVisiblePosts ?? true;
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: {
        select: {
          posts: {
            where: {
              isDeleted: false,
              isHidden: false,
            },
          },
        },
      },
    },
  });

  const noticeCategory = normalizeNoticeCategory(category?.name);

  if (noticeCategory !== null) {
    return null;
  }

  if (category?.name === INTERNAL_UNCATEGORIZED_CATEGORY_NAME) {
    return null;
  }

  return category && (!requireVisiblePosts || category._count.posts > 0)
    ? {
        id: Number(category.id),
        name: category.name,
        slug: category.slug,
      }
    : null;
}

export async function ensureCategoryByName(name: string) {
  const normalizedName = normalizeCategoryName(name);
  const slug = slugifyCategoryName(normalizedName);

  if (!normalizedName || !slug) {
    throw new Error("Invalid category name");
  }

  const category = await prisma.category.upsert({
    where: { slug },
    update: {
      name: normalizedName,
    },
    create: {
      name: normalizedName,
      slug,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  return {
    id: Number(category.id),
    name: category.name,
    slug: category.slug,
  };
}

export async function deleteUnusedCategories() {
  return prisma.$executeRaw`
    DO $$
    BEGIN
      IF to_regclass('horok_log.post_categories') IS NOT NULL THEN
        DELETE FROM horok_log.categories AS category
        WHERE NOT EXISTS (
          SELECT 1
          FROM horok_log.posts AS post
          WHERE post.category_id = category.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM horok_log.post_categories AS post_category
          WHERE post_category.category_id = category.id
        );
      ELSE
        DELETE FROM horok_log.categories AS category
        WHERE NOT EXISTS (
          SELECT 1
          FROM horok_log.posts AS post
          WHERE post.category_id = category.id
        );
      END IF;
    END $$;
  `;
}

export async function getPostsByCategory(params: {
  categoryId: number;
  page: number;
  limit: number;
}) {
  const { categoryId, page, limit } = params;
  const offset = (page - 1) * limit;
  const where = {
    categoryId: BigInt(categoryId),
    isDeleted: false,
    isHidden: false,
    category: {
      is: {
        name: {
          notIn: ["공지", "FAQ", "QnA", "중요", "긴급"],
        },
      },
    },
  };

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      omit: {
        isResolved: true,
      },
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      include: {
        user: {
          select: { email: true, name: true },
        },
        _count: {
          select: { likes: true },
        },
      },
    }),
    prisma.post.count({ where }),
  ]);

  return {
    posts: posts.map((post) => ({
      id: Number(post.id),
      title: post.title,
      created_at: post.createdAt.toISOString(),
      author: post.user.name ?? post.user.email,
      likeCount: post._count.likes,
    })),
    total,
  };
}
