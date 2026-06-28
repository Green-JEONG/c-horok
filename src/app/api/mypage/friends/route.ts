import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { createPostStorageSignedUrl } from "@/lib/post-storage.server";
import { prisma } from "@/lib/prisma";
import { countVisibleUserPosts } from "@/lib/queries";

async function serializeUser(
  user: {
    id: bigint;
    name: string | null;
    email: string;
    image: string | null;
    _count: { followers: number };
  },
  viewerUserId: number,
  followedAt: Date,
) {
  const userId = Number(user.id);

  return {
    id: userId,
    name: user.name,
    email: user.email,
    image: await createPostStorageSignedUrl(user.image),
    followerCount: user._count.followers,
    postCount: await countVisibleUserPosts(userId, viewerUserId),
    followedAt: followedAt.toISOString(),
  };
}

type FriendUser = {
  id: bigint;
  name: string | null;
  email: string;
  image: string | null;
  _count: { followers: number };
};

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({
        followers: [],
        following: [],
        totalCount: 0,
        resolvedPage: 1,
      });
    }

    const url = new URL(request.url);
    const listType =
      url.searchParams.get("listType") === "followers"
        ? "followers"
        : "following";
    const requestedPage = Number(url.searchParams.get("page") ?? "1");
    const requestedLimit = Number(url.searchParams.get("limit") ?? "5");
    const query = url.searchParams.get("q")?.trim();
    const sort = url.searchParams.get("sort") ?? "latest";
    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 30)
        : 5;
    const resolvedPage =
      Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const userId = BigInt(session.user.id);
    const viewerUserId = Number(session.user.id);
    const relatedUserWhere = query
      ? {
          name: {
            contains: query,
          },
        }
      : undefined;
    const orderBy =
      sort === "oldest"
        ? { createdAt: "asc" as const }
        : { createdAt: "desc" as const };
    const followersOrderBy =
      sort === "nameAsc" ? { user: { name: "asc" as const } } : orderBy;
    const followingOrderBy =
      sort === "nameAsc" ? { friendUser: { name: "asc" as const } } : orderBy;

    if (listType === "followers") {
      const where = {
        friendUserId: userId,
        ...(relatedUserWhere ? { user: relatedUserWhere } : {}),
      };
      const [totalCount, rows] = await Promise.all([
        prisma.friend.count({ where }),
        prisma.friend.findMany({
          where,
          orderBy: followersOrderBy,
          skip: (resolvedPage - 1) * limit,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                _count: {
                  select: {
                    followers: true,
                  },
                },
              },
            },
          },
        }),
      ]);
      const followers = await Promise.all(
        rows.map((row) =>
          serializeUser(row.user as FriendUser, viewerUserId, row.createdAt),
        ),
      );

      return NextResponse.json({
        followers,
        following: [],
        totalCount,
        resolvedPage,
      });
    }

    const where = {
      userId,
      ...(relatedUserWhere ? { friendUser: relatedUserWhere } : {}),
    };
    const [totalCount, rows] = await Promise.all([
      prisma.friend.count({ where }),
      prisma.friend.findMany({
        where,
        orderBy: followingOrderBy,
        skip: (resolvedPage - 1) * limit,
        take: limit,
        include: {
          friendUser: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              _count: {
                select: {
                  followers: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const following = await Promise.all(
      rows.map((row) =>
        serializeUser(
          row.friendUser as FriendUser,
          viewerUserId,
          row.createdAt,
        ),
      ),
    );

    return NextResponse.json({
      followers: [],
      following,
      totalCount,
      resolvedPage,
    });
  } catch (e) {
    console.error("FRIENDS API ERROR:", e);
    return NextResponse.json(
      { followers: [], following: [], totalCount: 0, resolvedPage: 1 },
      { status: 500 },
    );
  }
}
