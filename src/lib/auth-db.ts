import { auth } from "@/app/api/auth/[...nextauth]/route";
import { codingAuth } from "@/app/api/coding-auth/[...nextauth]/route";
import { getUserIdByEmail } from "@/lib/db";

type AuthPlatform = "log" | "coding";

async function getSessionByPlatform(platform: AuthPlatform) {
  return platform === "coding" ? codingAuth() : auth();
}

export async function requireDbUserId(
  platform: AuthPlatform = "log",
): Promise<number> {
  const session = await getSessionByPlatform(platform);
  if (!session?.user?.email) {
    throw new Error("Unauthenticated");
  }

  const userId = await getUserIdByEmail(session.user.email);
  if (!userId) {
    throw new Error("User not found");
  }

  return userId;
}

export async function getDbUserIdFromSession(platform: AuthPlatform = "log") {
  const session = await getSessionByPlatform(platform);
  if (!session?.user?.email) return null;

  return getUserIdByEmail(session.user.email);
}
