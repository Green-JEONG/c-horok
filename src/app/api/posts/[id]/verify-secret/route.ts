import { NextResponse } from "next/server";
import {
  buildPostSecretAccessCookie,
  getPostSecretPasswordMeta,
  validatePostSecretPassword,
  verifyPostSecretPassword,
} from "@/lib/post-secret-access";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    return NextResponse.json({ message: "Invalid post id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const password =
    typeof body?.password === "string" ? body.password.trim() : "";

  const validationMessage = validatePostSecretPassword(password);

  if (validationMessage) {
    return NextResponse.json({ message: validationMessage }, { status: 400 });
  }

  const secretMeta = await getPostSecretPasswordMeta(postId);

  if (!secretMeta?.isSecret || !secretMeta.secretPasswordHash) {
    return NextResponse.json(
      { message: "비밀번호로 열 수 있는 게시물이 아닙니다." },
      { status: 400 },
    );
  }

  const isValid = await verifyPostSecretPassword(
    password,
    secretMeta.secretPasswordHash,
  );

  if (!isValid) {
    return NextResponse.json(
      { message: "비밀번호가 올바르지 않습니다." },
      { status: 403 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    buildPostSecretAccessCookie(postId, secretMeta.secretPasswordHash),
  );

  return response;
}
