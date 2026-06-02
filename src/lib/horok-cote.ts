import "server-only";

import { Prisma } from "@prisma/client";
import {
  getHorokCoteChatIntroMessage,
  getHorokCoteChatThreadTitle,
  HOROK_COTE_LEVELS,
  type HorokCoteProblem,
} from "@/lib/horok-cote-shared";
import { prisma } from "@/lib/prisma";

export {
  getHorokCoteChatIntroMessage,
  getHorokCoteChatThreadTitle,
  HOROK_COTE_LEVELS,
};

export type { HorokCoteProblem };

type HorokCoteProblemRecord = {
  number: number;
  slug: string;
  title: string;
  level: string;
  category: string;
  duration: string;
  acceptanceRate: string;
  createdAt: Date;
  summary: string;
  prompt: string;
  examples: Prisma.JsonValue;
  testCases: Prisma.JsonValue;
};

function isHorokCotePersistenceError(error: unknown) {
  return (
    (error instanceof Error &&
      error.message === "HOROK_COTE_PERSISTENCE_CLIENT_OUTDATED") ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022"))
  );
}

function getCoteProblemDelegate() {
  const delegate = (prisma as typeof prisma & { coteProblem?: unknown })
    .coteProblem;

  if (!delegate) {
    throw new Error("HOROK_COTE_PERSISTENCE_CLIENT_OUTDATED");
  }

  return delegate as typeof prisma.coteProblem;
}

function isExamples(
  value: Prisma.JsonValue,
): value is HorokCoteProblem["examples"] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof item.input === "string" &&
        typeof item.output === "string" &&
        typeof item.explanation === "string",
    )
  );
}

function isTestCases(
  value: Prisma.JsonValue,
): value is HorokCoteProblem["testCases"] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof item.name === "string" &&
        (item.status === "passed" || item.status === "pending") &&
        typeof item.input === "string" &&
        typeof item.expected === "string",
    )
  );
}

function normalizeHorokCoteProblem(record: HorokCoteProblemRecord) {
  return {
    number: record.number,
    slug: record.slug,
    title: record.title,
    level: record.level,
    category: record.category,
    duration: record.duration,
    acceptanceRate: record.acceptanceRate,
    createdAt: record.createdAt.toISOString(),
    summary: record.summary,
    prompt: record.prompt,
    examples: isExamples(record.examples) ? record.examples : [],
    testCases: isTestCases(record.testCases) ? record.testCases : [],
  } satisfies HorokCoteProblem;
}

export async function listHorokCoteProblems() {
  try {
    const rows = (await getCoteProblemDelegate().findMany({
      orderBy: [{ number: "asc" }],
      select: {
        number: true,
        slug: true,
        title: true,
        level: true,
        category: true,
        duration: true,
        acceptanceRate: true,
        createdAt: true,
        summary: true,
        prompt: true,
        examples: true,
        testCases: true,
      },
    })) as HorokCoteProblemRecord[];

    return rows.map(normalizeHorokCoteProblem);
  } catch (error) {
    if (!isHorokCotePersistenceError(error)) {
      throw error;
    }

    return [];
  }
}

export async function getHorokCoteProblemByNumber(number: number) {
  const problems = await listHorokCoteProblems();
  return problems.find((problem) => problem.number === number);
}

export async function getHorokCoteProblem(problemId: string) {
  const problemNumber = Number(problemId);
  const problems = await listHorokCoteProblems();

  if (!Number.isNaN(problemNumber)) {
    return problems.find((problem) => problem.number === problemNumber);
  }

  return problems.find((problem) => problem.slug === problemId);
}

export async function listHorokCoteProblemRouteParams() {
  const problems = await listHorokCoteProblems();
  return problems.map((problem) => ({
    slug: String(problem.number),
  }));
}
