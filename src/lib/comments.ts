import { getCommentReactionSummariesByCommentId } from "@/lib/comment-reactions";
import type { PostReactionSummary } from "@/lib/post-reaction-options";
import {
  createPostStorageSignedUrl,
  normalizePostStorageMarkdown,
  signPostStorageMarkdown,
} from "@/lib/post-storage.server";
import { prisma } from "@/lib/prisma";

export type CommentRow = {
  id: number;
  post_id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  is_deleted: boolean;
  is_hidden: boolean;
  is_secret: boolean;
  can_view_secret: boolean;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  author_image: string | null;
  reactions: PostReactionSummary[];
};

export type AdminAnswer = {
  id: number;
  user_id: number;
  content: string;
  author: string;
  author_image: string | null;
  author_role: "USER" | "ADMIN";
  reactions: PostReactionSummary[];
  created_at: string;
  updated_at: string;
  is_edited: boolean;
};

function mapComment(
  comment: {
    id: bigint;
    postId: bigint;
    userId: bigint;
    parentId: bigint | null;
    content: string;
    isDeleted: boolean;
    isHidden: boolean;
    isSecret: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  options?: {
    viewerUserId?: number | null;
    postOwnerUserId?: number | null;
    isAdmin?: boolean;
  },
) {
  const commentUserId = Number(comment.userId);
  const canViewSecret =
    !comment.isSecret ||
    commentUserId === options?.viewerUserId ||
    options?.postOwnerUserId === options?.viewerUserId;

  return {
    id: Number(comment.id),
    post_id: Number(comment.postId),
    user_id: commentUserId,
    parent_id: comment.parentId ? Number(comment.parentId) : null,
    content: canViewSecret ? comment.content : "비밀댓글입니다.",
    is_deleted: comment.isDeleted,
    is_hidden: comment.isHidden,
    is_secret: comment.isSecret,
    can_view_secret: canViewSecret,
    is_edited: comment.updatedAt.getTime() > comment.createdAt.getTime(),
    created_at: comment.createdAt.toISOString(),
    updated_at: comment.updatedAt.toISOString(),
    author_image: null,
  };
}

export async function getCommentsByPost(
  postId: number,
  options?: {
    viewerUserId?: number | null;
    isAdmin?: boolean;
  },
) {
  const comments = await prisma.comment.findMany({
    where: {
      postId: BigInt(postId),
      OR: [
        { isHidden: false },
        ...(options?.viewerUserId
          ? [{ userId: BigInt(options.viewerUserId) }]
          : []),
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { email: true, name: true, image: true, role: true },
      },
      post: {
        select: { userId: true },
      },
    },
  });

  const reactionSummaries = await getCommentReactionSummariesByCommentId(
    comments.map((comment) => comment.id),
    options?.viewerUserId,
  );

  return Promise.all(
    comments.map(async (comment) => {
      const canViewAuthor =
        !comment.isSecret ||
        Number(comment.userId) === options?.viewerUserId ||
        Number(comment.post.userId) === options?.viewerUserId;

      const mappedComment = mapComment(comment, {
        viewerUserId: options?.viewerUserId ?? null,
        isAdmin: options?.isAdmin,
        postOwnerUserId: Number(comment.post.userId),
      });

      return {
        ...mappedComment,
        content: mappedComment.can_view_secret
          ? await signPostStorageMarkdown(mappedComment.content)
          : mappedComment.content,
        author: canViewAuthor
          ? (comment.user.name ?? comment.user.email)
          : "비공개",
        author_image: canViewAuthor
          ? await createPostStorageSignedUrl(comment.user.image)
          : null,
        author_role: canViewAuthor ? comment.user.role : null,
        reactions: reactionSummaries.get(Number(comment.id)) ?? [],
      };
    }),
  );
}

export async function getAdminAnswersByPost(
  postId: number,
  options?: {
    viewerUserId?: number | null;
    postOwnerUserId?: number | null;
    isAdmin?: boolean;
  },
) {
  const comments = await prisma.comment.findMany({
    where: {
      postId: BigInt(postId),
      isDeleted: false,
      OR: [
        { isHidden: false },
        ...(options?.viewerUserId
          ? [{ userId: BigInt(options.viewerUserId) }]
          : []),
      ],
      user: {
        is: {
          role: "ADMIN",
        },
      },
    },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: { name: true, email: true, image: true, role: true },
      },
    },
  });
  const reactionSummaries = await getCommentReactionSummariesByCommentId(
    comments.map((comment) => comment.id),
    options?.viewerUserId,
  );

  return Promise.all(
    comments.map(async (comment) => {
      const mappedComment = mapComment(comment, options);

      return {
        id: mappedComment.id,
        user_id: Number(comment.userId),
        content: mappedComment.can_view_secret
          ? await signPostStorageMarkdown(mappedComment.content)
          : mappedComment.content,
        author: comment.user.name ?? comment.user.email,
        author_image: await createPostStorageSignedUrl(comment.user.image),
        author_role: comment.user.role,
        reactions: reactionSummaries.get(Number(comment.id)) ?? [],
        created_at: mappedComment.created_at,
        updated_at: mappedComment.updated_at,
        is_edited: mappedComment.is_edited,
      } satisfies AdminAnswer;
    }),
  );
}

export async function getCommentById(id: number) {
  const comment = await prisma.comment.findUnique({
    where: { id: BigInt(id) },
  });

  return comment ? mapComment(comment) : null;
}

export async function createComment(params: {
  postId: number;
  userId: number;
  content: string;
  parentId?: number | null;
  isSecret?: boolean;
  isHidden?: boolean;
}) {
  const {
    postId,
    userId,
    content,
    parentId = null,
    isSecret = false,
    isHidden = false,
  } = params;

  const comment = await prisma.comment.create({
    data: {
      postId: BigInt(postId),
      userId: BigInt(userId),
      content: normalizePostStorageMarkdown(content),
      parentId: parentId ? BigInt(parentId) : null,
      isSecret,
      ...(isHidden ? { isHidden, hiddenAt: new Date() } : {}),
    },
  });

  return Number(comment.id);
}

export async function updateComment(params: {
  commentId: number;
  content: string;
  isSecret?: boolean;
}) {
  const { commentId, content, isSecret } = params;

  const comment = await prisma.comment.update({
    where: { id: BigInt(commentId) },
    data: {
      content: normalizePostStorageMarkdown(content),
      ...(isSecret !== undefined ? { isSecret } : {}),
    },
  });

  return mapComment(comment);
}

export async function updateCommentHidden(params: {
  commentId: number;
  isHidden: boolean;
}) {
  const { commentId, isHidden } = params;

  const comment = await prisma.comment.update({
    where: { id: BigInt(commentId) },
    data: {
      isHidden,
      hiddenAt: isHidden ? new Date() : null,
    },
  });

  return mapComment(comment);
}

export async function softDeleteComment(commentId: number) {
  await prisma.comment.update({
    where: { id: BigInt(commentId) },
    data: { isDeleted: true },
  });
}
