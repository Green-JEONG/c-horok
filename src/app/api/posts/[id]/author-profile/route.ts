import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { createPostStorageSignedUrl } from "@/lib/post-storage.server";
import { prisma } from "@/lib/prisma";
import { countVisibleUserPosts } from "@/lib/queries";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const postId = Number(id);

    if (Number.isNaN(postId)) {
      return NextResponse.json({ message: "Invalid post id" }, { status: 400 });
    }

    const post = await prisma.post.findFirst({
      where: {
        id: BigInt(postId),
        isDeleted: false,
      },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            _count: {
              select: {
                followers: true,
              },
            },
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const session = await auth();
    const currentUserId =
      session?.user?.id && /^\d+$/.test(session.user.id)
        ? BigInt(session.user.id)
        : null;
    const isSelf = currentUserId === post.user.id;
    const postCount = await countVisibleUserPosts(
      Number(post.user.id),
      currentUserId ? Number(currentUserId) : null,
    );

    const existingFriend = currentUserId
      ? await prisma.friend.findUnique({
          where: {
            userId_friendUserId: {
              userId: currentUserId,
              friendUserId: post.user.id,
            },
          },
          select: {
            id: true,
          },
        })
      : null;

    return NextResponse.json({
      id: Number(post.user.id),
      name: post.user.name,
      image: await createPostStorageSignedUrl(post.user.image),
      followerCount: post.user._count.followers,
      postCount,
      isSelf,
      isFriend: Boolean(existingFriend),
    });
  } catch (error) {
    console.error("POST AUTHOR PROFILE API ERROR:", error);
    return NextResponse.json(
      { message: "작성자 정보를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
