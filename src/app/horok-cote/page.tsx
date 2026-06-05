import type { Metadata } from "next";
import { coteAuth } from "@/app/api/cote-auth/[...nextauth]/route";
import HorokCoteBackgroundPattern from "@/components/horok-cote/HorokCoteBackgroundPattern";
import HorokCoteCatalog from "@/components/horok-cote/HorokCoteCatalog";
import { getUserIdByEmail } from "@/lib/db";
import { HOROK_COTE_LEVELS, listHorokCoteProblems } from "@/lib/horok-cote";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "호록 코딩테스트 | horok-cote",
  description:
    "호록 코딩의 문제 목록과 IDE형 풀이 화면을 제공하는 코딩테스트 메인 페이지",
  alternates: {
    canonical: "/horok-cote",
  },
};

type HorokCotePageProps = {
  searchParams: Promise<{
    level?: string;
    tab?: string;
  }>;
};

export default async function HorokCotePage({
  searchParams,
}: HorokCotePageProps) {
  const { level, tab } = await searchParams;
  const problems = await listHorokCoteProblems();
  const initialSelectedLevel =
    HOROK_COTE_LEVELS.find((candidateLevel) => candidateLevel === level) ??
    "전체";

  const session = await coteAuth();
  let solvedSlugs: string[] = [];
  let failedSlugs: string[] = [];
  let bookmarkedSlugs: string[] = [];

  if (session?.user?.email) {
    const userId = await getUserIdByEmail(session.user.email);
    if (userId) {
      const [solvedProgress, submissions, savedCodes] = await Promise.all([
        prisma.coteProblemProgress.findMany({
          where: { userId: BigInt(userId), status: "solved" },
          select: { problemSlug: true },
        }),
        prisma.coteSubmission.findMany({
          where: { userId: BigInt(userId) },
          select: { problemSlug: true, status: true },
        }),
        prisma.coteSavedCode.findMany({
          where: { userId: BigInt(userId), language: "bookmark" },
          select: { problemSlug: true },
        }),
      ]);

      const solvedSlugSet = new Set([
        ...solvedProgress.map((p) => p.problemSlug),
        ...submissions
          .filter((submission) => submission.status === "solved")
          .map((submission) => submission.problemSlug),
      ]);
      solvedSlugs = [...solvedSlugSet];
      bookmarkedSlugs = [...new Set(savedCodes.map((s) => s.problemSlug))];

      const submittedSlugs = Array.from(
        new Set(submissions.map((s) => s.problemSlug)),
      );
      failedSlugs = submittedSlugs.filter((slug) => !solvedSlugSet.has(slug));
    }
  }

  const userProgress = {
    solvedSlugs,
    failedSlugs,
    bookmarkedSlugs,
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-[#06923E] px-4 py-6 text-slate-900 sm:px-6 lg:px-10">
      <HorokCoteBackgroundPattern />
      <div className="relative flex h-full w-full flex-col">
        <section
          id="problem-list"
          className="flex h-full min-h-0 flex-col rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] transition-colors dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_22px_60px_rgba(2,6,23,0.45)] sm:p-6"
        >
          <HorokCoteCatalog
            problems={problems}
            initialSelectedLevel={initialSelectedLevel}
            initialTab={tab}
            userProgress={userProgress}
          />
        </section>
      </div>
    </main>
  );
}
