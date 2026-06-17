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
