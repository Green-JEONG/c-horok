import { google } from "@ai-sdk/google";
import { Prisma } from "@prisma/client";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import { getDbUserIdFromSession } from "@/lib/auth-db";
import {
  appendChatMessage,
  createChatThread,
  getChatMessages,
  getChatThreadById,
  getLatestChatThreadByUserId,
  listChatThreadsByUserId,
  updateChatThreadTitle,
} from "@/lib/chat";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

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

function getMessageText(
  parts: Array<{ type: string; text?: string; state?: string }> = [],
) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function buildThreadTitle(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 60) || null;
}

function buildChatSystemPrompt(platform: "log" | "coding") {
  return [
    "답변은 항상 한국어로 작성한다.",
    "친절하고 간결하게 답하되, 필요한 경우에는 핵심을 짧게 정리한다.",
    "답변에 유머를 섞어도 좋지만, 지나치게 가볍거나 진지하지 않도록 주의한다.",
    "너의 성별은 비밀이다.",
    "너의 생년월일은 2024년 8월 2일이다.",
    "너를 만든 사람은 그린님이다",
    "너는 호록 컴퍼니의 마스코트 호록이이자, 호록 컴퍼니의 제품과 서비스에 대한 질문에 답변하는 역할을 한다.",
    "너의 종은 동물 호랑이이다.",
    "너의 MBTI는 ENFP이다.",
    "너는 기술을 쉽고 창의적인 콘텐츠로 전달하는 역할을 한다.",
    "코딩테스트 및 알고리즘 문제 풀이에 대한 질문에도 친절하게 답변한다.",
    "현재 Python을 가지고 코딩테스트를 준비하는 사람들에게 도움이 되기 위해 교육 영상을 준비 중이다.",
    platform === "coding"
      ? [
          "horok-coding 문제별 채팅방에서는 이전 대화에 포함된 문제 설명, 핵심 요구사항, 예제, 사용자의 질문을 문제 맥락으로 삼아 답한다.",
          "사용자가 풀이 코드나 코드 일부를 보여주면 먼저 해당 문제 요구사항에 비추어 잘한 점을 구체적으로 짚어 준다.",
          "코드가 정답에 가깝거나 좋은 접근이라면 어떤 아이디어, 자료구조, 조건 처리, 복잡도 선택이 적절했는지 설명한다.",
          "더 최적의 풀이가 있다면 최적화 방향을 설명하고, 가능하면 Python 기준의 개선된 코드와 풀이 방식, 시간/공간 복잡도를 함께 제시한다.",
          "코드에 오류나 반례 가능성이 있으면 비난하지 말고 원인, 반례, 수정 방향을 단계적으로 알려준다.",
          "사용자가 명시적으로 전체 정답을 원하지 않은 경우에는 먼저 힌트와 개선 포인트를 주고, 정답 코드가 필요하면 이어서 제공한다.",
        ].join(" ")
      : null,
    "너는 물어본 것만 간결하게 대답한다.",
  ]
    .filter(Boolean)
    .join(" ");
}

async function isAdminUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { role: true },
  });

  return user?.role === "ADMIN";
}

