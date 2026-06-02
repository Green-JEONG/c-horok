import { NextResponse } from "next/server";
import { coteAuth } from "@/app/api/cote-auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await coteAuth();
  if (!session?.user?.id || !/^\d+$/.test(session.user.id)) {
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

  const userId = BigInt(session.user.id);
  const coteSavedCodeDelegate = (
    prisma as typeof prisma & { coteSavedCode: unknown }
  ).coteSavedCode as unknown as {
    findMany: (args: {
      where: {
        userId: bigint;
        problemSlug: string;
      };
      select: {
        language: boolean;
        sourceCode: boolean;
      };
    }) => Promise<Array<{ language: string; sourceCode: string }>>;
  };

  const records = await coteSavedCodeDelegate.findMany({
    where: {
      userId,
      problemSlug,
    },
    select: {
      language: true,
      sourceCode: true,
    },
  });

  const codes = {
    python: "",
    java: "",
    cpp: "",
    javascript: "",
  };

  for (const record of records) {
    if (
      record.language === "python" ||
      record.language === "java" ||
      record.language === "cpp" ||
      record.language === "javascript"
    ) {
      codes[record.language as "python" | "java" | "cpp" | "javascript"] =
        record.sourceCode;
    }
  }

  return NextResponse.json({
    codes,
    isBookmarked: records.length > 0,
  });
}

export async function POST(req: Request) {
  const session = await coteAuth();
  if (!session?.user?.id || !/^\d+$/.test(session.user.id)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    problemSlug?: string;
    problemNumber?: number;
    language?: string;
    sourceCode?: string;
  } | null;

  const problemSlug =
    typeof body?.problemSlug === "string" ? body.problemSlug.trim() : "";
  const problemNumber =
    typeof body?.problemNumber === "number" ? body.problemNumber : null;
  const language =
    typeof body?.language === "string" ? body.language.trim() : "";
  const sourceCode =
    typeof body?.sourceCode === "string" ? body.sourceCode : "";

  if (!problemSlug || !language) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const userId = BigInt(session.user.id);

  const coteSavedCodeDelegate = (
    prisma as typeof prisma & { coteSavedCode: unknown }
  ).coteSavedCode as unknown as {
    upsert: (args: {
      where: {
        userId_problemSlug_language: {
          userId: bigint;
          problemSlug: string;
          language: string;
        };
      };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) => Promise<unknown>;
  };

  await coteSavedCodeDelegate.upsert({
    where: {
      userId_problemSlug_language: {
        userId,
        problemSlug,
        language,
      },
    },
    update: {
      problemNumber,
      sourceCode,
      updatedAt: new Date(),
    },
    create: {
      userId,
      problemSlug,
      problemNumber,
      language,
      sourceCode,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await coteAuth();
  if (!session?.user?.id || !/^\d+$/.test(session.user.id)) {
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

  const userId = BigInt(session.user.id);
  const coteSavedCodeDelegate = (
    prisma as typeof prisma & { coteSavedCode: unknown }
  ).coteSavedCode as unknown as {
    deleteMany: (args: {
      where: {
        userId: bigint;
        problemSlug: string;
      };
    }) => Promise<unknown>;
  };

  await coteSavedCodeDelegate.deleteMany({
    where: {
      userId,
      problemSlug,
    },
  });

  return NextResponse.json({ ok: true });
}
