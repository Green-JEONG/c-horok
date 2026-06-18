export const POST_THUMBNAIL_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "post-thumbnails";

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
  return `public/thumbnails/${crypto.randomUUID()}-${safeFileName}`;
}

export function createPostContentImagePath(fileName: string) {
  const safeFileName = sanitizeFileName(fileName) || "image";
  return `public/content/${crypto.randomUUID()}-${safeFileName}`;
}

export function createPostAttachmentPath(fileName: string) {
  const safeFileName = sanitizeFileName(fileName) || "attachment";
  return `public/attachments/${crypto.randomUUID()}-${safeFileName}`;
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
