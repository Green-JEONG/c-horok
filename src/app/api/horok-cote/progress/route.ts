import { NextResponse } from "next/server";
import { coteAuth } from "@/app/api/cote-auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await coteAuth();

  if (!session?.user?.id || !/^\d+$/.test(session.user.id)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    problemSlug?: string;
    problemNumber?: number;
    elapsedSeconds?: number;
  } | null;

  const problemSlug =
    typeof body?.problemSlug === "string" ? body.problemSlug.trim() : "";
  const problemNumber =
    typeof body?.problemNumber === "number" ? body.problemNumber : null;
  const elapsedSeconds =
    typeof body?.elapsedSeconds === "number" ? body.elapsedSeconds : NaN;

  if (
    !problemSlug ||
    problemNumber === null ||
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds < 0
  ) {
    return NextResponse.json(
      { message: "Invalid progress payload" },
      { status: 400 },
    );
  }

  const userId = BigInt(session.user.id);
  const solvedDurationSeconds = Math.floor(elapsedSeconds);
  const coteProblemProgressDelegate = (
    prisma as typeof prisma & { coteProblemProgress: unknown }
  ).coteProblemProgress as unknown as {
    upsert: (args: {
      where: {
        userId_problemSlug: {
          userId: bigint;
          problemSlug: string;
        };
      };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
      select: Record<string, boolean>;
    }) => Promise<{
      id: bigint;
      solvedDurationSeconds: number | null;
    }>;
  };

  const progress = await coteProblemProgressDelegate.upsert({
    where: {
      userId_problemSlug: {
        userId,
        problemSlug,
      },
    },
    update: {
      problemNumber,
      status: "solved",
      lastSubmittedAt: new Date(),
      solvedAt: new Date(),
      solvedDurationSeconds,
    },
    create: {
      userId,
      problemSlug,
      problemNumber,
      status: "solved",
      lastSubmittedAt: new Date(),
      solvedAt: new Date(),
      solvedDurationSeconds,
    },
    select: {
      id: true,
      solvedDurationSeconds: true,
    },
  });

  return NextResponse.json(
    {
      ...progress,
      id: progress.id.toString(),
    },
    { status: 200 },
  );
}
