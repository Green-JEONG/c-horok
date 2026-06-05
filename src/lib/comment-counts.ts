import type { Prisma } from "@prisma/client";

export function buildVisibleCommentCountWhere(
  _viewerUserId?: number | null,
): Prisma.CommentWhereInput {
  return {
    isDeleted: false,
    isHidden: false,
  };
}