async function canAdminViewHandoffThread(userId: number, threadId: string) {
  if (!(await isAdminUser(userId))) {
    return false;
  }

  const handoff = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id
    FROM public.chat_handoffs
    WHERE thread_id = ${BigInt(threadId)}
    LIMIT 1
  `;

  return handoff.length > 0;
}

async function listHandoffThreadsForAdmin(userId: number) {
  if (!(await isAdminUser(userId))) {
    return [];
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: bigint;
      title: string | null;
      created_at: Date;
      updated_at: Date;
      preview: string | null;
      message_count: bigint;
      requester_name: string | null;
      requester_email: string;
    }>
  >`
    SELECT DISTINCT ON (thread.id)
      thread.id,
      thread.title,
      thread.created_at,
      thread.updated_at,
      latest_message.content AS preview,
      COUNT(message.id) OVER (PARTITION BY thread.id) AS message_count,
      requester.name AS requester_name,
      requester.email AS requester_email
    FROM public.chat_handoffs AS handoff
    INNER JOIN public.chat_threads AS thread
      ON thread.id = handoff.thread_id
    INNER JOIN public.users AS requester
      ON requester.id = handoff.user_id
    LEFT JOIN public.chat_messages AS message
      ON message.thread_id = thread.id
    LEFT JOIN LATERAL (
      SELECT content
      FROM public.chat_messages
      WHERE thread_id = thread.id
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) AS latest_message ON TRUE
    WHERE handoff.status <> 'archived'
    ORDER BY thread.id, handoff.created_at DESC
  `;

  return rows
    .map((row) => {
      const requesterName = row.requester_name?.trim() || row.requester_email;
      const title = row.title?.trim() || "문의 대화";

      return {
        id: row.id.toString(),
        title: `[${requesterName}] ${title}`,
        preview: row.preview?.replace(/\s+/g, " ").trim().slice(0, 80) ?? "",
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        messageCount: Number(row.message_count),
        platform: "handoff" as const,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function getChatHandoffMeta(userId: number, threadId: string) {
  const viewer = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
    select: { role: true },
  });

  if (viewer?.role !== "ADMIN") {
    return null;
  }

  const handoffs = await prisma.$queryRaw<
    Array<{
      user_id: bigint;
      name: string | null;
      email: string;
      image: string | null;
      oauth_image: string | null;
    }>
  >`
    SELECT
      requester.id AS user_id,
      requester.name,
      requester.email,
      requester.image,
      requester.oauth_image
    FROM public.chat_handoffs AS handoff
    INNER JOIN public.users AS requester
      ON requester.id = handoff.user_id
    WHERE handoff.thread_id = ${BigInt(threadId)}
    ORDER BY handoff.created_at DESC
    LIMIT 1
  `;
  const handoff = handoffs[0];

  if (!handoff) {
    return null;
  }

  return {
    isAdminView: true,
    requester: {
      id: handoff.user_id.toString(),
      name: handoff.name ?? handoff.email,
      image: handoff.image ?? handoff.oauth_image ?? null,
    },
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const platform = resolveChatPlatform(url.searchParams.get("platform"));
    const userId = await getDbUserIdFromSession(platform);
    if (!userId) {
      return Response.json({
        isAuthenticated: false,
        activeThreadId: null,
        threads: [],
        messages: [],
      });
    }

    const requestedThreadId = url.searchParams.get("threadId");
    const [ownThreads, handoffThreads] = await Promise.all([
      listChatThreadsByUserId(userId),
      listHandoffThreadsForAdmin(userId),
    ]);
    const threads = [...ownThreads, ...handoffThreads];

    const requestedThread =
      requestedThreadId && /^\d+$/.test(requestedThreadId)
        ? ((await getChatThreadById(userId, requestedThreadId)) ??
          ((await canAdminViewHandoffThread(userId, requestedThreadId))
            ? { id: requestedThreadId, title: null }
            : null))
        : null;

    const activeThread =
      requestedThread ??
      (threads.length > 0 ? await getLatestChatThreadByUserId(userId) : null);

    const messages = activeThread ? await getChatMessages(activeThread.id) : [];
    const handoff = activeThread
      ? await getChatHandoffMeta(userId, activeThread.id)
      : null;

    return Response.json({
      isAuthenticated: true,
      activeThreadId: activeThread?.id ?? null,
      threads,
      messages,
      handoff,
    });
  } catch (error) {
    if (isChatPersistenceError(error)) {
      console.warn("/api/chat GET persistence unavailable", error);

      return Response.json({
        isAuthenticated: true,
        activeThreadId: null,
        threads: [],
        messages: [],
      });
    }

    console.error("/api/chat GET error", error);

    return Response.json(
      { error: "대화 내역을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const {
      message,
      threadId,
      platform,
    }: {
      message?: UIMessage;
      threadId?: string | null;
      platform?: string | null;
    } = await req.json();

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY is not configured." },
        { status: 500 },
      );
    }

    const userText = getMessageText(message?.parts);
    if (!message || message.role !== "user" || !userText) {
      return Response.json(
        { error: "유효한 사용자 메시지가 필요합니다." },
        { status: 400 },
      );
    }

    const resolvedPlatform = resolveChatPlatform(platform);
    const userId = await getDbUserIdFromSession(resolvedPlatform);
    let persistedThreadId: string | null = null;
    let previousMessages: UIMessage[] = [];

    if (userId) {
      try {
        const selectedThread =
          threadId && /^\d+$/.test(threadId)
            ? await getChatThreadById(userId, threadId)
            : null;

        const thread = selectedThread ?? (await createChatThread(userId));
        persistedThreadId = thread.id;
        previousMessages = await getChatMessages(thread.id);

        await appendChatMessage({
          threadId: thread.id,
          role: "user",
          content: userText,
        });

        if (!thread.title || thread.title === "새 대화") {
          await updateChatThreadTitle(thread.id, buildThreadTitle(userText));
        }
      } catch (error) {
        if (!isChatPersistenceError(error)) {
          throw error;
        }

        console.warn("/api/chat POST persistence unavailable", error);
      }
    }

    const allMessages = [...previousMessages, message];

    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: buildChatSystemPrompt(resolvedPlatform),
      messages: await convertToModelMessages(allMessages),
    });

    void result.consumeStream();

    return result.toUIMessageStreamResponse({
      originalMessages: allMessages,
      headers: persistedThreadId
        ? {
            "x-chat-thread-id": persistedThreadId,
          }
        : undefined,
      onFinish: async ({ responseMessage, isAborted }) => {
        if (!persistedThreadId || isAborted) {
          return;
        }

        const assistantText = getMessageText(responseMessage.parts);
        if (!assistantText) {
          return;
        }

        try {
          await appendChatMessage({
            threadId: persistedThreadId,
            role: "assistant",
            content: assistantText,
          });
        } catch (error) {
          if (!isChatPersistenceError(error)) {
            console.error("/api/chat assistant persistence error", error);
            return;
          }

          console.warn("/api/chat assistant persistence unavailable", error);
        }
      },
    });
  } catch (error) {
    console.error("/api/chat error", error);

    return Response.json(
      { error: "챗봇 응답을 생성하지 못했습니다." },
      { status: 500 },
    );
  }
}
