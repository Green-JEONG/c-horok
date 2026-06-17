import { Prisma } from "@prisma/client";
import {
  POST_REACTION_EMOJIS,
  type PostReactionEmoji,
  type PostReactionSummary,
} from "@/lib/post-reaction-options";
import { prisma } from "@/lib/prisma";

type ReactionCountRow = {
  commentId?: bigint;
  comment_id?: bigint;
  emoji: PostReactionEmoji;
  count: bigint;
  firstCreatedAt: Date;
};

type UserReactionRow = {
  commentId?: bigint;
  comment_id?: bigint;
  emoji: PostReactionEmoji;
};

let hasEnsuredCommentReactionTable = false;

async function ensureCommentReactionTable() {
  if (hasEnsuredCommentReactionTable) {
    return;
  }

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS horok_log.comment_emoji_reactions (
      comment_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      emoji VARCHAR(16) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (comment_id, user_id, emoji)
    )
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_comment_emoji_reactions_comment
    ON horok_log.comment_emoji_reactions (comment_id)
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_comment_emoji_reactions_user
    ON horok_log.comment_emoji_reactions (user_id)
  `;

  hasEnsuredCommentReactionTable = true;
}

function normalizeCommentReactionRows(
  countRows: ReactionCountRow[],
  userRows: UserReactionRow[],
) {
  const userReactionKeySet = new Set(
    userRows.map(
      (row) => `${Number(row.commentId ?? row.comment_id)}:${row.emoji}`,
    ),
  );
  const reactionsByCommentId = new Map<number, PostReactionSummary[]>();

  for (const row of countRows) {
    if (!POST_REACTION_EMOJIS.includes(row.emoji)) {
      continue;
    }

    const commentId = Number(row.commentId ?? row.comment_id);
    const reactions = reactionsByCommentId.get(commentId) ?? [];

    reactions.push({
      emoji: row.emoji,
      count: Number(row.count),
      reacted: userReactionKeySet.has(`${commentId}:${row.emoji}`),
    });
    reactionsByCommentId.set(commentId, reactions);
  }

  return reactionsByCommentId;
}

export async function getCommentReactionSummary(
  commentId: number,
  userId?: number | null,
) {
  const summaries = await getCommentReactionSummariesByCommentId(
    [commentId],
    userId,
  );

  return summaries.get(commentId) ?? [];
}

export async function getCommentReactionSummariesByCommentId(
  commentIds: Array<bigint | number>,
  userId?: number | null,
) {
  await ensureCommentReactionTable();

  if (commentIds.length === 0) {
    return new Map<number, PostReactionSummary[]>();
  }

  const normalizedCommentIds = commentIds.map((commentId) => BigInt(commentId));
  const [countRows, userRows] = await Promise.all([
    prisma.$queryRaw<ReactionCountRow[]>`
      SELECT
        comment_id AS "commentId",
        emoji,
        COUNT(*)::bigint AS count,
        MIN(created_at) AS "firstCreatedAt"
      FROM horok_log.comment_emoji_reactions
      WHERE comment_id IN (${Prisma.join(normalizedCommentIds)})
      GROUP BY comment_id, emoji
      ORDER BY MIN(created_at) ASC
    `,
    userId
      ? prisma.$queryRaw<UserReactionRow[]>`
          SELECT comment_id AS "commentId", emoji
          FROM horok_log.comment_emoji_reactions
          WHERE comment_id IN (${Prisma.join(normalizedCommentIds)})
            AND user_id = ${BigInt(userId)}
        `
      : Promise.resolve([]),
  ]);

  return normalizeCommentReactionRows(countRows, userRows);
}

export async function toggleCommentReaction(params: {
  commentId: number;
  userId: number;
  emoji: PostReactionEmoji;
}) {
  await ensureCommentReactionTable();

  const { commentId, userId, emoji } = params;
  const existingRows = await prisma.$queryRaw<Array<{ emoji: string }>>`
    SELECT emoji
    FROM horok_log.comment_emoji_reactions
    WHERE comment_id = ${BigInt(commentId)}
      AND user_id = ${BigInt(userId)}
      AND emoji = ${emoji}
    LIMIT 1
  `;

  if (existingRows.length > 0) {
    await prisma.$executeRaw`
      DELETE FROM horok_log.comment_emoji_reactions
      WHERE comment_id = ${BigInt(commentId)}
        AND user_id = ${BigInt(userId)}
        AND emoji = ${emoji}
    `;

    return { reacted: false };
  }

  await prisma.$executeRaw`
    INSERT INTO horok_log.comment_emoji_reactions (comment_id, user_id, emoji)
    VALUES (${BigInt(commentId)}, ${BigInt(userId)}, ${emoji})
    ON CONFLICT (comment_id, user_id, emoji) DO NOTHING
  `;

  return { reacted: true };
}
