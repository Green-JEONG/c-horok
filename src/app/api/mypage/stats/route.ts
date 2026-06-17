import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { codingAuth } from "@/app/api/coding-auth/[...nextauth]/route";
import { getUserIdByEmail } from "@/lib/db";
import { prisma } from "@/lib/prisma";
import { countMyQnaPosts, countUserPosts } from "@/lib/queries";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform") === "coding" ? "coding" : "log";
    const session = await (platform === "coding" ? codingAuth() : auth());

    if (!session?.user?.email) {
      return NextResponse.json({
        first: 0,
        second: 0,
        third: 0,
        posts: 0,
        qna: 0,
        comments: 0,
        followers: 0,
        following: 0,
        friends: 0,
      });
    }

    const userId = await getUserIdByEmail(session.user.email);
    if (!userId) {
      return NextResponse.json({
        first: 0,
        second: 0,
        third: 0,
        posts: 0,
        qna: 0,
        comments: 0,
        followers: 0,
        following: 0,
        friends: 0,
      });
    }

    if (platform === "coding") {
      const [solvedProgress, submissions, savedCodes] = await Promise.all([
        prisma.codingProblemProgress.findMany({
          where: { userId: BigInt(userId), status: "solved" },
          select: { problemSlug: true },
        }),
        prisma.codingSubmission.findMany({
          where: { userId: BigInt(userId) },
          select: { problemSlug: true, status: true },
        }),
        prisma.codingSavedCode.findMany({
          where: { userId: BigInt(userId), language: "bookmark" },
          select: { problemSlug: true },
        }),
      ]);
      const solvedSlugs = new Set([
        ...solvedProgress.map((progress) => progress.problemSlug),
        ...submissions
          .filter((submission) => submission.status === "solved")
          .map((submission) => submission.problemSlug),
      ]);
      const submittedSlugs = new Set(
        submissions.map((submission) => submission.problemSlug),
      );
      const bookmarkedSlugs = new Set(
        savedCodes.map((savedCode) => savedCode.problemSlug),
      );
      const failedSlugs = [...submittedSlugs].filter(
        (slug) => !solvedSlugs.has(slug),
      );

      return NextResponse.json({
        first: solvedSlugs.size,
        second: failedSlugs.length,
        third: bookmarkedSlugs.size,
      });
    }

    const [first, qna, second, followers, following] = await Promise.all([
      countUserPosts(userId, { viewerUserId: userId }),
      countMyQnaPosts(userId),
      prisma.comment.count({
        where: {
          userId: BigInt(userId),
          isDeleted: false,
        },
      }),
      prisma.friend.count({
        where: {
          friendUserId: BigInt(userId),
        },
      }),
      prisma.friend.count({
        where: {
          // 내가 구독한 유저 수
          userId: BigInt(userId),
        },
      }),
    ]);
    const [adminNotices, adminFaqs, adminAnswers] =
      session.user.role === "ADMIN"
        ? await Promise.all([
            prisma.post.count({
              where: {
                userId: BigInt(userId),
                isDeleted: false,
                category: { is: { name: "공지" } },
              },
            }),
            prisma.post.count({
              where: {
                userId: BigInt(userId),
                isDeleted: false,
                category: { is: { name: "FAQ" } },
              },
            }),
            prisma.comment.count({
              where: {
                userId: BigInt(userId),
                isDeleted: false,
                post: {
                  isDeleted: false,
                  category: { is: { name: "QnA" } },
                },
              },
            }),
          ])
        : [0, 0, 0];

    return NextResponse.json({
      first,
      second,
      third: followers,
      posts: first,
      qna,
      comments: second,
      followers,
      following,
      friends: followers + following,
      adminNotices,
      adminFaqs,
      adminAnswers,
    });
  } catch (e) {
    console.error("MYPAGE STATS API ERROR:", e);
    return NextResponse.json({ first: 0, second: 0, third: 0 });
  }
}
