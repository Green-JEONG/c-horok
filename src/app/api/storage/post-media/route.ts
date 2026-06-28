import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { codingAuth } from "@/app/api/coding-auth/[...nextauth]/route";
import { createProfileImagePath } from "@/lib/profile-images";
import {
  removePostStorageFiles,
  uploadPostStorageFile,
} from "@/lib/post-storage.server";
import {
  createPostAttachmentPath,
  createPostContentImagePath,
  createPostThumbnailPath,
} from "@/lib/post-thumbnails";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

function sanitizeFileName(fileName: string) {
  return (
    fileName
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "image"
  );
}

function createChatImagePath(fileName: string) {
  return `contents/chat/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
}

function createStoragePath(
  kind: string | null,
  fileName: string,
  userId: string,
) {
  if (kind === "profile") {
    return createProfileImagePath(userId, fileName);
  }

  if (kind === "chat") {
    return createChatImagePath(fileName);
  }

  if (kind === "thumbnail") {
    return createPostThumbnailPath(fileName);
  }

  if (kind === "attachment") {
    return createPostAttachmentPath(fileName);
  }

  return createPostContentImagePath(fileName);
}

export async function POST(request: Request) {
  const session = (await auth()) ?? (await codingAuth());

  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const kindValue = formData?.get("kind");
  const kind = typeof kindValue === "string" ? kindValue : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "File required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { message: "파일은 최대 20MB까지 업로드할 수 있습니다." },
      { status: 400 },
    );
  }

  const result = await uploadPostStorageFile({
    path: createStoragePath(kind, file.name, session.user.id),
    file,
  });

  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = (await auth()) ?? (await codingAuth());

  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const paths = Array.isArray(body?.paths)
    ? body.paths.filter(
        (path: unknown): path is string => typeof path === "string",
      )
    : [];

  await removePostStorageFiles(paths);

  return NextResponse.json({ ok: true });
}
