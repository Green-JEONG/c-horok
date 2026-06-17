import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

let hasEnsuredPostCategoryTable = false;

export function normalizeCategoryNames(categoryNames?: string[]) {
  const seen = new Set<string>();

  return (categoryNames ?? [])
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLocaleLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export async function ensurePostCategoryTable() {
  if (hasEnsuredPostCategoryTable) {
    return;
  }

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS horok_log.post_categories (
      post_id BIGINT NOT NULL REFERENCES horok_log.posts(id) ON DELETE CASCADE,
      category_id BIGINT NOT NULL REFERENCES horok_log.categories(id) ON DELETE RESTRICT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, category_id)
    )
  `;
  await prisma.$executeRaw`
    ALTER TABLE horok_log.post_categories
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_post_categories_category_id
    ON horok_log.post_categories (category_id)
  `;
  await prisma.$executeRaw`
    INSERT INTO horok_log.post_categories (post_id, category_id)
    SELECT id, category_id
    FROM horok_log.posts
    WHERE category_id IS NOT NULL
    ON CONFLICT (post_id, category_id) DO NOTHING
  `;

  hasEnsuredPostCategoryTable = true;
}

export async function syncPostCategories(
  postId: bigint,
  categoryIds: number[],
) {
  await ensurePostCategoryTable();

  const seenCategoryIds = new Set<number>();
  const orderedCategoryIds = categoryIds.filter((categoryId) => {
    if (seenCategoryIds.has(categoryId)) {
      return false;
    }

    seenCategoryIds.add(categoryId);
    return true;
  });

  await prisma.$executeRaw`
    DELETE FROM horok_log.post_categories
    WHERE post_id = ${postId}
  `;

  if (orderedCategoryIds.length === 0) {
    return;
  }

  const values = orderedCategoryIds.map(
    (categoryId, index) =>
      Prisma.sql`(${postId}, ${BigInt(categoryId)}, ${index})`,
  );

  await prisma.$executeRaw`
    INSERT INTO horok_log.post_categories (post_id, category_id, sort_order)
    VALUES ${Prisma.join(values)}
    ON CONFLICT (post_id, category_id) DO UPDATE SET
      sort_order = EXCLUDED.sort_order
  `;
}

export async function getPostCategoryNameMap(postIds: bigint[]) {
  if (postIds.length === 0) {
    return new Map<string, string[]>();
  }

  await ensurePostCategoryTable();

  const rows = await prisma.$queryRaw<
    Array<{ postId: bigint; categoryName: string }>
  >`
    SELECT
      post_category.post_id AS "postId",
      category.name AS "categoryName"
    FROM horok_log.post_categories AS post_category
    INNER JOIN horok_log.categories AS category
      ON category.id = post_category.category_id
    WHERE post_category.post_id IN (${Prisma.join(postIds)})
    ORDER BY post_category.post_id ASC, post_category.sort_order ASC, post_category.category_id ASC
  `;

  return rows.reduce((map, row) => {
    const postId = row.postId.toString();
    const categoryNames = map.get(postId) ?? [];
    categoryNames.push(row.categoryName);
    map.set(postId, categoryNames);
    return map;
  }, new Map<string, string[]>());
}
