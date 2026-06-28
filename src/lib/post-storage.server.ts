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
const MARKDOWN_LINK_DESTINATION_PATTERN =
  /!?\[[^\]]*]\(\s*<?([^)\s<>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g;

function shouldIgnoreSignedUrlError(message: string) {
  return (
    message === "Object not found" ||
    message === "Invalid key" ||
    message.toLowerCase().includes("timed out")
  );
}

function warnPostStorageUnavailable(params: {
  path?: string | null;
  paths?: string[];
  error: string;
}) {
  console.warn("Post storage object unavailable", {
    ...params,
    bucket: POST_THUMBNAIL_BUCKET,
  });
}

export async function createPostStorageSignedUrl(path?: string | null) {
  const normalizedPath = normalizePostStorageReference(path);

  if (!normalizedPath || !isPostStoragePath(normalizedPath)) {
    return path ?? null;
  }

  const cached = signedUrlCache.get(normalizedPath);
  if (cached) {
    return cached;
  }

  const signedUrlMap = await createPostStorageSignedUrls([normalizedPath]);

  return signedUrlMap.get(normalizedPath) ?? null;
}

async function createPostStorageSignedUrls(paths: string[]) {
  const normalizedPaths = Array.from(
    new Set(
      paths
        .map((path) => normalizePostStorageReference(path))
        .filter(
          (path): path is string => Boolean(path) && isPostStoragePath(path),
        ),
    ),
  );
  const signedUrlMap = new Map<string, string>();
  const uncachedPaths: string[] = [];

  for (const path of normalizedPaths) {
    const cached = signedUrlCache.get(path);

    if (cached) {
      signedUrlMap.set(path, cached);
      continue;
    }

    uncachedPaths.push(path);
  }

  if (uncachedPaths.length === 0) {
    return signedUrlMap;
  }

  const { data, error } = await getSupabaseAdmin()
    .storage.from(POST_THUMBNAIL_BUCKET)
    .createSignedUrls(
      uncachedPaths,
      POST_STORAGE_SIGNED_URL_EXPIRES_IN_SECONDS,
    );

  if (error) {
    if (!shouldIgnoreSignedUrlError(error.message)) {
      throw new Error(error.message);
    }

    warnPostStorageUnavailable({
      paths: uncachedPaths,
      error: error.message,
    });

    return signedUrlMap;
  }

  for (let index = 0; index < data.length; index += 1) {
    const entry = data[index] as {
      path?: string;
      signedUrl?: string | null;
      signedURL?: string | null;
      error?: string | null;
    };
    const path = entry.path ?? uncachedPaths[index];
    const signedUrl = entry.signedUrl ?? entry.signedURL ?? null;

    if (signedUrl) {
      signedUrlCache.set(path, signedUrl);
      signedUrlMap.set(path, signedUrl);
      continue;
    }

    if (entry.error) {
      warnPostStorageUnavailable({
        path,
        error: entry.error,
      });
    }
  }

  return signedUrlMap;
}

export async function signPostStorageMarkdown(content: string) {
  const normalizedContent = normalizePostStorageMarkdown(content);
  const uniquePaths = Array.from(
    new Set(
      Array.from(normalizedContent.matchAll(MARKDOWN_LINK_DESTINATION_PATTERN))
        .map((match) => match[1])
        .filter((path): path is string => Boolean(path))
        .map((path) => normalizePostStorageReference(path))
        .filter(
          (path): path is string => Boolean(path) && isPostStoragePath(path),
        ),
    ),
  );
  const signedUrlMap = await createPostStorageSignedUrls(uniquePaths);

  return normalizedContent.replace(
    MARKDOWN_LINK_DESTINATION_PATTERN,
    (markdown, destination: string) => {
      const normalizedDestination = normalizePostStorageReference(destination);

      if (!normalizedDestination || !isPostStoragePath(normalizedDestination)) {
        return markdown;
      }

      const signedUrl = signedUrlMap.get(normalizedDestination);

      return signedUrl ? markdown.replace(destination, signedUrl) : markdown;
    },
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
