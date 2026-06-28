export const POST_THUMBNAIL_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "post";

export const POST_THUMBNAIL_ASPECT = 16 / 9;

export const POST_CARD_THUMBNAIL_SIZES =
  "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw";

const DEFAULT_THUMBNAIL_URLS = new Set(["/logo.png", "/thumbnails.png"]);

export function isDefaultPostThumbnailUrl(thumbnailUrl?: string | null) {
  const normalized = thumbnailUrl?.trim() || null;

  return normalized === null || DEFAULT_THUMBNAIL_URLS.has(normalized);
}

const VIDEO_EXTENSIONS = new Set(["m4v", "mov", "mp4", "webm"]);

export function getFileExtensionFromUrl(url: string) {
  return url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
}

export function isGifImageUrl(url: string) {
  const trimmed = url.trim();

  if (!trimmed || trimmed.startsWith("/")) {
    return false;
  }

  try {
    const pathname = decodeURIComponent(
      new URL(trimmed, "http://localhost").pathname,
    ).toLowerCase();

    return pathname.endsWith(".gif");
  } catch {
    const path = trimmed.split("?")[0]?.split("#")[0]?.toLowerCase() ?? "";

    return path.endsWith(".gif");
  }
}

export function isVideoMediaUrl(markdown: string, url: string) {
  const videoMarkdownRegex = /!\[video\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

  for (const match of markdown.matchAll(videoMarkdownRegex)) {
    if (match[1]?.trim() === url) {
      return true;
    }
  }

  return VIDEO_EXTENSIONS.has(getFileExtensionFromUrl(url));
}

export function getThumbnailMediaUrls(markdown: string, mediaUrls: string[]) {
  return mediaUrls.filter((url) => !isVideoMediaUrl(markdown, url));
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function createPostThumbnailPath(fileName: string) {
  const safeFileName = sanitizeFileName(fileName) || "thumbnail";
  return `thumbnails/${crypto.randomUUID()}-${safeFileName}`;
}

export function createPostContentImagePath(fileName: string) {
  const safeFileName = sanitizeFileName(fileName) || "image";
  return `contents/${crypto.randomUUID()}-${safeFileName}`;
}

export function createPostAttachmentPath(fileName: string) {
  const safeFileName = sanitizeFileName(fileName) || "attachment";
  return `attachments/${crypto.randomUUID()}-${safeFileName}`;
}

export function getStorageObjectPathFromPublicUrl(url?: string | null) {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const marker = `/storage/v1/object/public/${POST_THUMBNAIL_BUCKET}/`;
    const markerIndex = parsedUrl.pathname.indexOf(marker);

    if (markerIndex === -1) return null;

    return decodeURIComponent(
      parsedUrl.pathname.slice(markerIndex + marker.length),
    );
  } catch {
    return null;
  }
}
