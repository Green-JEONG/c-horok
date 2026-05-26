import type { UIMessage } from "ai";

import { prisma } from "@/lib/prisma";

type ChatRole = "user" | "assistant";
type ChatThreadDelegate = typeof prisma.chatThread;

export type ChatThreadSummary = {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

function getChatThreadDelegate() {
  const delegate = (prisma as typeof prisma & { chatThread?: unknown })
    .chatThread;

  if (!delegate) {
    throw new Error("CHAT_PERSISTENCE_CLIENT_OUTDATED");
  }

  return delegate as ChatThreadDelegate;
}

function toPreviewText(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 80);
}

function getThreadDisplayTitle(title: string | null) {
  if (title?.trim()) {
    return title.trim();
  }

  return "새 대화";
}

function formatChatMessage(message: {
  id: bigint;
  role: ChatRole;
  content: string;
  createdAt: Date;
  senderUserId?: bigint | null;
  senderName?: string | null;
  senderEmail?: string | null;
  senderImage?: string | null;
  senderOauthImage?: string | null;
  senderRole?: "USER" | "ADMIN" | null;
}): UIMessage & {
  createdAt: string;
  sender?: {
    id: string;
    name: string;
    image: string | null;
    role: "USER" | "ADMIN";
  } | null;
} {
  return {
    id: message.id.toString(),
    role: message.role,
    createdAt: message.createdAt.toISOString(),
    sender: message.senderUserId
      ? {
          id: message.senderUserId.toString(),
          name: message.senderName ?? message.senderEmail ?? "사용자",
          image: message.senderImage ?? message.senderOauthImage ?? null,
          role: message.senderRole ?? "USER",
        }
      : null,
    parts: [
      {
        type: "text",
        text: message.content,
      },
    ],
  };
}

export async function createChatThread(userId: number, title?: string | null) {
  const thread = await getChatThreadDelegate().create({
    data: {
      userId: BigInt(userId),
      title: title ?? null,
    },
    select: {
      id: true,
      title: true,
    },
  });

  return {
    id: thread.id.toString(),
    title: thread.title,
  };
}

export async function getLatestChatThreadByUserId(userId: number) {
  const thread = await getChatThreadDelegate().findFirst({
    where: {
      userId: BigInt(userId),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
    },
  });

  if (!thread) {
    return null;
  }

  return {
    id: thread.id.toString(),
    title: thread.title,
  };
}

export async function getChatThreadById(userId: number, threadId: string) {
  const thread = await getChatThreadDelegate().findFirst({
    where: {
      id: BigInt(threadId),
      userId: BigInt(userId),
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (!thread) {
    return null;
  }

  return {
    id: thread.id.toString(),
    title: thread.title,
  };
}

export async function listChatThreadsByUserId(userId: number) {
  const threads = await getChatThreadDelegate().findMany({
    where: {
      userId: BigInt(userId),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          content: true,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
  });

  return threads.map((thread): ChatThreadSummary => {
    const preview = toPreviewText(thread.messages[0]?.content ?? "");

    return {
      id: thread.id.toString(),
      title: getThreadDisplayTitle(thread.title),
      preview,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      messageCount: thread._count.messages,
    };
  });
}

export async function updateChatThreadTitle(
  threadId: string,
  title?: string | null,
) {
  await getChatThreadDelegate().update({
    where: { id: BigInt(threadId) },
    data: { title: title ?? null },
  });
}

export async function deleteChatThread(threadId: string) {
  await getChatThreadDelegate().delete({
    where: { id: BigInt(threadId) },
  });
}

export async function getChatMessages(threadId: string) {
  const messages = await prisma.$queryRaw<
    Array<{
      id: bigint;
      role: ChatRole;
      content: string;
      created_at: Date;
      sender_user_id: bigint | null;
      sender_name: string | null;
      sender_email: string | null;
      sender_image: string | null;
      sender_oauth_image: string | null;
      sender_role: "USER" | "ADMIN" | null;
    }>
  >`
    SELECT
      message.id,
      message.role,
      message.content,
      message.created_at,
      message.sender_user_id,
      sender.name AS sender_name,
      sender.email AS sender_email,
      sender.image AS sender_image,
      sender.oauth_image AS sender_oauth_image,
      sender.role AS sender_role
    FROM public.chat_messages AS message
    LEFT JOIN public.users AS sender
      ON sender.id = message.sender_user_id
    WHERE message.thread_id = ${BigInt(threadId)}
    ORDER BY message.created_at ASC, message.id ASC
  `;

  return messages.map((message) =>
    formatChatMessage({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
      senderUserId: message.sender_user_id,
      senderName: message.sender_name,
      senderEmail: message.sender_email,
      senderImage: message.sender_image,
      senderOauthImage: message.sender_oauth_image,
      senderRole: message.sender_role,
    }),
  );
}

export async function appendChatMessage(params: {
  threadId: string;
  role: ChatRole;
  content: string;
  senderUserId?: number | string | bigint | null;
}) {
  const chatThread = getChatThreadDelegate();
  const senderUserId =
    params.senderUserId === null || params.senderUserId === undefined
      ? null
      : BigInt(params.senderUserId);

  await prisma.$transaction([
    prisma.$executeRaw`
      INSERT INTO public.chat_messages (
        thread_id,
        sender_user_id,
        role,
        content
      )
      VALUES (
        ${BigInt(params.threadId)},
        ${senderUserId},
        ${params.role}::public."ChatMessageRole",
        ${params.content}
      )
    `,
    chatThread.update({
      where: { id: BigInt(params.threadId) },
      data: {
        updatedAt: new Date(),
      },
    }),
  ]);
}
