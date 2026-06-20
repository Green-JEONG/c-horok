export const POST_SECRET_PASSWORD_MIN_LENGTH = 4;
export const POST_SECRET_PASSWORD_MAX_LENGTH = 128;

export function validatePostSecretPassword(password: string) {
  const trimmed = password.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.length < POST_SECRET_PASSWORD_MIN_LENGTH) {
    return `비밀글 비밀번호는 ${POST_SECRET_PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  }

  if (trimmed.length > POST_SECRET_PASSWORD_MAX_LENGTH) {
    return `비밀글 비밀번호는 ${POST_SECRET_PASSWORD_MAX_LENGTH}자 이하여야 합니다.`;
  }

  return null;
}

export type PostSecretPasswordMeta = {
  isSecret: boolean;
  hasSecretPassword: boolean;
  secretPasswordHash: string | null;
};

export function canViewSecretPost(params: {
  isSecret: boolean;
  ownerUserId: number;
  viewerUserId?: number | null;
  isAdmin?: boolean;
  categoryName?: string | null;
  hasSecretPasswordAccess?: boolean;
}) {
  if (!params.isSecret) {
    return true;
  }

  if (params.hasSecretPasswordAccess) {
    return true;
  }

  if (
    typeof params.viewerUserId === "number" &&
    params.ownerUserId === params.viewerUserId
  ) {
    return true;
  }

  const isSecretQna = params.categoryName === "QnA" && params.isSecret;

  if (isSecretQna && params.isAdmin) {
    return true;
  }

  return false;
}
