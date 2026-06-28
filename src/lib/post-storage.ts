import { POST_THUMBNAIL_BUCKET } from "@/lib/post-thumbnails";

export const POST_STORAGE_SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;
const LEGACY_POST_STORAGE_BUCKETS = ["post-thumbnails"];

const STORAGE_PATH_PREFIXES = [
  "users/",
  "thumbnails/",
  "contents/",
  "attachments/",
  "public/thumbnails/",
  "public/content/",
  "public/attachments/",
  "public/chat/",
];
const STORAGE_PLACEHOLDER_SEGMENT_PATTERN = /(^|\/)\.\.\.(?:$|[^\w.-])/;
const STORAGE_PATH_MATCH_PATTERN =
  /((?:https?:\/\/[^\s)"'`<>]+\/storage\/v1\/object\/(?:public|sign)\/[^\s)"'`<>]+)|(?:(?:users|thumbnails|contents|attachments)\/[^\s)"'`<>,;:]+)|(?:(?:thumbnails\/)?public\/(?:thumbnails|content|contents|attachments|chat|users)\/[^\s)"'`<>,;:]+))/g;

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

function normalizeLegacyPostStoragePath(path: string) {
  if (path.startsWith("thumbnails/public/thumbnails/")) {
    return path.replace("thumbnails/public/thumbnails/", "thumbnails/");
  }

  if (path.startsWith("thumbnails/public/content/")) {
    return path.replace("thumbnails/public/content/", "contents/");
  }

  if (path.startsWith("thumbnails/public/contents/")) {
    return path.replace("thumbnails/public/contents/", "contents/");
  }

  if (path.startsWith("public/thumbnails/")) {
    return path.replace("public/thumbnails/", "thumbnails/");
  }

  if (path.startsWith("public/content/")) {
    return path.replace("public/content/", "contents/");
  }

  if (path.startsWith("public/contents/")) {
    return path.replace("public/contents/", "contents/");
  }

  if (path.startsWith("public/attachments/")) {
    return path.replace("public/attachments/", "attachments/");
  }

  if (path.startsWith("public/chat/")) {
    return path.replace("public/chat/", "contents/chat/");
  }

  if (path.startsWith("public/users/")) {
    return path.replace("public/users/", "users/");
  }

  return path;
}

function isPostStoragePlaceholderPath(path: string) {
  return (
    STORAGE_PLACEHOLDER_SEGMENT_PATTERN.test(path) ||
    path.includes("`") ||
    path.includes("<") ||
    path.includes(">")
  );
}

export function isPostStoragePath(value?: string | null) {
  const trimmed = value?.trim() ?? "";
  const normalizedPath = normalizeLegacyPostStoragePath(trimmed);

  return (
    STORAGE_PATH_PREFIXES.some((prefix) => trimmed.startsWith(prefix)) &&
    !isPostStoragePlaceholderPath(normalizedPath)
  );
}

export function getPostStoragePathFromUrl(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (isPostStoragePath(trimmed)) {
    return normalizeLegacyPostStoragePath(trimmed);
  }

  try {
    const url = new URL(trimmed);
    const supabaseUrl = getSupabaseUrl();

    if (supabaseUrl && url.origin !== new URL(supabaseUrl).origin) {
      return null;
    }

    const bucketNames = [POST_THUMBNAIL_BUCKET, ...LEGACY_POST_STORAGE_BUCKETS];
    const markers = bucketNames.flatMap((bucketName) => [
      `/storage/v1/object/public/${bucketName}/`,
      `/storage/v1/object/sign/${bucketName}/`,
    ]);
    const marker =
      markers.find((candidate) => url.pathname.includes(candidate)) ?? null;

    if (!marker) {
      return null;
    }

    const markerIndex = url.pathname.indexOf(marker);

    return normalizeLegacyPostStoragePath(
      decodeURIComponent(url.pathname.slice(markerIndex + marker.length)),
    );
  } catch {
    return null;
  }
}

export function normalizePostStorageReference(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  return getPostStoragePathFromUrl(trimmed) ?? trimmed;
}

export function normalizePostStorageMarkdown(content: string) {
  return content.replace(
    STORAGE_PATH_MATCH_PATTERN,
    (match) => getPostStoragePathFromUrl(match) ?? match,
  );
}
