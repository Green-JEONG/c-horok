import { Prisma } from "@prisma/client";

import { getDbUserIdFromSession } from "@/lib/auth-db";
import { appendChatMessage } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

function resolveChatPlatform(value: string | null | undefined) {
  return value === "coding" ? "coding" : "log";
}

function isChatPersistenceError(error: unknown) {
  return (
    (error instanceof Error &&
      error.message === "CHAT_PERSISTENCE_CLIENT_OUTDATED") ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022"))
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      platform?: string | null;
      threadId?: string | null;
      content?: string | null;
    } | null;
    const userId = await getDbUserIdFromSession(
      resolveChatPlatform(body?.platform),
    );

    if (!userId) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const threadId = body?.threadId;
    const content = body?.content?.trim();
    if (!threadId || !/^\d+$/.test(threadId) || !content) {
      return Response.json(
        { error: "저장할 답변 내용이 필요합니다." },
        { status: 400 },
      );
    }

    const admin = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      select: { role: true },
    });
    if (admin?.role !== "ADMIN") {
      return Response.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const handoffs = await prisma.$queryRaw<
      Array<{ id: bigint; user_id: bigint }>
    >`
      SELECT id, user_id
      FROM public.chat_handoffs
      WHERE thread_id = ${BigInt(threadId)}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const handoff = handoffs[0];

    if (!handoff) {
      return Response.json(
        { error: "문의 대화를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    await appendChatMessage({
      threadId,
      role: "assistant",
      content,
      senderUserId: userId,
    });

    await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE public.chat_handoffs
        SET
          status = 'answered',
          admin_reply = ${content},
          replied_by_user_id = ${BigInt(userId)},
          replied_at = NOW()
        WHERE id = ${handoff.id}
      `,
      prisma.notification.create({
        data: {
          userId: handoff.user_id,
          actorId: BigInt(userId),
          type: "chat_handoff_reply",
          content: "관리자가 챗봇 문의에 답변을 남겼습니다.",
          chatThreadId: BigInt(threadId),
        },
      }),
    ]);

    return Response.json({ ok: true, threadId });
  } catch (error) {
    if (isChatPersistenceError(error)) {
      console.warn("/api/chat/handoff/reply persistence unavailable", error);

      return Response.json(
        { error: "답변을 저장할 수 없습니다." },
        { status: 503 },
      );
    }

    console.error("/api/chat/handoff/reply error", error);

    return Response.json(
      { error: "답변을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
