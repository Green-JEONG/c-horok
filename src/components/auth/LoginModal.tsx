"use client";

import { ArrowLeft, X } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { markLoginWelcomeToast } from "@/components/layout/LoginWelcomeToast";
import { validatePassword } from "@/lib/password";
import { cn } from "@/lib/utils";
import { useEmailAvailability } from "./useEmailAvailability";
import { useNicknameAvailability } from "./useNicknameAvailability";

type Props = {
  open: boolean;
  onClose: () => void;
};

type AuthStep = "login" | "signup" | "magicLink";

const SAVED_LOGIN_EMAIL_KEY = "horok-saved-login-email";

export default function LoginModal({ open, onClose }: Props) {
  const [step, setStep] = useState<AuthStep>("login");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const platformLabel = pathname?.startsWith("/horok-cote") ? "cote" : "tech";

  // 로그인 입력 state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 회원가입용 state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const signupEmailAvailability = useEmailAvailability({
    email: signupEmail,
    enabled: open && step === "signup",
  });
  const signupNickname = useNicknameAvailability({
    nickname: signupName,
    enabled: open && step === "signup",
  });
  const isSignupEmailUnavailable =
    signupEmailAvailability.status === "taken" ||
    signupEmailAvailability.status === "invalid" ||
    signupEmailAvailability.status === "error";
  const isSignupNicknameUnavailable =
    signupNickname.status === "taken" ||
    signupNickname.status === "invalid" ||
    signupNickname.status === "error";
  const signupPasswordValidationMessage = signupPassword
    ? validatePassword(signupPassword)
    : null;
  const isSignupPasswordValid = !signupPasswordValidationMessage;
  const isSignupPasswordMatched =
    Boolean(signupPassword) &&
    Boolean(signupPasswordConfirm) &&
    isSignupPasswordValid &&
    signupPassword === signupPasswordConfirm;
  const isSignupPasswordMismatch =
    Boolean(signupPasswordConfirm) &&
    isSignupPasswordValid &&
    signupPassword !== signupPasswordConfirm;
  const isSignupDisabled =
    loading ||
    signupEmailAvailability.isChecking ||
    signupNickname.isChecking ||
    !signupEmailAvailability.isAvailable ||
    isSignupNicknameUnavailable ||
    !signupEmail ||
    !signupName ||
    !signupPassword ||
    !signupPasswordConfirm ||
    !isSignupPasswordValid ||
    !isSignupPasswordMatched;
  const getCallbackUrl = useCallback(() => {
    if (typeof window === "undefined") {
      return "/";
    }

    return `${window.location.pathname}${window.location.search}`;
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    setStep("login");
    setEmail("");
    setPassword("");
    setAutoLogin(false);
    setSignupEmail("");
    setSignupName("");
    setSignupPassword("");
    setSignupPasswordConfirm("");
    setRecoveryEmail("");
    setError(null);
    setNotice(null);
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    const savedEmail = window.localStorage.getItem(SAVED_LOGIN_EMAIL_KEY) ?? "";
    setEmail(savedEmail);
    setRememberEmail(Boolean(savedEmail));
  }, [open]);

  // ESC 키로 닫기
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  async function handleCredentialsLogin() {
    if (!email || !password) {
      setError("이메일 또는 닉네임과 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    if (rememberEmail) {
      window.localStorage.setItem(SAVED_LOGIN_EMAIL_KEY, email.trim());
    } else {
      window.localStorage.removeItem(SAVED_LOGIN_EMAIL_KEY);
    }

    const res = await signIn("credentials", {
      email,
      password,
      autoLogin: autoLogin ? "true" : "false",
      callbackUrl: getCallbackUrl(),
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("이메일/닉네임 또는 비밀번호가 올바르지 않습니다.");
      return;
    }

    if (res?.ok) {
      const callbackUrl = getCallbackUrl();
      markLoginWelcomeToast();
      handleClose(); // 로그인 성공 → 모달 닫기
      router.replace(callbackUrl);
      router.refresh();
    }
  }

  if (!open || !mounted) return null;

  async function handleSignup() {
    if (
      !signupEmail ||
      !signupName ||
      !signupPassword ||
      !signupPasswordConfirm
    ) {
      setError("모든 값을 입력해주세요.");
      return;
    }

    if (signupPassword !== signupPasswordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    const passwordValidationMessage = validatePassword(signupPassword);
    if (passwordValidationMessage) {
      setError(passwordValidationMessage);
      return;
    }

    if (!signupNickname.isAvailable) {
      setError(signupNickname.message ?? "사용 가능한 닉네임을 입력해주세요.");
      return;
    }

    if (!signupEmailAvailability.isAvailable) {
      setError(
        signupEmailAvailability.message ?? "사용 가능한 이메일을 입력해주세요.",
      );
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: signupEmail,
        name: signupName,
        password: signupPassword,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.message ?? "회원가입 실패");
      return;
    }

    setStep("login");
    setEmail(signupEmail);
    setPassword("");
    setSignupEmail("");
    setSignupName("");
    setSignupPassword("");
    setSignupPasswordConfirm("");
    setError(null);
    setNotice("회원가입이 완료되었습니다. 로그인해주세요.");
  }

  async function handleSendMagicLink() {
    const normalizedEmail = recoveryEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("이메일을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const emailCheckRes = await fetch(
        `/api/users/check-email?email=${encodeURIComponent(normalizedEmail)}`,
      );
      const emailCheckData = (await emailCheckRes.json().catch(() => ({}))) as {
        available?: boolean;
        message?: string;
      };

      if (!emailCheckRes.ok) {
        setError(emailCheckData.message ?? "이메일을 확인하지 못했습니다.");
        return;
      }

      if (emailCheckData.available) {
        setError("가입한 이메일을 먼저 확인해주세요.");
        return;
      }

      const res = await signIn("nodemailer", {
        email: normalizedEmail,
        redirect: false,
        callbackUrl: getCallbackUrl(),
      });

      if (res?.error) {
        setError("로그인 링크 전송에 실패했습니다.");
        return;
      }

      setNotice("로그인 링크 전송 완료!");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000]">
      {/* dim overlay */}
      <button
        type="button"
        aria-label="로그인 모달 닫기"
        onClick={handleClose}
        className="absolute inset-0 cursor-pointer bg-black/50"
      >
        <span className="sr-only">모달 닫기</span>
      </button>

      {/* modal */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
        <div className="pointer-events-auto relative w-full max-w-sm rounded-2xl border border-border bg-background p-6 text-foreground shadow-xl">
          {/* 상단 네비 */}
          <div className="absolute left-5 top-5 flex items-center gap-2">
            {step !== "login" && (
              <button
                type="button"
                onClick={() => {
                  setStep("login");
                  setError(null);
                  setNotice(null);
                }}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft size={20} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="absolute right-5 top-5 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X size={20} />
          </button>

          {/* 로고 */}
          <div className="my-6 flex flex-col items-center">
            <Image
              src="/logo.png"
              alt="c.horok"
              width={60}
              height={60}
              style={{ width: "auto", height: "auto" }}
            />
            <h2 className="mt-2 text-center text-lg font-bold">
              {step === "login" ? (
                <span className="flex flex-col items-center leading-none">
                  <span>horok</span>
                  <span>{platformLabel}</span>
                </span>
              ) : step === "signup" ? (
                "회원가입"
              ) : (
                "비밀번호를 잊으셨나요?"
              )}
            </h2>
          </div>

          {/* 로그인 */}
          {step === "login" && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleCredentialsLogin();
                }}
                className="space-y-3"
              >
                <input
                  type="text"
                  id="username"
                  name="username"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일 또는 닉네임"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
                <input
                  type="password"
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
                <div className="flex items-center gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={rememberEmail}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setRememberEmail(checked);

                        if (!checked) {
                          window.localStorage.removeItem(SAVED_LOGIN_EMAIL_KEY);
                        }
                      }}
                      className="size-4 rounded border-muted-foreground/30 accent-primary"
                    />
                    아이디 저장
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={autoLogin}
                      onChange={(e) => setAutoLogin(e.target.checked)}
                      className="size-4 rounded border-muted-foreground/30 accent-primary"
                    />
                    자동 로그인
                  </label>
                </div>

                {error && (
                  <p className="text-center text-xs text-red-500">{error}</p>
                )}
                {notice && (
                  <p className="text-center text-xs text-green-600">{notice}</p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {loading ? "로그인 중..." : "로그인"}
                </button>
              </form>

              <div className="mt-3 flex justify-center text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => {
                    setStep("magicLink");
                    setRecoveryEmail(email);
                    setError(null);
                    setNotice(null);
                  }}
                  className="hover:text-foreground"
                >
                  비밀번호를 잊으셨나요?
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <p className="text-center text-xs text-muted-foreground">
                  소셜 로그인
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      markLoginWelcomeToast();
                      signIn("github", { callbackUrl: getCallbackUrl() });
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full border hover:bg-muted"
                  >
                    <Image
                      src="/github.svg"
                      alt="github logo"
                      width={32}
                      height={32}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      markLoginWelcomeToast();
                      signIn("google", { callbackUrl: getCallbackUrl() });
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full border hover:bg-muted"
                  >
                    <Image
                      src="/google.svg"
                      alt="google logo"
                      width={28}
                      height={28}
                    />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                onClick={() => {
                  setStep("signup");
                  setError(null);
                  setNotice(null);
                }}
                className="mt-6 w-full rounded-md bg-green-500 py-2 text-sm font-semibold text-white"
              >
                회원가입
              </button>
            </>
          )}

          {/* ===== 회원가입 ===== */}
          {step === "signup" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSignup();
              }}
              className="space-y-3"
            >
              <input
                type="email"
                id="signupEmail"
                name="email"
                autoComplete="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="아이디 (이메일)"
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm outline-none",
                  isSignupEmailUnavailable
                    ? "border-red-500 focus-visible:border-red-500"
                    : "",
                  signupEmailAvailability.status === "available"
                    ? "border-green-500 focus-visible:border-green-500"
                    : "",
                )}
              />
              {signupEmailAvailability.message && (
                <p
                  className={cn(
                    "text-xs",
                    signupEmailAvailability.status === "available"
                      ? "text-green-600"
                      : "",
                    isSignupEmailUnavailable
                      ? "text-red-500"
                      : "text-muted-foreground",
                  )}
                >
                  {signupEmailAvailability.message}
                </p>
              )}
              <input
                type="text"
                id="signupName"
                name="name"
                autoComplete="username"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                placeholder="닉네임"
                className={cn(
                  "w-full rounded-md border px-3 py-2 text-sm outline-none",
                  signupNickname.status === "taken" ||
                    signupNickname.status === "invalid" ||
                    signupNickname.status === "error"
                    ? "border-red-500 focus-visible:border-red-500"
                    : "",
                  signupNickname.status === "available"
                    ? "border-green-500 focus-visible:border-green-500"
                    : "",
                )}
              />
              {signupNickname.message && (
                <p
                  className={cn(
                    "text-xs",
                    signupNickname.status === "available"
                      ? "text-green-600"
                      : "",
                    isSignupNicknameUnavailable
                      ? "text-red-500"
                      : "text-muted-foreground",
                  )}
                >
                  {signupNickname.message}
                </p>
              )}
              <input
                type="password"
                id="signupPassword"
                name="new-password"
                autoComplete="new-password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              {signupPasswordValidationMessage && (
                <p className="text-xs text-red-500">
                  {signupPasswordValidationMessage}
                </p>
              )}
              <input
                type="password"
                id="signupPasswordConfirm"
                name="new-password-confirm"
                autoComplete="new-password"
                value={signupPasswordConfirm}
                onChange={(e) => setSignupPasswordConfirm(e.target.value)}
                placeholder="비밀번호 확인"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              {Boolean(signupPasswordConfirm) && !isSignupPasswordValid && (
                <p className="text-xs text-red-500">
                  비밀번호 길이를 먼저 맞춰주세요.
                </p>
              )}
              {isSignupPasswordMismatch && (
                <p className="text-xs text-red-500">
                  비밀번호가 일치하지 않습니다.
                </p>
              )}
              {isSignupPasswordMatched && (
                <p className="text-xs text-green-600">비밀번호가 일치합니다.</p>
              )}

              {error && (
                <p className="text-center text-xs text-red-500">{error}</p>
              )}
              {notice && (
                <p className="text-center text-xs text-green-600">{notice}</p>
              )}

              <button
                type="submit"
                disabled={isSignupDisabled}
                className="mt-4 w-full rounded-md bg-green-500 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "가입 중..." : "회원가입"}
              </button>
            </form>
          )}

          {step === "magicLink" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMagicLink();
              }}
              className="space-y-3"
            >
              <input
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="가입한 이메일"
                className="w-full rounded-md border px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground text-center mb-10">
                입력한 이메일로 로그인 링크를 보내드립니다.
              </p>

              {error && (
                <p className="text-center text-xs text-red-500">{error}</p>
              )}
              {notice && (
                <p className="text-center text-xs text-green-600">{notice}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? "전송 중..." : "로그인 링크 보내기"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
