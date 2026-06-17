import type { Metadata } from "next";
import { codingAuth } from "@/app/api/coding-auth/[...nextauth]/route";
import ErrorState from "@/components/common/ErrorState";
import HorokCodingBackgroundPattern from "@/components/horok-coding/HorokCodingBackgroundPattern";
import HorokCodingProblemHeader from "@/components/horok-coding/HorokCodingProblemHeader";
import HorokCodingWorkspace from "@/components/horok-coding/HorokCodingWorkspace";
import { getUserIdByEmail } from "@/lib/db";
import {
  getHorokCodingProblem,
  listHorokCodingProblemRouteParams,
  listHorokCodingProblems,
} from "@/lib/horok-coding";
import { prisma } from "@/lib/prisma";

type HorokCodingProblemPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return listHorokCodingProblemRouteParams();
}

export async function generateMetadata({
  params,
}: HorokCodingProblemPageProps): Promise<Metadata> {
  const { slug } = await params;
  const problem = await getHorokCodingProblem(slug);

  if (!problem) {
    return {
      title: "문제를 찾을 수 없습니다 | c.horok",
    };
  }

  return {
    title: `${problem.title} | horok coding`,
    description: problem.summary,
    alternates: {
      canonical: `/horok-coding/${problem.number}`,
    },
  };
}

export default async function HorokCodingProblemPage({
  params,
}: HorokCodingProblemPageProps) {
  const { slug } = await params;
  const [problem, allProblems] = await Promise.all([
    getHorokCodingProblem(slug),
    listHorokCodingProblems(),
  ]);
  const session = await codingAuth();
  let solvedSlugs: string[] = [];
  let failedSlugs: string[] = [];
  let bookmarkedSlugs: string[] = [];

  if (session?.user?.email) {
    const userId = await getUserIdByEmail(session.user.email);
    if (userId) {
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
      failedSlugs = submittedSlugs.filter(
        (problemSlug) => !solvedSlugSet.has(problemSlug),
      );
    }
  }

  const userProgress = {
    solvedSlugs,
    failedSlugs,
    bookmarkedSlugs,
  };

  if (!problem) {
    return (
      <main className="relative h-dvh overflow-hidden bg-[#06923E] px-4 py-6 text-slate-900 sm:px-6 lg:px-10">
        <HorokCodingBackgroundPattern />
        <div className="relative flex h-full w-full flex-col">
          <section className="flex h-full min-h-0 flex-col rounded-[32px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)] transition-colors dark:border-slate-800 dark:bg-[#020617] dark:shadow-[0_22px_60px_rgba(2,6,23,0.45)] sm:p-6">
            <ErrorState
              code={404}
              message="요청하신 페이지를 찾을 수 없습니다. 주소가 올바른지 확인해 주세요."
              className="min-h-0 flex-1 px-0 py-0"
              contentClassName="rounded-[28px] bg-white px-6 py-10 dark:bg-[#020617]"
              codeClassName="text-[#06923E] dark:text-[#46c86f]"
              retryClassName="bg-[#06923E] text-white dark:bg-[#46c86f] dark:text-slate-950"
            />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-[#06923E] px-4 py-6 text-slate-900">
      <HorokCodingBackgroundPattern />
      <div className="relative flex h-full w-full flex-col">
        <section className="flex h-full min-h-0 flex-col rounded-[32px] border border-slate-200 bg-white px-5 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] transition-colors dark:border-slate-800 dark:bg-slate-950 dark:shadow-[0_22px_60px_rgba(2,6,23,0.45)]">
          <HorokCodingProblemHeader
            level={problem.level}
            number={problem.number}
            title={problem.title}
            problems={allProblems}
            userProgress={userProgress}
          />
          <HorokCodingWorkspace problem={problem} />
        </section>
      </div>
    </main>
  );
}
