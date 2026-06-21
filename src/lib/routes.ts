type LogPostSection = "feeds" | "likes";

export function getLogPostPath(
  section: LogPostSection,
  postId: number | string,
) {
  return `/horok-log/${section}/posts/${postId}`;
}

export function getLogFeedPostPath(postId: number | string) {
  return getLogPostPath("feeds", postId);
}

export function getLogLikesPostPath(postId: number | string) {
  return getLogPostPath("likes", postId);
}

export function getLogFeedNewPostPath() {
  return "/horok-log/feeds/posts/new";
}

export function getLogFaqPath(postId: number | string) {
  return `/horok-log/notices?category=FAQ&open=${postId}`;
}

export function getLogNoticePath(postId: number | string) {
  return `/horok-log/notices/${postId}`;
}

export function getLogMyPagePath(query = "") {
  const normalizedQuery = query.startsWith("?") ? query : query ? `?${query}` : "";
  return `/horok-log/mypage${normalizedQuery}`;
}

export const LOG_MYPAGE_PATH = "/horok-log/mypage";

export function isLogMyPagePath(pathname: string) {
  return (
    pathname === LOG_MYPAGE_PATH ||
    pathname.startsWith(`${LOG_MYPAGE_PATH}/`) ||
    pathname === "/mypage" ||
    pathname.startsWith("/mypage/")
  );
}
