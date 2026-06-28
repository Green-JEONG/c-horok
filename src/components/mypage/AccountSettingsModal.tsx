"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useNicknameAvailability } from "@/components/auth/useNicknameAvailability";
import {
  getPlatformFromPathname,
  usePlatformProfile,
} from "@/components/mypage/usePlatformProfile";
import { validatePassword } from "@/lib/password";
import { normalizePostStorageReference } from "@/lib/post-storage";
import { removePostMedia, uploadPostMedia } from "@/lib/post-storage-client";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
};

export default function AccountSettingsModal({
  open,
  onClose,
  onSaved,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const platform = getPlatformFromPathname(pathname);
  const { data: session, update: updateSession } = useSession();
  const { profile, refresh } = usePlatformProfile(open);
  const isSocialAccount =
    session?.user?.provider === "github" ||
    session?.user?.provider === "google";

  const initialName = useMemo(
    () => profile?.name ?? session?.user?.name ?? "",
    [profile?.name, session?.user?.name],
  );
  const initialImage = useMemo(
    () => profile?.image ?? session?.user?.image ?? null,
    [profile?.image, session?.user?.image],
  );
  const initialOauthImage = useMemo(
    () => session?.user?.oauthImage ?? null,
    [session?.user?.oauthImage],
  );

  const [name, setName] = useState(initialName);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImage);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(
    initialImage,
  );
  const [imagePath, setImagePath] = useState<string | null>(
    normalizePostStorageReference(initialImage),
  );
  const [resetImageRequested, setResetImageRequested] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordCheckStatus, setPasswordCheckStatus] = useState<
    "idle" | "checking" | "valid" | "invalid" | "error"
  >("idle");
  const [passwordCheckMessage, setPasswordCheckMessage] = useState<
    string | null
  >(null);
  const nickname = useNicknameAvailability({
    nickname: name,
    excludeUserId: session?.user?.id,
    initialNickname: initialName,
    enabled: open,
    platform,
  });
  const isNicknameUnavailable =
    nickname.status === "taken" ||
    nickname.status === "invalid" ||
    nickname.status === "error";
  const isDuplicateNickname = nickname.status === "taken";
  const isNicknameChanged = nickname.normalizedNickname !== initialName.trim();
  const isPasswordChangeRequested = Boolean(newPassword || newPasswordConfirm);
  const hasCurrentPasswordInput = Boolean(currentPassword);
  const hasPasswordConfirmation = Boolean(newPasswordConfirm);
  const newPasswordValidationMessage = newPassword
    ? validatePassword(newPassword)
    : null;
  const isNewPasswordValid = !newPasswordValidationMessage;
  const isNewPasswordMatched =
    isPasswordChangeRequested &&
    hasPasswordConfirmation &&
    Boolean(newPassword) &&
    isNewPasswordValid &&
    newPassword === newPasswordConfirm;
  const isNewPasswordMismatch =
    isPasswordChangeRequested &&
    hasPasswordConfirmation &&
    isNewPasswordValid &&
    newPassword !== newPasswordConfirm;
  const isSameAsCurrentPassword =
    isPasswordChangeRequested &&
    Boolean(currentPassword) &&
    Boolean(newPassword) &&
    currentPassword === newPassword;
  const isCurrentPasswordVerified =
    !isPasswordChangeRequested || passwordCheckStatus === "valid";
  const isImageChanged = imageUrl !== initialImage;
  const hasNoChanges =
    !isNicknameChanged &&
    !isPasswordChangeRequested &&
    !isImageChanged &&
    !resetImageRequested;
  const isSaveDisabled =
    loading ||
    isUploadingImage ||
    hasNoChanges ||
    nickname.isChecking ||
    isDuplicateNickname ||
    isSameAsCurrentPassword ||
    (isPasswordChangeRequested && !isNewPasswordValid) ||
    isNewPasswordMismatch ||
    (isPasswordChangeRequested &&
      (!hasPasswordConfirmation ||
        passwordCheckStatus === "checking" ||
        !isCurrentPasswordVerified));

  // 모달 열릴 때 값 초기화
  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setImageUrl(initialImage);
    setSavedImageUrl(initialImage);
    setImagePath(normalizePostStorageReference(initialImage));
    setResetImageRequested(false);
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setMessage(null);
    setPasswordCheckStatus("idle");
    setPasswordCheckMessage(null);
  }, [open, initialName, initialImage]);

  useEffect(() => {
    if (!isSocialAccount) return;

    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setPasswordCheckStatus("idle");
    setPasswordCheckMessage(null);
  }, [isSocialAccount]);

  useEffect(() => {
    if (!open) return;

    if (!hasCurrentPasswordInput) {
      setPasswordCheckStatus("idle");
      setPasswordCheckMessage(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setPasswordCheckStatus("checking");
      setPasswordCheckMessage("현재 비밀번호를 확인하는 중입니다.");

      try {
        const response = await fetch("/api/user/verify-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, platform }),
          signal: controller.signal,
        });

        const data = (await response.json().catch(() => ({}))) as {
          valid?: boolean;
          message?: string;
        };

        if (response.ok && data.valid) {
          setPasswordCheckStatus("valid");
          setPasswordCheckMessage(
            data.message ?? "현재 비밀번호가 확인되었습니다.",
          );
          return;
        }

        setPasswordCheckStatus("invalid");
        setPasswordCheckMessage(
          data.message ?? "현재 비밀번호가 올바르지 않습니다.",
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setPasswordCheckStatus("error");
        setPasswordCheckMessage(
          error instanceof Error
            ? error.message
            : "비밀번호 확인에 실패했습니다.",
        );
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [currentPassword, hasCurrentPasswordInput, open, platform]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function removeProfileImageFromStorage(path?: string | null) {
    await removePostMedia(normalizePostStorageReference(path));
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !session?.user?.id) return;

    setIsUploadingImage(true);
    setMessage(null);

    try {
      const uploaded = await uploadPostMedia(file, "profile");

      const previousUnsavedPath =
        imagePath && imageUrl !== savedImageUrl ? imagePath : null;

      if (previousUnsavedPath && previousUnsavedPath !== uploaded.storagePath) {
        await removeProfileImageFromStorage(previousUnsavedPath);
      }

      setImagePath(uploaded.storagePath);
      setImageUrl(uploaded.signedUrl);
      setResetImageRequested(false);
      event.target.value = "";
    } catch {
      setMessage("프로필 사진 업로드 중 오류가 발생했습니다.");
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleImageRemove() {
    try {
      if (imagePath && imageUrl !== savedImageUrl) {
        await removeProfileImageFromStorage(imagePath);
      }

      setImageUrl(null);
      setImagePath(null);
      setResetImageRequested(false);
      setMessage(null);
    } catch {
      setMessage("프로필 사진 삭제 중 오류가 발생했습니다.");
    }
  }

  async function handleImageReset() {
    setMessage(null);
    if (!initialOauthImage) {
      setMessage(
        "SNS 기본 프로필 사진 정보가 없습니다. 로그아웃 후 다시 SNS 로그인한 뒤 초기화를 시도해주세요.",
      );
      return;
    }

    setResetImageRequested(true);
    setImagePath(null);
    setImageUrl(initialOauthImage);
    setMessage("저장 시 SNS 기본 프로필 사진으로 초기화됩니다.");
  }

  async function handleSave() {
    setMessage(null);

    if (!session?.user?.id) {
      setMessage("세션 정보를 찾지 못했습니다. 다시 로그인 해주세요.");
      return;
    }

    if (isNicknameChanged && !nickname.isAvailable) {
      setMessage(nickname.message ?? "사용 가능한 닉네임을 입력해주세요.");
      return;
    }

    if (newPassword || newPasswordConfirm) {
      if (!currentPassword) {
        setMessage("현재 비밀번호를 입력해주세요.");
        return;
      }
      if (!isCurrentPasswordVerified) {
        setMessage(
          passwordCheckMessage ?? "현재 비밀번호가 올바른지 먼저 확인해주세요.",
        );
        return;
      }
      if (newPasswordValidationMessage) {
        setMessage(newPasswordValidationMessage);
        return;
      }
      if (isSameAsCurrentPassword) {
        setMessage("현재 비밀번호와 다른 비밀번호를 입력해 주세요.");
        return;
      }
      if (newPassword !== newPasswordConfirm) {
        setMessage("새 비밀번호가 일치하지 않습니다.");
        return;
      }
    }

    setLoading(true);
    try {
      type UpdateUserResponse = {
        image?: string | null;
        name?: string | null;
        message?: string;
      };

      const res = await fetch("/api/platform-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          name,
          image: imagePath ?? imageUrl ?? undefined,
          removeImage: !resetImageRequested && !imageUrl,
          resetImage: resetImageRequested,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });

      const data: UpdateUserResponse = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data?.message ?? "수정에 실패했습니다.");
        return;
      }

      const previousSavedImagePath =
        savedImageUrl && savedImageUrl !== imageUrl
          ? normalizePostStorageReference(savedImageUrl)
          : null;

      if (previousSavedImagePath) {
        await removeProfileImageFromStorage(previousSavedImagePath);
      }

      // 세션 UI 즉시 반영 (NextAuth useSession().update)
      const nextImageUrl =
        data.image !== undefined ? (data.image ?? null) : imageUrl;

      setImageUrl(nextImageUrl);
      setSavedImageUrl(nextImageUrl);
      setImagePath(normalizePostStorageReference(nextImageUrl));
      setResetImageRequested(false);
      await updateSession({
        name: data.name ?? name,
        image: nextImageUrl,
      });
      await refresh();
      await onSaved?.();
      window.dispatchEvent(new Event("profile-updated"));
      router.refresh();

      setMessage("저장되었습니다.");
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[160]">
      {/* overlay */}
      <button
        type="button"
        aria-label="설정 닫기"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-black/50"
      />

      {/* modal */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl border border-border bg-background text-foreground shadow-xl">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-base font-semibold">계정 설정</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-2 hover:bg-muted"
              aria-label="닫기"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 space-y-6">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">프로필 사진</p>
              <div className="flex items-center gap-4">
                <Image
                  src={imageUrl ?? "/logo.png"}
                  alt="프로필 사진"
                  width={72}
                  height={72}
                  className={cn(
                    "h-18 w-18 rounded-full border object-cover",
                    !imageUrl && "grayscale",
                  )}
                />
                <div className="flex flex-wrap gap-2">
                  <label className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted cursor-pointer">
                    사진 업로드
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                      disabled={loading || isUploadingImage}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleImageRemove}
                    disabled={loading || isUploadingImage || !imageUrl}
                    className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    삭제
                  </button>
                  {isSocialAccount ? (
                    <button
                      type="button"
                      onClick={handleImageReset}
                      disabled={loading || isUploadingImage}
                      className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50disabled:cursor-not-allowed"
                    >
                      초기화
                    </button>
                  ) : null}
                </div>
              </div>
              {isUploadingImage && (
                <p className="text-xs text-muted-foreground">
                  프로필 사진 업로드 중입니다.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm text-muted-foreground">
                닉네임
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="닉네임"
                className={cn(
                  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none",
                  nickname.status === "taken" ||
                    nickname.status === "invalid" ||
                    nickname.status === "error"
                    ? "border-red-500 focus-visible:border-red-500"
                    : "",
                  nickname.status === "available"
                    ? "border-green-500 focus-visible:border-green-500"
                    : "",
                )}
              />
              {nickname.message && (
                <p
                  className={cn(
                    "text-xs",
                    nickname.status === "available" ? "text-green-600" : "",
                    isNicknameUnavailable
                      ? "text-red-500"
                      : "text-muted-foreground",
                  )}
                >
                  {nickname.message}
                </p>
              )}
            </div>

            {!isSocialAccount && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">비밀번호 변경</p>

                <div className="space-y-2">
                  <label
                    htmlFor="name"
                    className="text-sm text-muted-foreground"
                  >
                    현재 비밀번호
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  {hasCurrentPasswordInput && passwordCheckMessage && (
                    <p
                      className={cn(
                        "text-xs",
                        passwordCheckStatus === "valid"
                          ? "text-green-600"
                          : "text-red-500",
                      )}
                    >
                      {passwordCheckMessage}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="name"
                    className="text-sm text-muted-foreground"
                  >
                    새 비밀번호
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  {newPasswordValidationMessage && (
                    <p className="text-xs text-red-500">
                      {newPasswordValidationMessage}
                    </p>
                  )}
                  {isSameAsCurrentPassword && (
                    <p className="text-xs text-red-500">
                      현재 비밀번호와 다른 비밀번호를 입력해 주세요.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="name"
                    className="text-sm text-muted-foreground"
                  >
                    새 비밀번호 확인
                  </label>
                  <input
                    type="password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                  {isPasswordChangeRequested && !hasPasswordConfirmation && (
                    <p className="text-xs text-red-500">
                      새 비밀번호 확인을 입력해주세요.
                    </p>
                  )}
                  {isPasswordChangeRequested &&
                    hasPasswordConfirmation &&
                    !isNewPasswordValid && (
                      <p className="text-xs text-red-500">
                        비밀번호 길이를 먼저 맞춰주세요.
                      </p>
                    )}
                  {isNewPasswordMismatch && (
                    <p className="text-xs text-red-500">
                      새 비밀번호가 일치하지 않습니다.
                    </p>
                  )}
                  {isNewPasswordMatched && (
                    <p className="text-xs text-green-600">
                      새 비밀번호가 일치합니다.
                    </p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  비밀번호를 변경하지 않으려면 아래 칸은 비워두세요.
                </p>
              </div>
            )}

            {message && <p className="text-sm text-red-500">{message}</p>}
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm hover:bg-muted"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaveDisabled}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-semibold",
                isDuplicateNickname
                  ? "cursor-not-allowed bg-gray-200 text-gray-500 hover:bg-gray-200"
                  : "bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            >
              {loading ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
