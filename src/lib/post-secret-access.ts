import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { PostSecretPasswordMeta } from "@/lib/post-secret-password";
import { prisma } from "@/lib/prisma";

export type { PostSecretPasswordMeta } from "@/lib/post-secret-password";
export {
  canViewSecretPost,
  POST_SECRET_PASSWORD_MAX_LENGTH,
  POST_SECRET_PASSWORD_MIN_LENGTH,
  validatePostSecretPassword,
} from "@/lib/post-secret-password";

const POST_SECRET_ACCESS_COOKIE_PREFIX = "horok-post-secret-";
const POST_SECRET_ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

let hasEnsuredPostSecretPasswordColumn = false;

function getPostSecretAccessKey() {
  return (
    process.env.POST_SECRET_ACCESS_KEY ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "horok-post-secret-access-dev-key"
  );
}

export async function ensurePostSecretPasswordColumn() {
  if (hasEnsuredPostSecretPasswordColumn) {
    return;
  }

  await prisma.$executeRaw`
    ALTER TABLE horok_log.posts
    ADD COLUMN IF NOT EXISTS secret_password_hash VARCHAR(255)
  `;

  hasEnsuredPostSecretPasswordColumn = true;
}

export async function hashPostSecretPassword(password: string) {
  return bcrypt.hash(password.trim(), 10);
}

export async function verifyPostSecretPassword(
  password: string,
  secretPasswordHash: string | null | undefined,
) {
  if (!secretPasswordHash) {
    return false;
  }

  return bcrypt.compare(password.trim(), secretPasswordHash);
}

function createPostSecretAccessToken(
  postId: number,
  secretPasswordHash: string,
) {
  return createHmac("sha256", getPostSecretAccessKey())
    .update(`${postId}:${secretPasswordHash}`)
    .digest("base64url");
}

function isValidPostSecretAccessToken(
  postId: number,
  token: string,
  secretPasswordHash: string,
) {
  const expected = createPostSecretAccessToken(postId, secretPasswordHash);
  const actualBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function getPostSecretAccessCookieName(postId: number) {
  return `${POST_SECRET_ACCESS_COOKIE_PREFIX}${postId}`;
}

export async function hasPostSecretAccess(
  postId: number,
  secretPasswordHash: string | null | undefined,
) {
  if (!secretPasswordHash) {
    return false;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(getPostSecretAccessCookieName(postId))?.value;

  if (!token) {
    return false;
  }

  return isValidPostSecretAccessToken(postId, token, secretPasswordHash);
}

export function buildPostSecretAccessCookie(
  postId: number,
  secretPasswordHash: string,
) {
  return {
    name: getPostSecretAccessCookieName(postId),
    value: createPostSecretAccessToken(postId, secretPasswordHash),
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: POST_SECRET_ACCESS_COOKIE_MAX_AGE_SECONDS,
  };
}

export async function getPostSecretPasswordMeta(
  postId: number,
): Promise<PostSecretPasswordMeta | null> {
  await ensurePostSecretPasswordColumn();

  const post = await prisma.post.findUnique({
    where: { id: BigInt(postId) },
    select: {
      isSecret: true,
      secretPasswordHash: true,
    },
  });

  if (!post) {
    return null;
  }

  return {
    isSecret: post.isSecret,
    hasSecretPassword: Boolean(post.secretPasswordHash),
    secretPasswordHash: post.secretPasswordHash,
  };
}
