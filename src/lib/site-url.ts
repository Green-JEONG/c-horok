const DEFAULT_SITE_URL = "https://c-horok.com";

export function getSiteUrl() {
  const url = process.env.NEXT_PUBLIC_BASE_URL || DEFAULT_SITE_URL;

  return url.endsWith("/") ? url.slice(0, -1) : url;
}
