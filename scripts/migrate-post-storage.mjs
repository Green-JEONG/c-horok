import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_SOURCE_BUCKET = "post-thumbnails";
const STORAGE_URL_PATTERN =
  /https?:\/\/[^\s)"']+\/storage\/v1\/object\/(?:public|sign)\/[^/\s)"']+\/[^\s)"']+/g;
const BARE_LEGACY_PATH_PATTERN =
  /(?:thumbnails\/)?public\/(?:\d+|thumbnails|content|contents|attachments|chat|users|profile|profiles)\/[^\s)"']+/g;

function loadEnvFile(filePath, override = false) {
  const absolutePath = resolve(process.cwd(), filePath);
  if (!existsSync(absolutePath)) return;

  const source = readFileSync(absolutePath, "utf8");

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || (!override && process.env[key] !== undefined)) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function toJson(value) {
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );
}

function cleanPath(value) {
  return decodeURIComponent(value.split("?")[0]?.split("#")[0] ?? value);
}

function parseStorageUrl(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/,
    );

    if (!match) return null;

    return {
      sourceBucket: decodeURIComponent(match[1]),
      sourcePath: cleanPath(match[2]),
    };
  } catch {
    return null;
  }
}

function mapLegacyPath(sourcePath, context) {
  const path = cleanPath(sourcePath);
  const fileName = basename(path) || "file";

  if (path.startsWith("thumbnails/public/thumbnails/")) {
    return path.replace("thumbnails/public/thumbnails/", "thumbnails/");
  }

  if (path.startsWith("thumbnails/public/content/")) {
    return path.replace("thumbnails/public/content/", "contents/");
  }

  if (path.startsWith("thumbnails/public/contents/")) {
    return path.replace("thumbnails/public/contents/", "contents/");
  }

  if (path.startsWith("public/thumbnails/")) {
    return path.replace("public/thumbnails/", "thumbnails/");
  }

  if (path.startsWith("public/content/")) {
    return path.replace("public/content/", "contents/");
  }

  if (path.startsWith("public/contents/")) {
    return path.replace("public/contents/", "contents/");
  }

  if (path.startsWith("public/attachments/")) {
    return path.replace("public/attachments/", "attachments/");
  }

  if (path.startsWith("public/chat/")) {
    return path.replace("public/chat/", "contents/chat/");
  }

  if (path.startsWith("public/users/")) {
    return path.replace("public/users/", "users/");
  }

  if (/^public\/\d+\//.test(path)) {
    return path.replace(/^public\/(\d+)\//, "users/$1/");
  }

  if (context.kind === "profile") {
    return `users/${context.userId}/${fileName}`;
  }

  if (context.kind === "thumbnail") {
    return `thumbnails/${fileName}`;
  }

  if (context.kind === "attachment") {
    return `attachments/${fileName}`;
  }

  if (context.kind === "chat") {
    return `contents/chat/${fileName}`;
  }

  if (context.kind === "content") {
    return `contents/${fileName}`;
  }

  return null;
}

function createMigration(match, context) {
  const parsedUrl = parseStorageUrl(match);
  const sourceBucket = parsedUrl?.sourceBucket ?? DEFAULT_SOURCE_BUCKET;
  const sourcePath = normalizeLegacySourcePath(
    parsedUrl?.sourcePath ?? cleanPath(match),
  );

  if (
    !sourcePath.startsWith("public/") &&
    !sourcePath.startsWith("thumbnails/public/")
  ) {
    return null;
  }

  const targetPath = mapLegacyPath(sourcePath, context);

  if (!targetPath || targetPath === sourcePath) {
    return null;
  }

  return {
    sourceBucket,
    sourcePath,
    targetBucket: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "post",
    targetPath,
    replacement: targetPath,
  };
}

function normalizeLegacySourcePath(path) {
  const cleanedPath = cleanPath(path);

  if (cleanedPath.startsWith("thumbnails/public/")) {
    return cleanedPath.replace("thumbnails/public/", "public/");
  }

  return cleanedPath;
}

function migrateText(value, context, tasks) {
  if (!value) {
    return { value, changed: false };
  }

  let changed = false;
  const replaceMatch = (match) => {
    const migration = createMigration(match, context);

    if (!migration) {
      return match;
    }

    changed = true;
    tasks.set(
      `${migration.sourceBucket}\0${migration.sourcePath}\0${migration.targetPath}`,
      migration,
    );

    return migration.replacement;
  };

  return {
    value: value
      .replace(STORAGE_URL_PATTERN, replaceMatch)
      .replace(BARE_LEGACY_PATH_PATTERN, replaceMatch),
    changed,
  };
}

async function copyObject(supabase, task) {
  const { data, error: downloadError } = await supabase.storage
    .from(task.sourceBucket)
    .download(task.sourcePath);

  if (downloadError) {
    throw new Error(
      `Download failed: ${task.sourceBucket}/${task.sourcePath}: ${downloadError.message}`,
    );
  }

  const { error: uploadError } = await supabase.storage
    .from(task.targetBucket)
    .upload(task.targetPath, data, {
      contentType: data.type || undefined,
      upsert: false,
    });

  if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
    throw new Error(
      `Upload failed: ${task.targetBucket}/${task.targetPath}: ${uploadError.message}`,
    );
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local", true);

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL");
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

const apply = process.argv.includes("--apply");
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const targetBucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "post";
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

async function main() {
  const tasks = new Map();
  const updates = {
    users: [],
    logMembers: [],
    codingMembers: [],
    posts: [],
    comments: [],
    chatMessages: [],
    postAttachments: [],
  };

  const [
    users,
    logMembers,
    codingMembers,
    posts,
    comments,
    chatMessages,
    postAttachments,
  ] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, image: true, oauthImage: true },
    }),
    prisma.logMember.findMany({
      select: { id: true, userId: true, avatarUrl: true },
    }),
    prisma.codingMember.findMany({
      select: { id: true, userId: true, avatarUrl: true },
    }),
    prisma.post.findMany({
      select: { id: true, thumbnail: true, content: true },
    }),
    prisma.comment.findMany({
      select: { id: true, content: true },
    }),
    prisma.chatMessage.findMany({
      select: { id: true, content: true },
    }),
    prisma.postAttachment.findMany({
      select: { id: true, fileUrl: true },
    }),
  ]);

  for (const user of users) {
    const image = migrateText(
      user.image,
      {
        kind: "profile",
        userId: user.id.toString(),
      },
      tasks,
    );
    const oauthImage = migrateText(
      user.oauthImage,
      {
        kind: "profile",
        userId: user.id.toString(),
      },
      tasks,
    );

    if (image.changed || oauthImage.changed) {
      updates.users.push({
        id: user.id,
        image: image.value,
        oauthImage: oauthImage.value,
      });
    }
  }

  for (const member of logMembers) {
    const avatarUrl = migrateText(
      member.avatarUrl,
      {
        kind: "profile",
        userId: member.userId.toString(),
      },
      tasks,
    );

    if (avatarUrl.changed) {
      updates.logMembers.push({ id: member.id, avatarUrl: avatarUrl.value });
    }
  }

  for (const member of codingMembers) {
    const avatarUrl = migrateText(
      member.avatarUrl,
      {
        kind: "profile",
        userId: member.userId.toString(),
      },
      tasks,
    );

    if (avatarUrl.changed) {
      updates.codingMembers.push({ id: member.id, avatarUrl: avatarUrl.value });
    }
  }

  for (const post of posts) {
    const thumbnail = migrateText(post.thumbnail, { kind: "thumbnail" }, tasks);
    const content = migrateText(post.content, { kind: "content" }, tasks);

    if (thumbnail.changed || content.changed) {
      updates.posts.push({
        id: post.id,
        thumbnail: thumbnail.value,
        content: content.value,
      });
    }
  }

  for (const comment of comments) {
    const content = migrateText(comment.content, { kind: "content" }, tasks);

    if (content.changed) {
      updates.comments.push({ id: comment.id, content: content.value });
    }
  }

  for (const message of chatMessages) {
    const content = migrateText(message.content, { kind: "chat" }, tasks);

    if (content.changed) {
      updates.chatMessages.push({ id: message.id, content: content.value });
    }
  }

  for (const attachment of postAttachments) {
    const fileUrl = migrateText(
      attachment.fileUrl,
      {
        kind: "attachment",
      },
      tasks,
    );

    if (fileUrl.changed) {
      updates.postAttachments.push({
        id: attachment.id,
        fileUrl: fileUrl.value,
      });
    }
  }

  const summary = {
    apply,
    sourceBucket: DEFAULT_SOURCE_BUCKET,
    targetBucket,
    copyCount: tasks.size,
    updateCounts: Object.fromEntries(
      Object.entries(updates).map(([key, value]) => [key, value.length]),
    ),
    copies: Array.from(tasks.values()).map((task) => ({
      from: `${task.sourceBucket}/${task.sourcePath}`,
      to: `${task.targetBucket}/${task.targetPath}`,
    })),
  };

  if (!apply) {
    console.log(toJson(summary));
    return;
  }

  for (const task of tasks.values()) {
    await copyObject(supabase, task);
  }

  await prisma.$transaction([
    ...updates.users.map((user) =>
      prisma.user.update({
        where: { id: user.id },
        data: { image: user.image, oauthImage: user.oauthImage },
      }),
    ),
    ...updates.logMembers.map((member) =>
      prisma.logMember.update({
        where: { id: member.id },
        data: { avatarUrl: member.avatarUrl },
      }),
    ),
    ...updates.codingMembers.map((member) =>
      prisma.codingMember.update({
        where: { id: member.id },
        data: { avatarUrl: member.avatarUrl },
      }),
    ),
    ...updates.posts.map((post) =>
      prisma.post.update({
        where: { id: post.id },
        data: { thumbnail: post.thumbnail, content: post.content },
      }),
    ),
    ...updates.comments.map((comment) =>
      prisma.comment.update({
        where: { id: comment.id },
        data: { content: comment.content },
      }),
    ),
    ...updates.chatMessages.map((message) =>
      prisma.chatMessage.update({
        where: { id: message.id },
        data: { content: message.content },
      }),
    ),
    ...updates.postAttachments.map((attachment) =>
      prisma.postAttachment.update({
        where: { id: attachment.id },
        data: { fileUrl: attachment.fileUrl },
      }),
    ),
  ]);

  console.log(toJson({ ...summary, migrated: true }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
