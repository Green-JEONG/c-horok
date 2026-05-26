import { Prisma } from "@prisma/client";

import { getDbUserIdFromSession } from "@/lib/auth-db";
import {
  appendChatMessage,
  getChatThreadById,
  updateChatThreadTitle,
} from "@/lib/chat";
import { prisma } from "@/lib/prisma";

function resolveChatPlatform(value: string | null | undefined) {
  return value === "cote" ? "cote" : "tech";
}

function isChatPersistenceError(error: unknown) {
  return (
    (error instanceof Error &&
      error.message === "CHAT_PERSISTENCE_CLIENT_OUTDATED") ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022"))
  );
}

function buildThreadTitle(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 60) || null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      platform?: string | null;
      threadId?: string | null;
      content?: string | null;
    } | null;
    const platform = resolveChatPlatform(body?.platform);
    const userId = await getDbUserIdFromSession(platform);

    if (!userId) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const threadId = body?.threadId;
    const content = body?.content?.trim();
    if (!threadId || !/^\d+$/.test(threadId) || !content) {
      return Response.json(
        { error: "저장할 문의 내용이 필요합니다." },
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

    await appendChatMessage({
      threadId,
      role: "user",
      content,
      senderUserId: userId,
    });

    if (!thread.title || thread.title === "새 대화") {
      await updateChatThreadTitle(threadId, buildThreadTitle(content));
    }

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    await Promise.all(
      admins.map(async (admin) => {
        await prisma.$executeRaw`
          INSERT INTO public.notifications (
            user_id,
            actor_id,
            chat_thread_id,
            type,
            content
          )
          VALUES (
            ${admin.id},
            ${BigInt(userId)},
            ${BigInt(threadId)},
            'chat_handoff',
            '챗봇 대화에 새로운 문의 메시지가 도착했습니다.'
          )
        `;
      })
    );

    return Response.json({ ok: true, threadId });
  } catch (error) {
    if (isChatPersistenceError(error)) {
      console.warn("/api/chat/handoff/message persistence unavailable", error);

      return Response.json(
        { error: "문의 내용을 저장할 수 없습니다." },
        { status: 503 },
      );
    }

    console.error("/api/chat/handoff/message error", error);

    return Response.json(
      { error: "문의 내용을 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}
