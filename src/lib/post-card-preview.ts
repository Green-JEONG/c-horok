const MARKDOWN_IMAGE_REGEX =
  /!\[([^\]]*)]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)(?:\s*\{[^}]*\})?/g;
const HTML_IMAGE_REGEX = /<img\b[^>]*\/?>/gi;

export function getPostCardPreviewText(content: string) {
  return content
    .replace(MARKDOWN_IMAGE_REGEX, " ")
    .replace(HTML_IMAGE_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();
}
