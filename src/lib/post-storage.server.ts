import "server-only";

import {
  isPostStoragePath,
  normalizePostStorageMarkdown,
  normalizePostStorageReference,
  POST_STORAGE_SIGNED_URL_EXPIRES_IN_SECONDS,
} from "@/lib/post-storage";
import { POST_THUMBNAIL_BUCKET } from "@/lib/post-thumbnails";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export {
  isPostStoragePath,
  normalizePostStorageMarkdown,
  normalizePostStorageReference,
};

const signedUrlCache = new Map<string, string>();

export async function createPostStorageSignedUrl(path?: string | null) {
  const normalizedPath = normalizePostStorageReference(path);

  if (!normalizedPath || !isPostStoragePath(normalizedPath)) {
    return path ?? null;
  }

  const cached = signedUrlCache.get(normalizedPath);
  if (cached) {
    return cached;
  }

  const { data, error } = await getSupabaseAdmin()
    .storage.from(POST_THUMBNAIL_BUCKET)
    .createSignedUrl(
      normalizedPath,
      POST_STORAGE_SIGNED_URL_EXPIRES_IN_SECONDS,
    );

  if (error) {
    if (error.message !== "Object not found") {
      throw new Error(error.message);
    }

    console.warn("Post storage object not found", {
      path: normalizedPath,
      bucket: POST_THUMBNAIL_BUCKET,
      error: error.message,
    });

    return null;
  }

  signedUrlCache.set(normalizedPath, data.signedUrl);

  return data.signedUrl;
}

export async function signPostStorageMarkdown(content: string) {
  const normalizedContent = normalizePostStorageMarkdown(content);
  const matches = Array.from(
    normalizedContent.matchAll(
      /(?:(?:users|thumbnails|contents|attachments)\/[^\s)"']+)|(?:(?:thumbnails\/)?public\/(?:thumbnails|content|contents|attachments|chat|users)\/[^\s)"']+)/g,
    ),
  );
  const uniquePaths = Array.from(new Set(matches.map((match) => match[0])));
  const signedUrlPairs = await Promise.all(
    uniquePaths.map(
      async (path): Promise<[string, string]> => [
        path,
        (await createPostStorageSignedUrl(path)) ?? path,
      ],
    ),
  );
  const signedUrlMap = new Map(signedUrlPairs);

  return normalizedContent.replace(
    /(?:(?:users|thumbnails|contents|attachments)\/[^\s)"']+)|(?:(?:thumbnails\/)?public\/(?:thumbnails|content|contents|attachments|chat|users)\/[^\s)"']+)/g,
    (path) => signedUrlMap.get(path) ?? path,
  );
}

export async function uploadPostStorageFile(params: {
  path: string;
  file: File;
}) {
  const { path, file } = params;
  const { error } = await getSupabaseAdmin()
    .storage.from(POST_THUMBNAIL_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    storagePath: path,
    signedUrl: await createPostStorageSignedUrl(path),
  };
}

export async function removePostStorageFiles(paths: string[]) {
  const normalizedPaths = paths
    .map((path) => normalizePostStorageReference(path))
    .filter((path): path is string => Boolean(path) && isPostStoragePath(path));

  if (normalizedPaths.length === 0) {
    return;
  }

  const { error } = await getSupabaseAdmin()
    .storage.from(POST_THUMBNAIL_BUCKET)
    .remove(normalizedPaths);

  if (error) {
    throw new Error(error.message);
  }
}
