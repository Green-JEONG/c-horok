import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getPopularPosts } from "@/lib/posts";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("userId") ?? "");

  if (Number.isFinite(userId) && userId > 0) {
    const session = await auth();
    const viewerUserId =
      typeof session?.user?.id === "string" ? Number(session.user.id) : null;
    const canSeeHiddenPosts = viewerUserId === userId;

    const rows = await prisma.post.findMany({
      where: {
        userId: BigInt(userId),
        isDeleted: false,
        ...(canSeeHiddenPosts ? {} : { isHidden: false }),
        ...(canSeeHiddenPosts ? {} : { isSecret: false }),
        category: {
          is: {
            name: {
              notIn: ["공지", "FAQ", "QnA", "중요", "긴급"],
            },
          },
        },
      },
      include: {
        views: {
          select: { viewCount: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 24,
    });

    return NextResponse.json(
      rows
        .map((post) => ({
          id: Number(post.id),
          title: post.title,
          viewCount: Number(post.views?.viewCount ?? 0),
        }))
        .sort((a, b) => b.viewCount - a.viewCount || b.id - a.id)
        .slice(0, 5),
    );
  }

  const rows = await getPopularPosts();

  return NextResponse.json(rows);
}
