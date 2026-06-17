import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { codingAuth } from "@/app/api/coding-auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

const VERIFY_PASSWORD_RATE_LIMIT = {
  limit: 5,
  windowMs: 60_000,
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const platform = body?.platform === "coding" ? "coding" : "log";
    const session = await (platform === "coding" ? codingAuth() : auth());
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "인증이 필요합니다." },
        { status: 401 },
      );
    }

    const forwardedFor = req.headers.get("x-forwarded-for");
    const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";
    const rateLimit = consumeRateLimit({
      key: `verify-password:${platform}:${session.user.id}:${ip}`,
      limit: VERIFY_PASSWORD_RATE_LIMIT.limit,
      windowMs: VERIFY_PASSWORD_RATE_LIMIT.windowMs,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
            "X-RateLimit-Limit": String(VERIFY_PASSWORD_RATE_LIMIT.limit),
            "X-RateLimit-Remaining": String(rateLimit.remaining),
          },
        },
      );
    }

    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : "";

    if (!currentPassword) {
      return NextResponse.json(
        { message: "현재 비밀번호를 입력해주세요." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(session.user.id) },
      select: {
        password: true,
        provider: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "사용자를 찾을 수 없습니다." },
        { status: 404 },
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

    const ok = await bcrypt.compare(currentPassword, user.password);

    return NextResponse.json(
      ok
        ? { ok: true, valid: true, message: "현재 비밀번호가 확인되었습니다." }
        : {
            ok: false,
            valid: false,
            message: "현재 비밀번호가 올바르지 않습니다.",
          },
      {
        status: ok ? 200 : 400,
        headers: {
          "X-RateLimit-Limit": String(VERIFY_PASSWORD_RATE_LIMIT.limit),
          "X-RateLimit-Remaining": String(rateLimit.remaining),
        },
      },
    );
  } catch {
    return NextResponse.json(
      { message: "비밀번호 확인에 실패했습니다." },
      { status: 500 },
    );
  }
}
