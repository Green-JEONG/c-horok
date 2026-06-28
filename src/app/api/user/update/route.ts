import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { findUserByName } from "@/lib/db";
import { normalizeNickname, validateNickname } from "@/lib/nickname";
import { validatePassword } from "@/lib/password";
import {
  createPostStorageSignedUrl,
  normalizePostStorageReference,
} from "@/lib/post-storage.server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const name = normalizeNickname(
      typeof body?.name === "string" ? body.name : "",
    );
    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : null;
    const newPassword =
      typeof body?.newPassword === "string" ? body.newPassword : null;
    const image =
      typeof body?.image === "string" && body.image.trim()
        ? normalizePostStorageReference(body.image.trim())
        : null;
    const removeImage = body?.removeImage === true;
    const resetImage = body?.resetImage === true;

    // 이름만 바꾸는 것도 허용
    if (!name && !newPassword && !image && !removeImage && !resetImage) {
      return NextResponse.json(
        { message: "수정할 값이 없습니다." },
        { status: 400 },
      );
    }

    if (name) {
      const nicknameValidationMessage = validateNickname(name);
      if (nicknameValidationMessage) {
        return NextResponse.json(
          { message: nicknameValidationMessage },
          { status: 400 },
        );
      }

      const duplicateNameUser = await findUserByName(name, session.user.id);
      if (duplicateNameUser) {
        return NextResponse.json(
          { message: "이미 사용 중인 닉네임입니다." },
          { status: 409 },
        );
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      select: {
        id: true,
        image: true,
        password: true,
        provider: true,
        oauthImage: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "사용자를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    // 비번 변경 요청이 있으면 검증
    let passwordToSave: string | null = null;

    if (newPassword) {
      const passwordValidationMessage = validatePassword(newPassword);
      if (passwordValidationMessage) {
        return NextResponse.json(
          { message: passwordValidationMessage },
          { status: 400 },
        );
      }

      // credentials 사용자만 비번 변경 가능 (oauth는 원칙적으로 불가)
      if (user.provider !== "credentials") {
        return NextResponse.json(
          { message: "소셜 로그인 계정은 비밀번호를 변경할 수 없습니다." },
          { status: 400 },
        );
      }
      if (!user.password) {
        return NextResponse.json(
          { message: "비밀번호 정보가 없습니다." },
          { status: 400 },
        );
      }
      if (!currentPassword) {
        return NextResponse.json(
          { message: "현재 비밀번호를 입력해주세요." },
          { status: 400 },
        );
      }

      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) {
        return NextResponse.json(
          { message: "현재 비밀번호가 올바르지 않습니다." },
          { status: 400 },
        );
      }

      if (currentPassword === newPassword) {
        return NextResponse.json(
          { message: "현재 비밀번호와 다른 비밀번호를 입력해 주세요." },
          { status: 400 },
        );
      }

      passwordToSave = await bcrypt.hash(newPassword, 10);
    }

    const data: {
      name?: string;
      password?: string;
      image?: string | null;
    } = {};

    if (name) {
      data.name = name;
    }

    if (passwordToSave) {
      data.password = passwordToSave;
    }

    if (resetImage) {
      if (user.provider !== "github" && user.provider !== "google") {
        return NextResponse.json(
          { message: "SNS 로그인 계정만 기본 사진으로 초기화할 수 있습니다." },
          { status: 400 },
        );
      }

      if (!user.oauthImage) {
        return NextResponse.json(
          {
            message:
              "SNS 기본 프로필 사진 정보가 없습니다. 로그아웃 후 다시 SNS 로그인한 뒤 초기화를 시도해주세요.",
          },
          { status: 409 },
        );
      }

      data.image = user.oauthImage;
    } else if (removeImage) {
      data.image = null;
    } else if (image) {
      data.image = image;
    }

    await prisma.user.update({
      where: { id: BigInt(session.user.id) },
      data,
    });

    return NextResponse.json({
      ok: true,
      image: await createPostStorageSignedUrl(
        data.image !== undefined ? data.image : user.image,
      ),
    });
  } catch {
    return NextResponse.json({ message: "계정 수정 실패" }, { status: 500 });
  }
}
