import { Prisma } from "@prisma/client";

import { getDbUserIdFromSession } from "@/lib/auth-db";
import { getChatThreadById } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

function resolveChatPlatform(value: string | null | undefined) {
  return value === "cote" ? "cote" : "tech";
}

function isChatHandoffTableUnavailable(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "";

  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" ||
      error.code === "P2022" ||
      (error.code === "P2010" &&
        (message.includes("42P01") ||
          message.includes("42703") ||
          message.includes("TableDoesNotExist") ||
          message.includes("relation") ||
          message.includes("does not exist"))))
  );
}

async function upsertAdminHandoffNotifications(params: {
  tx: Pick<typeof prisma, "$executeRaw" | "$queryRaw" | "user">;
  actorUserId: number;
  threadId: string;
}) {
  const admins = await params.tx.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  await Promise.all(
    admins.map(async (admin) => {
      await params.tx.$executeRaw`
        INSERT INTO public.notifications (
          user_id,
          actor_id,
          chat_thread_id,
          type,
          content
        )
        VALUES (
          ${admin.id},
          ${BigInt(params.actorUserId)},
          ${BigInt(params.threadId)},
          'chat_handoff',
          '챗봇 대화에서 관리자 문의가 접수되었습니다.'
        )
      `;
    }),
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      platform?: string | null;
      threadId?: string | null;
      reason?: string | null;
    } | null;
    const platform = resolveChatPlatform(body?.platform);
    const userId = await getDbUserIdFromSession(platform);

    if (!userId) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const threadId = body?.threadId;
    if (!threadId || !/^\d+$/.test(threadId)) {
      return Response.json(
        { error: "전달할 대화를 찾지 못했습니다." },
        { status: 400 },
      );
    }

    const thread = await getChatThreadById(userId, threadId);
    if (!thread) {
      return Response.json(
        { error: "대화를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const reason = body?.reason?.trim().slice(0, 1000) || null;
    const existing = await prisma.$queryRaw<
      Array<{ id: bigint; created_at: Date }>
    >`
      SELECT id, created_at
      FROM public.chat_handoffs
      WHERE thread_id = ${BigInt(threadId)}
        AND user_id = ${BigInt(userId)}
        AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (existing[0]) {
      await upsertAdminHandoffNotifications({
        tx: prisma,
        actorUserId: userId,
        threadId,
      });

      return Response.json({
        ok: true,
        handoffId: existing[0].id.toString(),
        status: "pending",
        alreadyExists: true,
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: bigint }>>`
        INSERT INTO public.chat_handoffs (thread_id, user_id, reason)
        VALUES (${BigInt(threadId)}, ${BigInt(userId)}, ${reason})
        RETURNING id
      `;
      const handoffId = rows[0]?.id;

      if (!handoffId) {
        throw new Error("CHAT_HANDOFF_CREATE_FAILED");
      }

      await upsertAdminHandoffNotifications({
        tx,
        actorUserId: userId,
        threadId,
      });

      return handoffId;
    });

    return Response.json({
      ok: true,
      handoffId: created.toString(),
      status: "pending",
      alreadyExists: false,
    });
  } catch (error) {
    if (isChatHandoffTableUnavailable(error)) {
      console.warn("/api/chat/handoff persistence unavailable", error);

      return Response.json(
        { error: "문의 남겨놓기 기능이 아직 준비되지 않았습니다." },
        { status: 503 },
      );
    }

    console.error("/api/chat/handoff error", error);

    return Response.json(
      { error: "문의를 접수하지 못했습니다." },
      { status: 500 },
    );
  }
}
