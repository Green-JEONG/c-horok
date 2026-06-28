import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getUserIdByEmail } from "@/lib/db";
import { getLikeCount, hasLiked } from "@/lib/likes";
import { getPostByIdWithSecretAccess } from "@/lib/post-detail-access";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    return NextResponse.json({ message: "Invalid post id" }, { status: 400 });
  }

  const session = await auth();

  let liked = false;
  let post = null;

  if (session?.user?.email) {
    const userId = await getUserIdByEmail(session.user.email);
    if (userId) {
      post = await getPostByIdWithSecretAccess(postId, {
        includeHiddenForUserId: userId,
      });
      if (!post) {
        return NextResponse.json({ message: "Not found" }, { status: 404 });
      }
      liked = await hasLiked(postId, userId);
    }
  } else {
    post = await getPostByIdWithSecretAccess(postId);
  }

  if (!post) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (post.is_secret && !post.can_view_secret) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const likeCount = await getLikeCount(postId);

  return NextResponse.json({
    liked,
    likeCount,
  });
}
