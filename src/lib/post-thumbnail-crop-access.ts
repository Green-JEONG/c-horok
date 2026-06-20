import "server-only";

import { Prisma } from "@prisma/client";
import {
  parsePostThumbnailCrop,
  type PostThumbnailCrop,
} from "@/lib/post-thumbnail-crop";
import { prisma } from "@/lib/prisma";

let hasEnsuredPostThumbnailCropColumn = false;

export async function ensurePostThumbnailCropColumn() {
  if (hasEnsuredPostThumbnailCropColumn) {
    return;
  }

  await prisma.$executeRaw`
    ALTER TABLE horok_log.posts
    ADD COLUMN IF NOT EXISTS thumbnail_crop JSONB
  `;

  hasEnsuredPostThumbnailCropColumn = true;
}

export async function setPostThumbnailCrop(
  postId: number | bigint,
  crop: PostThumbnailCrop | null,
) {
  await ensurePostThumbnailCropColumn();
  const id = BigInt(postId);

  if (!crop) {
    await prisma.$executeRaw`
      UPDATE horok_log.posts
      SET thumbnail_crop = NULL
      WHERE id = ${id}
    `;
    return;
  }

  const payload = JSON.stringify(crop);

  await prisma.$executeRaw`
    UPDATE horok_log.posts
    SET thumbnail_crop = ${payload}::jsonb
    WHERE id = ${id}
  `;
}

export async function getPostThumbnailCropsByPostIds(postIds: bigint[]) {
  await ensurePostThumbnailCropColumn();

  if (postIds.length === 0) {
    return new Map<string, PostThumbnailCrop | null>();
  }

  const rows = await prisma.$queryRaw<
    Array<{ id: bigint; thumbnail_crop: unknown }>
  >`
    SELECT id, thumbnail_crop
    FROM horok_log.posts
    WHERE id IN (${Prisma.join(postIds)})
  `;

  return new Map(
    rows.map((row) => [
      row.id.toString(),
      parsePostThumbnailCrop(row.thumbnail_crop),
    ]),
  );
}

export async function getPostThumbnailCrop(postId: number | bigint) {
  const cropMap = await getPostThumbnailCropsByPostIds([BigInt(postId)]);

  return cropMap.get(BigInt(postId).toString()) ?? null;
}
