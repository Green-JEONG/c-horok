import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { codingAuth } from "@/app/api/coding-auth/[...nextauth]/route";
import {
  checkPlatformNicknameAvailability,
  getCurrentPlatformProfile,
  updateCurrentPlatformProfile,
} from "@/lib/horok-coding-profile";
import { validateNickname } from "@/lib/nickname";
import { validatePassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

function parsePlatform(value: string | null) {
  return value === "coding" ? "coding" : "log";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = parsePlatform(searchParams.get("platform"));
  const profile = await getCurrentPlatformProfile(platform);

  if (!profile) {
    return NextResponse.json(null, { status: 401 });
  }

  return NextResponse.json(profile);
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const platform = parsePlatform(
      typeof body?.platform === "string" ? body.platform : null,
    );
    const session = await (platform === "coding" ? codingAuth() : auth());

    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const image =
      typeof body?.image === "string" && body.image.trim()
        ? body.image.trim()
        : undefined;
    const removeImage = body?.removeImage === true;
    const resetImage = body?.resetImage === true;
    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : null;
    const newPassword =
      typeof body?.newPassword === "string" ? body.newPassword : null;

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

      const availability = await checkPlatformNicknameAvailability(
        platform,
        name,
        session.user.id,
      );

      if (!availability.available) {
        return NextResponse.json(
          { message: availability.message },
          { status: 409 },
        );
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      select: {
        id: true,
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

    let passwordToSave: string | null = null;

    if (newPassword) {
      const passwordValidationMessage = validatePassword(newPassword);

      if (passwordValidationMessage) {
        return NextResponse.json(
          { message: passwordValidationMessage },
          { status: 400 },
        );
      }

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

    if (passwordToSave) {
      await prisma.user.update({
        where: { id: BigInt(session.user.id) },
        data: { password: passwordToSave },
      });
    }

    const shouldUpdateImage = resetImage || removeImage || image !== undefined;
    const nextImage = resetImage
      ? (user.oauthImage ?? null)
      : removeImage
        ? null
        : image;

    const userData: {
      name?: string;
      image?: string | null;
    } = {};

    if (name) {
      userData.name = name;
    }

    if (shouldUpdateImage) {
      userData.image = nextImage ?? null;
    }

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: BigInt(session.user.id) },
        data: userData,
      });
    }

    const profile = await updateCurrentPlatformProfile(platform, {
      name: name || undefined,
      ...(shouldUpdateImage ? { image: nextImage ?? null } : {}),
    });

    return NextResponse.json({
      ok: true,
      image: shouldUpdateImage
        ? (profile?.image ?? nextImage ?? null)
        : undefined,
      name: profile?.name ?? name,
    });
  } catch {
    return NextResponse.json({ message: "프로필 수정 실패" }, { status: 500 });
  }
}
