import type { CSSProperties } from "react";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getCommentsByPost } from "@/lib/comments";
import CommentItem, { type CommentNode } from "./CommentItem";
import InquiryAnswerComposer from "./InquiryAnswerComposer";

function getStableRgbColor(seed: number) {
  let value = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;

  const red = value & 0xff;
  const green = (value >>> 8) & 0xff;
  const blue = (value >>> 16) & 0xff;

  return `rgb(${red} ${green} ${blue})`;
}

function getCommentGraphColors(comments: CommentNode[]) {
  return comments.map((comment) => getStableRgbColor(comment.id));
}

export default async function CommentList({
  postId,
  headingLabel = "댓글",
  emptyMessage = "아직 댓글이 없습니다.",
  composerButtonLabel = "댓글 작성하기",
  composerPlaceholder = "댓글을 작성하세요",
  composerSubmitLabel = "댓글 등록",
  showComposerSecretOption = true,
  showComposer = true,
  adminOnly = false,
  showReplyButton = true,
  replyButtonLabel = "대댓글",
  replyPlaceholder = "대댓글을 작성하세요",
  replySubmitLabel = "대댓글 등록",
}: {
  postId: number;
  headingLabel?: string;
  emptyMessage?: string;
  composerButtonLabel?: string;
  composerPlaceholder?: string;
  composerSubmitLabel?: string;
  showComposerSecretOption?: boolean;
  showComposer?: boolean;
  adminOnly?: boolean;
  showReplyButton?: boolean;
  replyButtonLabel?: string;
  replyPlaceholder?: string;
  replySubmitLabel?: string;
}) {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.email);
  const currentUserId =
    typeof session?.user?.id === "string" && /^\d+$/.test(session.user.id)
      ? Number(session.user.id)
      : null;
  const comments = await getCommentsByPost(postId, {
    viewerUserId: currentUserId,
    isAdmin: session?.user?.role === "ADMIN",
  });
  const visibleComments = adminOnly
    ? comments.filter((comment) => comment.author_role === "ADMIN")
    : comments;
  const commentMap = new Map<number, CommentNode>();
  const rootComments: CommentNode[] = [];

  for (const comment of visibleComments) {
    commentMap.set(comment.id, {
      ...comment,
      replies: [],
    });
  }

  for (const comment of commentMap.values()) {
    if (comment.parent_id) {
      const topLevelParent = findTopLevelParent(comment, commentMap);
      if (topLevelParent) {
        topLevelParent.replies.push(comment);
      }
      continue;
    }

    rootComments.push(comment);
  }
  const graphColors = getCommentGraphColors(rootComments);

  return (
    <section className="mt-10">
      <h3 className="mb-6 text-lg font-semibold">
        {headingLabel}{" "}
        <span className="text-sm font-medium text-muted-foreground">
          {visibleComments.length}
        </span>
      </h3>

      {showComposer ? (
        <InquiryAnswerComposer
          postId={postId}
          buttonLabel={composerButtonLabel}
          placeholder={composerPlaceholder}
          requiresLogin={!isLoggedIn}
          submitLabel={composerSubmitLabel}
          showSecretOption={showComposerSecretOption}
          iconVariant="graph-card"
          showGraphTail={rootComments.length > 0}
          currentUserName={session?.user?.name ?? null}
          currentUserImage={session?.user?.image ?? null}
          currentUserRole={session?.user?.role ?? null}
          graphTailColor={graphColors[0] ?? null}
          className="mb-6 mt-0"
        />
      ) : null}

      {rootComments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="relative ml-2 space-y-6 pl-6">
          {rootComments.map((comment, index) => {
            const isOnlyComment = rootComments.length === 1;
            const isLastComment = index === rootComments.length - 1;
            const graphColor = graphColors[index];

            return (
              <li
                key={comment.id}
                style={
                  {
                    "--comment-graph-color": graphColor,
                  } as CSSProperties
                }
                className={`relative before:absolute before:-left-6 before:w-0.5 before:bg-[var(--comment-graph-color)] ${
                  isOnlyComment || (!showComposer && index === 0)
                    ? "before:hidden"
                    : index === 0
                      ? "before:-top-6 before:-bottom-6"
                      : isLastComment
                        ? "before:hidden"
                        : "before:-inset-y-6"
                }`}
              >
                <CommentItem
                  comment={comment}
                  postId={postId}
                  currentUserId={currentUserId}
                  currentUserName={session?.user?.name ?? null}
                  currentUserImage={session?.user?.image ?? null}
                  currentUserRole={session?.user?.role ?? null}
                  isLoggedIn={isLoggedIn}
                  showReplyButton={showReplyButton}
                  replyButtonLabel={replyButtonLabel}
                  replyPlaceholder={replyPlaceholder}
                  replySubmitLabel={replySubmitLabel}
                  depth={0}
                  graphColor={graphColor}
                  connectFromPrevious={
                    (isOnlyComment && showComposer) ||
                    (!isOnlyComment && isLastComment)
                  }
                  connectToNext={!showComposer && index === 0 && !isLastComment}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function findTopLevelParent(
  comment: CommentNode,
  commentMap: Map<number, CommentNode>,
) {
  let currentParentId = comment.parent_id;
  let topLevelParent: CommentNode | null = null;

  while (currentParentId) {
    const parent = commentMap.get(currentParentId);
    if (!parent) return null;

    topLevelParent = parent;
    currentParentId = parent.parent_id;
  }

  return topLevelParent;
}
