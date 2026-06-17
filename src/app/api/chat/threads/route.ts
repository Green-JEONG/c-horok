import { Prisma } from "@prisma/client";

import { getDbUserIdFromSession } from "@/lib/auth-db";
import {
  appendChatMessage,
  createChatThread,
  deleteChatThread,
  getChatThreadById,
  updateChatThreadTitle,
} from "@/lib/chat";

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
      platform?: string;
      title?: string;
      initialAssistantMessage?: string;
    } | null;
    const userId = await getDbUserIdFromSession(
      resolveChatPlatform(body?.platform),
    );
    if (!userId) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const title = body?.title?.trim() || "새 대화";
    const initialAssistantMessage = body?.initialAssistantMessage?.trim();
    const thread = await createChatThread(userId, title);

    if (initialAssistantMessage) {
      await appendChatMessage({
        threadId: thread.id,
        role: "assistant",
        content: initialAssistantMessage,
      });
    }

    return Response.json({
      threadId: thread.id,
      title: thread.title ?? title,
    });
  } catch (error) {
    if (isChatPersistenceError(error)) {
      console.warn("/api/chat/threads POST persistence unavailable", error);

      return Response.json(
        { error: "대화 저장 기능이 아직 준비되지 않았습니다." },
        { status: 503 },
      );
    }

    console.error("/api/chat/threads POST error", error);

    return Response.json(
      { error: "새 대화를 만들지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      platform?: string;
      threadId?: string;
      title?: string;
    } | null;
    const userId = await getDbUserIdFromSession(
      resolveChatPlatform(body?.platform),
    );
    if (!userId) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const threadId = body?.threadId;
    const title = body?.title?.trim();
    if (!threadId || !/^\d+$/.test(threadId) || !title) {
      return Response.json(
        { error: "유효한 스레드와 제목이 필요합니다." },
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

    await updateChatThreadTitle(threadId, title);

    return Response.json({ ok: true, threadId, title });
  } catch (error) {
    if (isChatPersistenceError(error)) {
      console.warn("/api/chat/threads PATCH persistence unavailable", error);

      return Response.json(
        { error: "대화 저장 기능이 아직 준비되지 않았습니다." },
        { status: 503 },
      );
    }

    console.error("/api/chat/threads PATCH error", error);

    return Response.json(
      { error: "대화 제목을 수정하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      platform?: string;
      threadId?: string;
    } | null;
    const userId = await getDbUserIdFromSession(
      resolveChatPlatform(body?.platform),
    );
    if (!userId) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const threadId = body?.threadId;
    if (!threadId || !/^\d+$/.test(threadId)) {
      return Response.json(
        { error: "유효한 스레드가 필요합니다." },
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

    await deleteChatThread(threadId);

    return Response.json({ ok: true, threadId });
  } catch (error) {
    if (isChatPersistenceError(error)) {
      console.warn("/api/chat/threads DELETE persistence unavailable", error);

      return Response.json(
        { error: "대화 저장 기능이 아직 준비되지 않았습니다." },
        { status: 503 },
      );
    }

    console.error("/api/chat/threads DELETE error", error);

    return Response.json(
      { error: "대화를 삭제하지 못했습니다." },
      { status: 500 },
    );
  }
}
