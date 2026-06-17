import { Prisma } from "@prisma/client";
import {
  POST_REACTION_EMOJIS,
  type PostReactionEmoji,
  type PostReactionSummary,
} from "@/lib/post-reaction-options";
import { prisma } from "@/lib/prisma";

type ReactionCountRow = {
  emoji: PostReactionEmoji;
  count: bigint;
  firstCreatedAt: Date;
};

type UserReactionRow = {
  emoji: PostReactionEmoji;
};

type PostIdRow = {
  postId: bigint;
};

type ReactionTotalRow = {
  postId: bigint;
  count: bigint;
};

let hasEnsuredReactionTable = false;

async function ensurePostReactionTable() {
  if (hasEnsuredReactionTable) {
    return;
  }

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS horok_log.post_emoji_reactions (
      post_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      emoji VARCHAR(16) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (post_id, user_id, emoji)
    )
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_post_emoji_reactions_post
    ON horok_log.post_emoji_reactions (post_id)
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_post_emoji_reactions_user
    ON horok_log.post_emoji_reactions (user_id)
  `;

  hasEnsuredReactionTable = true;
}

export async function getPostReactionSummary(
  postId: number,
  userId?: number | null,
): Promise<PostReactionSummary[]> {
  await ensurePostReactionTable();

  const [countRows, userRows] = await Promise.all([
    prisma.$queryRaw<ReactionCountRow[]>`
      SELECT emoji, COUNT(*)::bigint AS count, MIN(created_at) AS "firstCreatedAt"
      FROM horok_log.post_emoji_reactions
      WHERE post_id = ${BigInt(postId)}
      GROUP BY emoji
      ORDER BY MIN(created_at) ASC
    `,
    userId
      ? prisma.$queryRaw<UserReactionRow[]>`
          SELECT emoji
          FROM horok_log.post_emoji_reactions
          WHERE post_id = ${BigInt(postId)}
            AND user_id = ${BigInt(userId)}
        `
      : Promise.resolve([]),
  ]);

  const reactedEmojiSet = new Set(userRows.map((row) => row.emoji));

  return countRows
    .filter((row) => POST_REACTION_EMOJIS.includes(row.emoji))
    .map((row) => ({
      emoji: row.emoji,
      count: Number(row.count),
      reacted: reactedEmojiSet.has(row.emoji),
    }));
}

export async function getAdminReactedPostIdSet(postIds: bigint[]) {
  await ensurePostReactionTable();

  if (postIds.length === 0) {
    return new Set<number>();
  }

  const rows = await prisma.$queryRaw<PostIdRow[]>`
    SELECT DISTINCT per.post_id AS "postId"
    FROM horok_log.post_emoji_reactions per
    JOIN public.users u ON u.id = per.user_id
    WHERE per.post_id IN (${Prisma.join(postIds)})
      AND u.role = 'ADMIN'
  `;

  return new Set(rows.map((row) => Number(row.postId)));
}

export const getAdminEyeReactedPostIdSet = getAdminReactedPostIdSet;

export async function getPostReactionCountsByPostId(
  postIds: Array<bigint | number>,
) {
  await ensurePostReactionTable();

  if (postIds.length === 0) {
    return new Map<number, number>();
  }

  const normalizedPostIds = postIds.map((postId) => BigInt(postId));
  const rows = await prisma.$queryRaw<ReactionTotalRow[]>`
    SELECT post_id AS "postId", COUNT(*)::bigint AS count
    FROM horok_log.post_emoji_reactions
    WHERE post_id IN (${Prisma.join(normalizedPostIds)})
    GROUP BY post_id
  `;

  return new Map(rows.map((row) => [Number(row.postId), Number(row.count)]));
}

export async function togglePostReaction(params: {
  postId: number;
  userId: number;
  emoji: PostReactionEmoji;
}) {
  await ensurePostReactionTable();

  const { postId, userId, emoji } = params;
  const existingRows = await prisma.$queryRaw<Array<{ emoji: string }>>`
    SELECT emoji
    FROM horok_log.post_emoji_reactions
    WHERE post_id = ${BigInt(postId)}
      AND user_id = ${BigInt(userId)}
      AND emoji = ${emoji}
    LIMIT 1
  `;

  if (existingRows.length > 0) {
    await prisma.$executeRaw`
      DELETE FROM horok_log.post_emoji_reactions
      WHERE post_id = ${BigInt(postId)}
        AND user_id = ${BigInt(userId)}
    `;

    return { reacted: false };
  }

  await prisma.$transaction([
    prisma.$executeRaw`
      DELETE FROM horok_log.post_emoji_reactions
      WHERE post_id = ${BigInt(postId)}
        AND user_id = ${BigInt(userId)}
    `,
    prisma.$executeRaw`
      INSERT INTO horok_log.post_emoji_reactions (post_id, user_id, emoji)
      VALUES (${BigInt(postId)}, ${BigInt(userId)}, ${emoji})
      ON CONFLICT (post_id, user_id, emoji) DO NOTHING
    `,
  ]);

  return { reacted: true };
}
