import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { normalizeNoticeCategory } from "@/lib/notice-categories";
import { ensurePostCategoryTable } from "@/lib/post-categories";
import { prisma } from "@/lib/prisma";

function getCategorySortGroup(name: string) {
  const trimmedName = name.trim();

  if (/^[가-힣]/.test(trimmedName)) {
    return 0;
  }

  if (/^[A-Za-z]/.test(trimmedName)) {
    return 1;
  }

  return 2;
}

function compareEnglishNames(a: string, b: string) {
  const lowercaseDiff = a
    .toLocaleLowerCase("en")
    .localeCompare(b.toLocaleLowerCase("en"), "en", {
      sensitivity: "base",
    });

  if (lowercaseDiff !== 0) {
    return lowercaseDiff;
  }

  return a.localeCompare(b, "en", {
    caseFirst: "lower",
    sensitivity: "case",
  });
}

function sortCategoriesByName(a: { name: string }, b: { name: string }) {
  const aGroup = getCategorySortGroup(a.name);
  const bGroup = getCategorySortGroup(b.name);
  const groupDiff = aGroup - bGroup;

  if (groupDiff !== 0) {
    return groupDiff;
  }

  if (aGroup === 0) {
    return a.name.localeCompare(b.name, "ko", {
      sensitivity: "base",
    });
  }

  if (aGroup === 1) {
    return compareEnglishNames(a.name, b.name);
  }

  return a.name.localeCompare(b.name, ["ko", "en"], {
    sensitivity: "base",
  });
}

function isVisibleRecommendedCategory(name: string) {
  const noticeCategory = normalizeNoticeCategory(name);

  return name !== "미분류" && noticeCategory === null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("userId") ?? "");
  const normalizedUserId =
    Number.isFinite(userId) && userId > 0 ? BigInt(userId) : null;
  const session = await auth();
  const viewerUserId =
    typeof session?.user?.id === "string" ? Number(session.user.id) : null;
  const canSeeHiddenPosts =
    Number.isFinite(userId) && userId > 0 && viewerUserId === userId;

  await ensurePostCategoryTable();

  const userFilter = normalizedUserId
    ? Prisma.sql`AND post.user_id = ${normalizedUserId}`
    : Prisma.empty;
  const hiddenFilter = canSeeHiddenPosts
    ? Prisma.empty
    : Prisma.sql`AND post.is_hidden = FALSE`;
  const rows = await prisma.$queryRaw<
    Array<{
      id: bigint;
      name: string;
      slug: string;
      postCount: bigint;
    }>
  >`
    SELECT
      category.id,
      category.name,
      category.slug,
      COUNT(DISTINCT post.id) AS "postCount"
    FROM horok_log.categories AS category
    INNER JOIN horok_log.post_categories AS post_category
      ON post_category.category_id = category.id
    INNER JOIN horok_log.posts AS post
      ON post.id = post_category.post_id
    WHERE post.is_deleted = FALSE
      ${hiddenFilter}
      ${userFilter}
    GROUP BY category.id, category.name, category.slug
  `;

  return NextResponse.json(
    rows
      .map((category) => ({
        id: Number(category.id),
        name: category.name,
        slug: category.slug,
        postCount: Number(category.postCount),
      }))
      .filter(
        (category) =>
          category.postCount > 0 && isVisibleRecommendedCategory(category.name),
      )
      .sort(sortCategoriesByName),
  );
}
