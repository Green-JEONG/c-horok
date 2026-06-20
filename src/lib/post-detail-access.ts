import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getDbUserIdFromSession } from "@/lib/auth-db";
import { findPostById } from "@/lib/db";
import { getPostById } from "@/lib/posts";
import {
  getPostSecretPasswordMeta,
  hasPostSecretAccess,
} from "@/lib/post-secret-access";

export async function loadPostDetailAccess(postId: number) {
  const dbUserId = await getDbUserIdFromSession();
  const session = await auth();
  const secretMeta = await getPostSecretPasswordMeta(postId);
  const hasPasswordAccess = secretMeta?.secretPasswordHash
    ? await hasPostSecretAccess(postId, secretMeta.secretPasswordHash)
    : false;

  const post = await findPostById(postId, {
    includeHiddenForUserId: dbUserId,
    includeHiddenForAdmin: session?.user?.role === "ADMIN",
    hasSecretPasswordAccess: hasPasswordAccess,
  });

  return {
    post,
    dbUserId,
    session,
    secretMeta,
    hasPasswordAccess,
  };
}

export async function getPostByIdWithSecretAccess(
  postId: number,
  options?: {
    includeHiddenForUserId?: number | null;
    includeHiddenForAdmin?: boolean;
  },
) {
  const secretMeta = await getPostSecretPasswordMeta(postId);
  const hasPasswordAccess = secretMeta?.secretPasswordHash
    ? await hasPostSecretAccess(postId, secretMeta.secretPasswordHash)
    : false;

  return getPostById(postId, {
    ...options,
    hasSecretPasswordAccess: hasPasswordAccess,
  });
}
