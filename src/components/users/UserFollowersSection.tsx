import Image from "next/image";
import Link from "next/link";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { countVisibleUserPosts } from "@/lib/queries";

type Props = {
  userId: number;
  initialCount?: number;
  query?: string;
  sort?: string;
};

type FollowerItem = {
  id: number;
  name: string | null;
  image: string | null;
  followerCount: number;
  postCount: number;
  followedAt: Date;
};

async function getFollowing(userId: number): Promise<FollowerItem[]> {
  const session = await auth();
  const viewerUserId =
    typeof session?.user?.id === "string" ? Number(session.user.id) : null;
  const rows = await prisma.friend.findMany({
    where: {
      userId: BigInt(userId),
    },
    orderBy: { createdAt: "desc" },
    include: {
      friendUser: {
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

  return Promise.all(
    rows.map(async (row) => {
      const followingUserId = Number(row.friendUser.id);

      return {
        id: followingUserId,
        name: row.friendUser.name,
        image: row.friendUser.image,
        followerCount: row.friendUser._count.followers,
        followedAt: row.createdAt,
        postCount: await countVisibleUserPosts(
          followingUserId,
          typeof viewerUserId === "number" && !Number.isNaN(viewerUserId)
            ? viewerUserId
            : null,
        ),
      };
    }),
  );
}

export default async function UserFollowersSection({
  userId,
  initialCount,
  query,
  sort,
}: Props) {
  const following = await getFollowing(userId);
  const followingCount = initialCount ?? following.length;
  const normalizedQuery = query?.trim().toLowerCase();
  const visibleFollowing = following
    .filter((followingUser) => {
      if (!normalizedQuery) {
        return true;
      }

      return (followingUser.name ?? "").toLowerCase().includes(normalizedQuery);
    })
    .sort((a, b) => {
      if (sort === "oldest") {
        return a.followedAt.getTime() - b.followedAt.getTime();
      }

      if (sort === "nameAsc") {
        return (a.name ?? "").localeCompare(b.name ?? "", ["ko", "en"], {
          sensitivity: "base",
        });
      }

      if (sort === "followers") {
        return b.followerCount - a.followerCount || b.id - a.id;
      }

      if (sort === "posts") {
        return b.postCount - a.postCount || b.id - a.id;
      }

      return b.followedAt.getTime() - a.followedAt.getTime();
    });

  return (
    <section id="user-following" className="scroll-mt-24 space-y-4">
      {visibleFollowing.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {followingCount === 0
            ? "아직 팔로잉한 유저가 없습니다."
            : "조건에 맞는 팔로잉 유저가 없습니다."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleFollowing.map((followingUser) => (
            <li key={followingUser.id} className="min-w-0">
              <Link
                href={`/users/${followingUser.id}`}
                className="card-hover-scale flex h-full min-w-0 flex-col items-center rounded-xl border bg-background px-4 py-4 text-center"
              >
                <Image
                  src={followingUser.image ?? "/logo.png"}
                  alt={`${followingUser.name ?? "구독 유저"} 프로필`}
                  width={72}
                  height={72}
                  className={`h-18 w-18 rounded-full border object-cover ${!followingUser.image ? "grayscale" : ""}`}
                />
                <p className="mt-3 w-full truncate font-medium">
                  {followingUser.name ?? "이름 없는 사용자"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  팔로워 {followingUser.followerCount}명 · 글{" "}
                  {followingUser.postCount}개
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
