import { NextResponse } from "next/server";
import { coteAuth } from "@/app/api/cote-auth/[...nextauth]/route";
import { getUserIdByEmail } from "@/lib/db";
import { prisma } from "@/lib/prisma";

async function getCurrentCoteUserId() {
  const session = await coteAuth();

  if (session?.user?.id && /^\d+$/.test(session.user.id)) {
    return BigInt(session.user.id);
  }

  if (session?.user?.email) {
    const userId = await getUserIdByEmail(session.user.email);
    return userId ? BigInt(userId) : null;
  }

  return null;
}

export async function POST(req: Request) {
  const userId = await getCurrentCoteUserId();

  if (!userId) {
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
