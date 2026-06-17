import { NextResponse } from "next/server";
import { codingAuth } from "@/app/api/coding-auth/[...nextauth]/route";
import { getUserIdByEmail } from "@/lib/db";
import { ensureHorokCodingSchema } from "@/lib/horok-coding-profile";
import { prisma } from "@/lib/prisma";

async function getCurrentCodingUserId() {
  const session = await codingAuth();

  if (session?.user?.id && /^\d+$/.test(session.user.id)) {
    return BigInt(session.user.id);
  }

  if (session?.user?.email) {
    const userId = await getUserIdByEmail(session.user.email);
    return userId ? BigInt(userId) : null;
  }

  return null;
}

export async function GET(req: Request) {
  const userId = await getCurrentCodingUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const problemSlug = searchParams.get("problemSlug");

  if (!problemSlug) {
    return NextResponse.json(
      { message: "Missing problemSlug" },
      { status: 400 },
    );
  }

  await ensureHorokCodingSchema();

  const codingSubmissionDelegate = (
    prisma as typeof prisma & { codingSubmission: unknown }
  ).codingSubmission as unknown as {
    findMany: (args: {
      where: {
        userId: bigint;
        problemSlug: string;
      };
      orderBy: Array<Record<string, "asc" | "desc">>;
      select: {
        id: boolean;
        language: boolean;
        sourceCode: boolean;
        status: boolean;
        elapsedSeconds: boolean;
        createdAt: boolean;
      };
    }) => Promise<
      Array<{
        id: bigint;
        language: string;
        sourceCode: string;
        status: string;
        elapsedSeconds: number | null;
        createdAt: Date;
      }>
    >;
  };

  try {
    const records = await codingSubmissionDelegate.findMany({
      where: {
        userId,
        problemSlug,
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        language: true,
        sourceCode: true,
        status: true,
        elapsedSeconds: true,
        createdAt: true,
      },
    });

    const serialized = records.map((r) => ({
      id: String(r.id),
      language: r.language,
      sourceCode: r.sourceCode,
      status: r.status,
      elapsedSeconds: r.elapsedSeconds,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json(serialized, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to load submissions:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const userId = await getCurrentCodingUserId();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    problemSlug?: string;
    problemNumber?: number;
    language?: string;
    sourceCode?: string;
    status?: string;
    elapsedSeconds?: number;
  } | null;

  const problemSlug =
    typeof body?.problemSlug === "string" ? body.problemSlug.trim() : "";
  const problemNumber =
    typeof body?.problemNumber === "number" ? body.problemNumber : null;
  const language =
    typeof body?.language === "string" ? body.language.trim() : "";
  const sourceCode =
    typeof body?.sourceCode === "string" ? body.sourceCode : "";
  const status = typeof body?.status === "string" ? body.status.trim() : "";
  const elapsedSeconds =
    typeof body?.elapsedSeconds === "number" ? body.elapsedSeconds : null;

  if (!problemSlug || !language || !status) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  await ensureHorokCodingSchema();

  const codingSubmissionDelegate = (
    prisma as typeof prisma & { codingSubmission: unknown }
  ).codingSubmission as unknown as {
    create: (args: {
      data: {
        userId: bigint;
        problemSlug: string;
        problemNumber: number | null;
        language: string;
        sourceCode: string;
        status: string;
        elapsedSeconds: number | null;
      };
    }) => Promise<unknown>;
  };

  try {
    await codingSubmissionDelegate.create({
      data: {
        userId,
        problemSlug,
        problemNumber,
        language,
        sourceCode,
        status,
        elapsedSeconds,
      },
    });

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Failed to create submission:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
