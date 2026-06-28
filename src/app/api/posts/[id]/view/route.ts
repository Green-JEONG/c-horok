import { NextResponse } from "next/server";
import { getDbUserIdFromSession } from "@/lib/auth-db";
import { getPostByIdWithSecretAccess } from "@/lib/post-detail-access";
import { incrementPostViews } from "@/lib/posts";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    return NextResponse.json({ message: "Invalid post id" }, { status: 400 });
  }

  const dbUserId = await getDbUserIdFromSession();
  const post = await getPostByIdWithSecretAccess(postId, {
    includeHiddenForUserId: dbUserId,
  });
  if (!post) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (post.is_secret && !post.can_view_secret) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await incrementPostViews(postId);

  return NextResponse.json({ ok: true });
}
