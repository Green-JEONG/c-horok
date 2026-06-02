import { NextResponse } from "next/server";
import { coteAuth } from "@/app/api/cote-auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: Request) {
  const session = await coteAuth();

  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    number?: number;
    title?: string;
    level?: string;
    category?: string;
    duration?: string;
    acceptanceRate?: string;
    summary?: string;
    prompt?: string;
    exampleInput?: string;
    exampleOutput?: string;
    exampleExplanation?: string;
  } | null;

  const number = typeof body?.number === "number" ? body.number : NaN;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const level = typeof body?.level === "string" ? body.level.trim() : "";
  const category =
    typeof body?.category === "string" ? body.category.trim() : "";
  const duration =
    typeof body?.duration === "string" ? body.duration.trim() : "";
  const acceptanceRate =
    typeof body?.acceptanceRate === "string" ? body.acceptanceRate.trim() : "";
  const summary = typeof body?.summary === "string" ? body.summary.trim() : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const exampleInput =
    typeof body?.exampleInput === "string" ? body.exampleInput : "";
  const exampleOutput =
    typeof body?.exampleOutput === "string" ? body.exampleOutput : "";
  const exampleExplanation =
    typeof body?.exampleExplanation === "string"
      ? body.exampleExplanation.trim()
      : "";

  if (
    !Number.isInteger(number) ||
    number < 0 ||
    !title ||
    !level ||
    !category ||
    !duration ||
    !acceptanceRate ||
    !summary ||
    !prompt ||
    !exampleOutput.trim()
  ) {
    return NextResponse.json(
      { message: "필수 문제 정보를 모두 입력해 주세요." },
      { status: 400 },
    );
  }

  const slugBase = slugify(title) || `problem-${number}`;
  const slug = `${number}-${slugBase}`;
  const coteProblemDelegate = (
    prisma as typeof prisma & { coteProblem: unknown }
  ).coteProblem as unknown as {
    findFirst: typeof prisma.coteProblem.findFirst;
    create: (args: {
      data: Record<string, unknown>;
      select: Record<string, boolean>;
    }) => Promise<{
      id: bigint;
      number: number;
      slug: string;
      title: string;
    }>;
  };

  const existingProblem = await coteProblemDelegate.findFirst({
    where: {
      OR: [{ number }, { slug }],
    },
    select: {
      id: true,
    },
  });

  if (existingProblem) {
    return NextResponse.json(
      { message: "같은 번호 또는 slug를 가진 문제가 이미 있습니다." },
      { status: 409 },
    );
  }

  const expectedOutput = exampleOutput.trim();
  const defaultConditions = expectedOutput
    ? [
        {
          text: "콘솔 출력이 비어 있지 않아야 합니다.",
          check: { type: "output_not_empty" },
        },
        {
          text: `대소문자가 정확하게 구분되게 '${expectedOutput}'와 완전히 일치해야 합니다.`,
          check: { type: "output_equals", value: expectedOutput },
        },
      ]
    : [
        {
          text: "출력 결과가 비어 있어야 합니다.",
          check: { type: "output_equals", value: "" },
        },
        {
          text: "불필요한 문자나 공백이 출력되지 않아야 합니다.",
          check: { type: "output_matches", pattern: "^\\s*$" },
        },
      ];

  const problem = await coteProblemDelegate.create({
    data: {
      number,
      slug,
      title,
      level,
      category,
      duration,
      acceptanceRate,
      summary,
      prompt,
      examples: [
        {
          input: exampleInput,
          output: exampleOutput,
          explanation: exampleExplanation,
        },
      ],
      testCases: [
        {
          name: "예제 1",
          status: "pending",
          input: exampleInput,
          expected: exampleOutput,
          conditions: defaultConditions,
        },
      ],
    },
    select: {
      id: true,
      number: true,
      slug: true,
      title: true,
    },
  });

  return NextResponse.json(problem, { status: 201 });
}
