export const PROFILE_IMAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_PROFILE_BUCKET ??
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ??
  "post";

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function createProfileImagePath(userId: string, fileName: string) {
  const safeFileName = sanitizeFileName(fileName) || "profile";
  return `users/${userId}/${crypto.randomUUID()}-${safeFileName}`;
}

export function getProfileImageStoragePathFromPublicUrl(url?: string | null) {
  if (!url) return null;

  try {
    const parsedUrl = new URL(url);
    const marker = `/storage/v1/object/public/${PROFILE_IMAGE_BUCKET}/`;
    const markerIndex = parsedUrl.pathname.indexOf(marker);

    if (markerIndex === -1) return null;

    return decodeURIComponent(
      parsedUrl.pathname.slice(markerIndex + marker.length),
    );
  } catch {
    return null;
  }
}
