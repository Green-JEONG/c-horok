import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { PostDraftPayload } from "@/lib/post-drafts";
import { prisma } from "@/lib/prisma";

type PostDraftRow = {
  id: string;
  payload: Prisma.JsonValue;
  savedAt: Date;
};

let hasEnsuredPostDraftTable = false;

async function ensurePostDraftTable() {
  if (hasEnsuredPostDraftTable) {
    return;
  }

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS horok_log.post_drafts (
      id VARCHAR(120) PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      storage_key VARCHAR(255) NOT NULL,
      payload JSONB NOT NULL,
      saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_post_drafts_user_storage_saved
    ON horok_log.post_drafts (user_id, storage_key, saved_at DESC)
  `;

  hasEnsuredPostDraftTable = true;
}

function normalizeServerDraft(
  draft: PostDraftPayload,
  fallbackId?: string | null,
): PostDraftPayload {
  const savedAt = draft.savedAt || new Date().toISOString();

  return {
    ...draft,
    id: fallbackId ?? draft.id ?? randomUUID(),
    tags: Array.isArray(draft.tags) ? draft.tags : [],
    selectedFixedTag: draft.selectedFixedTag ?? "",
    isBanner: Boolean(draft.isBanner),
    isSecret: Boolean(draft.isSecret),
    savedAt,
  };
}

export async function getPostDraftsByUser(params: {
  userId: number;
  storageKey: string;
}) {
  await ensurePostDraftTable();

  const rows = await prisma.$queryRaw<PostDraftRow[]>`
    SELECT id, payload, saved_at AS "savedAt"
    FROM horok_log.post_drafts
    WHERE user_id = ${BigInt(params.userId)}
      AND storage_key = ${params.storageKey}
    ORDER BY saved_at DESC, updated_at DESC
  `;

  return rows.map((row) =>
    normalizeServerDraft(row.payload as PostDraftPayload, row.id),
  );
}

export async function upsertPostDraftForUser(params: {
  userId: number;
  storageKey: string;
  draft: PostDraftPayload;
}) {
  await ensurePostDraftTable();

  const draft = normalizeServerDraft(params.draft);
  const savedAt = new Date(draft.savedAt);
  const safeSavedAt = Number.isNaN(savedAt.getTime()) ? new Date() : savedAt;

  await prisma.$executeRaw`
    INSERT INTO horok_log.post_drafts (
      id,
      user_id,
      storage_key,
      payload,
      saved_at,
      updated_at
    )
    VALUES (
      ${draft.id},
      ${BigInt(params.userId)},
      ${params.storageKey},
      ${draft as unknown as Prisma.InputJsonValue}::jsonb,
      ${safeSavedAt},
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      payload = EXCLUDED.payload,
      saved_at = EXCLUDED.saved_at,
      updated_at = NOW()
    WHERE horok_log.post_drafts.user_id = EXCLUDED.user_id
      AND horok_log.post_drafts.storage_key = EXCLUDED.storage_key
  `;

  return draft;
}

export async function deletePostDraftsForUser(params: {
  userId: number;
  storageKey: string;
  draftId?: string | null;
}) {
  await ensurePostDraftTable();

  if (params.draftId) {
    await prisma.$executeRaw`
      DELETE FROM horok_log.post_drafts
      WHERE user_id = ${BigInt(params.userId)}
        AND storage_key = ${params.storageKey}
        AND id = ${params.draftId}
    `;
    return;
  }

  await prisma.$executeRaw`
    DELETE FROM horok_log.post_drafts
    WHERE user_id = ${BigInt(params.userId)}
      AND storage_key = ${params.storageKey}
  `;
}
