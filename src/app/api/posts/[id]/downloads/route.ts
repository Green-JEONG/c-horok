import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDbUserIdFromSession } from "@/lib/auth-db";
import { getPostByIdWithSecretAccess } from "@/lib/post-detail-access";
import { prisma } from "@/lib/prisma";

type DownloadType = "markdown" | "pdf";

function parseDownloadType(value: unknown): DownloadType | null {
  return value === "markdown" || value === "pdf" ? value : null;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    return NextResponse.json({ message: "Invalid post id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const downloadType = parseDownloadType(body?.type);

  if (!downloadType) {
    return NextResponse.json({ message: "Invalid input" }, { status: 400 });
  }

  const dbUserId = await getDbUserIdFromSession();
  const post = await getPostByIdWithSecretAccess(postId, {
    includeHiddenForUserId: dbUserId,
  });
  if (!post) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  if (post.is_secret && !post.can_view_secret) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const [updated] = await prisma.$queryRaw<
    Array<{ markdownCount: number; pdfCount: number }>
  >`
    INSERT INTO horok_log.post_download_counts (
      post_id,
      markdown_count,
      pdf_count
    )
    VALUES (
      ${BigInt(postId)},
      ${downloadType === "markdown" ? 1 : 0},
      ${downloadType === "pdf" ? 1 : 0}
    )
    ON CONFLICT (post_id) DO UPDATE SET
      markdown_count = horok_log.post_download_counts.markdown_count + ${
        downloadType === "markdown" ? 1 : 0
      },
      pdf_count = horok_log.post_download_counts.pdf_count + ${
        downloadType === "pdf" ? 1 : 0
      },
      updated_at = now()
    RETURNING
      markdown_count AS "markdownCount",
      pdf_count AS "pdfCount"
  `;

  const markdownCount = Number(updated?.markdownCount ?? 0);
  const pdfCount = Number(updated?.pdfCount ?? 0);

  return NextResponse.json({
    markdownCount,
    pdfCount,
    total: markdownCount + pdfCount,
  });
}
