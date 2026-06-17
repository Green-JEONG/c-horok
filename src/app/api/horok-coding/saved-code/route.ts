import { NextResponse } from "next/server";
import { codingAuth } from "@/app/api/coding-auth/[...nextauth]/route";
import { getUserIdByEmail } from "@/lib/db";
import { prisma } from "@/lib/prisma";

const BOOKMARK_LANGUAGE = "bookmark";
const CODE_LANGUAGES = ["python", "java", "cpp", "javascript"] as const;
type CodeLanguage = (typeof CODE_LANGUAGES)[number];

function isCodeLanguage(language: string): language is CodeLanguage {
  return CODE_LANGUAGES.includes(language as CodeLanguage);
}

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

  const codingSavedCodeDelegate = (
    prisma as typeof prisma & { codingSavedCode: unknown }
  ).codingSavedCode as unknown as {
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

  const records = await codingSavedCodeDelegate.findMany({
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
    if (isCodeLanguage(record.language)) {
      codes[record.language] = record.sourceCode;
    }
  }

  return NextResponse.json({
    ...codes,
    codes,
    isBookmarked: records.some(
      (record) => record.language === BOOKMARK_LANGUAGE,
    ),
  });
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
    isBookmarked?: boolean;
  } | null;

  const problemSlug =
    typeof body?.problemSlug === "string" ? body.problemSlug.trim() : "";
  const problemNumber =
    typeof body?.problemNumber === "number" ? body.problemNumber : null;
  const requestedLanguage =
    typeof body?.language === "string" ? body.language.trim() : "";
  const isBookmarkRequest = body?.isBookmarked === true;
  const language = isBookmarkRequest ? BOOKMARK_LANGUAGE : requestedLanguage;
  const sourceCode =
    typeof body?.sourceCode === "string" ? body.sourceCode : "";

  if (
    !problemSlug ||
    !language ||
    (!isBookmarkRequest && !isCodeLanguage(language))
  ) {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const codingSavedCodeDelegate = (
    prisma as typeof prisma & { codingSavedCode: unknown }
  ).codingSavedCode as unknown as {
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

  await codingSavedCodeDelegate.upsert({
    where: {
      userId_problemSlug_language: {
        userId,
        problemSlug,
        language,
      },
    },
    update: {
      problemNumber,
      sourceCode: isBookmarkRequest ? "" : sourceCode,
      updatedAt: new Date(),
    },
    create: {
      userId,
      problemSlug,
      problemNumber,
      language,
      sourceCode: isBookmarkRequest ? "" : sourceCode,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
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

  const codingSavedCodeDelegate = (
    prisma as typeof prisma & { codingSavedCode: unknown }
  ).codingSavedCode as unknown as {
    deleteMany: (args: {
      where: {
        userId: bigint;
        problemSlug: string;
        language: string;
      };
    }) => Promise<unknown>;
  };

  await codingSavedCodeDelegate.deleteMany({
    where: {
      userId,
      problemSlug,
      language: BOOKMARK_LANGUAGE,
    },
  });

  return NextResponse.json({ ok: true });
}
