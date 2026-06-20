import type { PostThumbnailCrop } from "@/lib/post-thumbnail-crop";

export type PostDraftPayload = {
  id?: string;
  title: string;
  content: string;
  tags: string[];
  selectedFixedTag: string;
  selectedInquiryTag?: string;
  thumbnailUrl?: string | null;
  thumbnailCrop?: PostThumbnailCrop | null;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileSize?: number | null;
  }>;
  isBanner: boolean;
  isSecret: boolean;
  savedAt: string;
};

export function getPostDraftStorageKey(params: {
  successPathPrefix: string;
  fixedTagOptions: string[];
  categoryLocked: boolean;
}) {
  const { successPathPrefix, fixedTagOptions, categoryLocked } = params;

  return `post-editor-draft:${successPathPrefix}:${fixedTagOptions.join(",")}:${categoryLocked ? "locked" : "free"}`;
}

export function getLogPostDraftStorageKey() {
  return getPostDraftStorageKey({
    successPathPrefix: "/horok-log/feeds/posts",
    fixedTagOptions: [],
    categoryLocked: false,
  });
}

function getPostDraftListStorageKey(storageKey: string) {
  return `${storageKey}:list`;
}

function normalizeDraft(draft: PostDraftPayload): PostDraftPayload {
  return {
    ...draft,
    id:
      draft.id ??
      `draft-${Date.parse(draft.savedAt) || Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
  };
}

export function loadPostDrafts(storageKey: string) {
  if (typeof window === "undefined") {
    return [];
  }

  const listStorageKey = getPostDraftListStorageKey(storageKey);
  const rawListValue = window.localStorage.getItem(listStorageKey);
  const rawLegacyValue = window.localStorage.getItem(storageKey);
  const drafts: PostDraftPayload[] = [];

  if (rawListValue) {
    try {
      const parsedValue = JSON.parse(rawListValue);
      if (Array.isArray(parsedValue)) {
        drafts.push(
          ...parsedValue
            .filter((draft): draft is PostDraftPayload => Boolean(draft))
            .map(normalizeDraft),
        );
      }
    } catch {
      window.localStorage.removeItem(listStorageKey);
    }
  }

  if (rawLegacyValue) {
    try {
      const legacyDraft = normalizeDraft(
        JSON.parse(rawLegacyValue) as PostDraftPayload,
      );
      if (!drafts.some((draft) => draft.id === legacyDraft.id)) {
        drafts.push(legacyDraft);
      }
      window.localStorage.removeItem(storageKey);
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }

  const sortedDrafts = drafts.sort(
    (a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt),
  );

  window.localStorage.setItem(listStorageKey, JSON.stringify(sortedDrafts));

  return sortedDrafts;
}

export function loadPostDraft(storageKey: string, draftId?: string | null) {
  const drafts = loadPostDrafts(storageKey);

  if (draftId) {
    return drafts.find((draft) => draft.id === draftId) ?? null;
  }

  return drafts[0] ?? null;
}

export function hasPostDraft(storageKey: string) {
  return loadPostDrafts(storageKey).length > 0;
}

export function countPostDrafts(storageKey: string) {
  return loadPostDrafts(storageKey).length;
}

export function savePostDraft(storageKey: string, payload: PostDraftPayload) {
  if (typeof window === "undefined") {
    return null;
  }

  const nextDraft = normalizeDraft(payload);
  const drafts = loadPostDrafts(storageKey);
  const nextDrafts = [
    nextDraft,
    ...drafts.filter((draft) => draft.id !== nextDraft.id),
  ].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));

  window.localStorage.setItem(
    getPostDraftListStorageKey(storageKey),
    JSON.stringify(nextDrafts),
  );

  return nextDraft;
}

export function clearPostDraft(storageKey: string, draftId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!draftId) {
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(getPostDraftListStorageKey(storageKey));
    return;
  }

  const nextDrafts = loadPostDrafts(storageKey).filter(
    (draft) => draft.id !== draftId,
  );

  window.localStorage.setItem(
    getPostDraftListStorageKey(storageKey),
    JSON.stringify(nextDrafts),
  );
}

function getPostDraftApiUrl(storageKey: string, draftId?: string | null) {
  const params = new URLSearchParams({ storageKey });

  if (draftId) {
    params.set("draftId", draftId);
  }

  return `/api/post-drafts?${params.toString()}`;
}

async function loadRemotePostDrafts(storageKey: string) {
  const response = await fetch(getPostDraftApiUrl(storageKey), {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  return Array.isArray(payload?.drafts)
    ? (payload.drafts as PostDraftPayload[]).map(normalizeDraft)
    : [];
}

function mergeDrafts(
  remoteDrafts: PostDraftPayload[],
  localDrafts: PostDraftPayload[],
) {
  return [
    ...remoteDrafts,
    ...localDrafts.filter(
      (localDraft) =>
        !remoteDrafts.some((remoteDraft) => remoteDraft.id === localDraft.id),
    ),
  ].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
}

const syncedDraftsCache = new Map<string, PostDraftPayload[]>();
const syncedDraftsRequests = new Map<string, Promise<PostDraftPayload[]>>();

export function invalidateSyncedPostDraftsCache(storageKey?: string) {
  if (storageKey) {
    syncedDraftsCache.delete(storageKey);
    syncedDraftsRequests.delete(storageKey);
    return;
  }

  syncedDraftsCache.clear();
  syncedDraftsRequests.clear();
}

function setPostDraftsCache(
  storageKey: string,
  drafts: PostDraftPayload[],
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getPostDraftListStorageKey(storageKey),
    JSON.stringify(drafts),
  );
}

export async function loadSyncedPostDrafts(
  storageKey: string,
  options?: { force?: boolean },
) {
  if (!options?.force) {
    const cachedDrafts = syncedDraftsCache.get(storageKey);

    if (cachedDrafts) {
      return cachedDrafts;
    }

    const inFlightRequest = syncedDraftsRequests.get(storageKey);

    if (inFlightRequest) {
      return inFlightRequest;
    }
  }

  const request = (async () => {
    const localDrafts = loadPostDrafts(storageKey);
    const remoteDrafts = await loadRemotePostDrafts(storageKey).catch(() => null);

    if (remoteDrafts === null) {
      syncedDraftsCache.set(storageKey, localDrafts);
      return localDrafts;
    }

    const merged = mergeDrafts(remoteDrafts, localDrafts);
    setPostDraftsCache(storageKey, merged);
    syncedDraftsCache.set(storageKey, merged);

    return merged;
  })();

  syncedDraftsRequests.set(storageKey, request);

  try {
    return await request;
  } finally {
    syncedDraftsRequests.delete(storageKey);
  }
}

export async function loadSyncedPostDraft(
  storageKey: string,
  draftId: string,
) {
  const cachedDrafts = syncedDraftsCache.get(storageKey);
  const cachedDraft = cachedDrafts?.find((draft) => draft.id === draftId);

  if (cachedDraft) {
    return cachedDraft;
  }

  const localDraft = loadPostDraft(storageKey, draftId);

  if (localDraft && syncedDraftsCache.has(storageKey)) {
    return localDraft;
  }

  const drafts = await loadSyncedPostDrafts(storageKey);

  return drafts.find((draft) => draft.id === draftId) ?? localDraft;
}

async function saveRemotePostDraft(
  storageKey: string,
  draft: PostDraftPayload,
) {
  const response = await fetch(getPostDraftApiUrl(storageKey), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ draft }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  return payload?.draft ? normalizeDraft(payload.draft) : null;
}

export async function saveSyncedPostDraft(
  storageKey: string,
  payload: PostDraftPayload,
) {
  const localDraft = savePostDraft(storageKey, payload);

  if (!localDraft) {
    return null;
  }

  const remoteDraft = await saveRemotePostDraft(storageKey, localDraft).catch(
    () => null,
  );

  if (!remoteDraft) {
    invalidateSyncedPostDraftsCache(storageKey);
    return localDraft;
  }

  clearPostDraft(storageKey, localDraft.id);
  invalidateSyncedPostDraftsCache(storageKey);

  return remoteDraft;
}

export async function clearSyncedPostDraft(
  storageKey: string,
  draftId?: string | null,
) {
  clearPostDraft(storageKey, draftId);
  invalidateSyncedPostDraftsCache(storageKey);

  await fetch(getPostDraftApiUrl(storageKey, draftId), {
    method: "DELETE",
  }).catch(() => null);
}

export async function countSyncedPostDrafts(storageKey: string) {
  return (await loadSyncedPostDrafts(storageKey)).length;
}
