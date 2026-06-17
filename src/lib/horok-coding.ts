import "server-only";

import { Prisma } from "@prisma/client";
import {
  getHorokCodingChatIntroMessage,
  getHorokCodingChatThreadTitle,
  HOROK_CODING_LEVELS,
  type HorokCodingProblem,
} from "@/lib/horok-coding-shared";
import { prisma } from "@/lib/prisma";

export {
  getHorokCodingChatIntroMessage,
  getHorokCodingChatThreadTitle,
  HOROK_CODING_LEVELS,
};

export type { HorokCodingProblem };

type HorokCodingProblemRecord = {
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

function isHorokCodingPersistenceError(error: unknown) {
  return (
    (error instanceof Error &&
      error.message === "HOROK_CODING_PERSISTENCE_CLIENT_OUTDATED") ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022"))
  );
}

function getCodingProblemDelegate() {
  const delegate = (prisma as typeof prisma & { codingProblem?: unknown })
    .codingProblem;

  if (!delegate) {
    throw new Error("HOROK_CODING_PERSISTENCE_CLIENT_OUTDATED");
  }

  return delegate as typeof prisma.codingProblem;
}

function isExamples(
  value: Prisma.JsonValue,
): value is HorokCodingProblem["examples"] {
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
): value is HorokCodingProblem["testCases"] {
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

function normalizeHorokCodingProblem(record: HorokCodingProblemRecord) {
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
  } satisfies HorokCodingProblem;
}

export async function listHorokCodingProblems() {
  try {
    const rows = (await getCodingProblemDelegate().findMany({
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
    })) as HorokCodingProblemRecord[];

    return rows.map(normalizeHorokCodingProblem);
  } catch (error) {
    if (!isHorokCodingPersistenceError(error)) {
      throw error;
    }

    return [];
  }
}

export async function getHorokCodingProblemByNumber(number: number) {
  const problems = await listHorokCodingProblems();
  return problems.find((problem) => problem.number === number);
}

export async function getHorokCodingProblem(problemId: string) {
  const problemNumber = Number(problemId);
  const problems = await listHorokCodingProblems();

  if (!Number.isNaN(problemNumber)) {
    return problems.find((problem) => problem.number === problemNumber);
  }

  return problems.find((problem) => problem.slug === problemId);
}

export async function listHorokCodingProblemRouteParams() {
  const problems = await listHorokCodingProblems();
  return problems.map((problem) => ({
    slug: String(problem.number),
  }));
}
