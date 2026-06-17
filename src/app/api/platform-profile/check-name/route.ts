import { NextResponse } from "next/server";
import { checkPlatformNicknameAvailability } from "@/lib/horok-coding-profile";
import { normalizeNickname, validateNickname } from "@/lib/nickname";

function parsePlatform(value: string | null) {
  return value === "coding" ? "coding" : "log";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const platform = parsePlatform(searchParams.get("platform"));
  const name = normalizeNickname(searchParams.get("name") ?? "");
  const excludeUserId = searchParams.get("excludeUserId") ?? undefined;

  const validationMessage = validateNickname(name);

  if (validationMessage) {
    return NextResponse.json(
      { available: false, message: validationMessage },
      { status: 400 },
    );
  }

  const result = await checkPlatformNicknameAvailability(
    platform,
    name,
    excludeUserId,
  );

  return NextResponse.json(result);
}
