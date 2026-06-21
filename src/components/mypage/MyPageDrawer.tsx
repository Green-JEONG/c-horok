"use client";

import { Circle, CircleCheckBig, Settings, Trash2, X } from "lucide-react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AccountSettingsModal from "@/components/mypage/AccountSettingsModal";
import {
  getPlatformFromPathname,
  usePlatformProfile,
} from "@/components/mypage/usePlatformProfile";
import {
  countSyncedPostDrafts,
  getLogPostDraftStorageKey,
} from "@/lib/post-drafts";
import { getLogMyPagePath } from "@/lib/routes";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
};

type Notification = {
  id: number;
  type:
    | "FRIEND_REQUEST"
    | "POST_COMMENT"
    | "COMMENT_REPLY"
    | "POST_LIKE"
    | "NEW_POST"
    | "POST_REACTION"
    | "COMMENT_REACTION"
    | "NEW_FOLLOWER"
    | "CHAT_HANDOFF";
  actor_name: string | null;
  actor_image?: string | null;
  actor_id?: number | null;
  message?: string | null;
  post_id: number | null;
  comment_id: number | null;
  chat_thread_id?: number | null;
  post_path: string | null;
  is_post_deleted: boolean;
  is_notice_post?: boolean;
  is_comment_deleted?: boolean;
  is_read: number;
  created_at: string;
};

const NOTIFICATIONS_UPDATED_EVENT = "notifications-updated";
const OPEN_CHAT_THREAD_EVENT = "horok-open-chat-thread";
const DRAWER_TRANSITION_MS = 300;

function renderNotificationMessage(n: Notification) {
  if (n.message) return n.message.replaceAll("QnA", "문의");

  switch (n.type) {
    case "FRIEND_REQUEST":
      return `${n.actor_name ?? "누군가"}님이 친구 요청을 보냈습니다`;
    case "POST_COMMENT":
      return `${n.actor_name ?? "누군가"}님이 내 게시물에 댓글을 남겼습니다`;
    case "COMMENT_REPLY":
      return `${n.actor_name ?? "누군가"}님이 내 댓글에 답글을 남겼습니다`;
    case "POST_LIKE":
      return `${n.actor_name ?? "누군가"}님이 내 게시물을 북마크했습니다`;
    case "NEW_POST":
      return `${n.actor_name ?? "누군가"}님이 새 게시글을 작성했습니다`;
    case "POST_REACTION":
    case "COMMENT_REACTION":
      return `${n.actor_name ?? "누군가"}님이 반응했습니다`;
    case "NEW_FOLLOWER":
      return `${n.actor_name ?? "누군가"}님이 나를 팔로잉 했습니다.`;
    case "CHAT_HANDOFF":
      return n.message ?? "챗봇 대화에 관리자 문의가 접수되었습니다.";
    default:
      return "새 알림이 있습니다";
  }
}

function renderEmphasizedNotificationMessage(message: string) {
  const emphasizedParts: ReactNode[] = [];
  const isCommentActivityMessage =
    /게시글에\s*"[^"]+"\s*(댓글|답글|답변)을/.test(message);
  const pattern =
    /('[^']+'|"[^"]+"|^(.+?)님|(팔로잉|문의|댓글|답글|답변|북마크|반응))/g;
  let lastIndex = 0;

  for (const match of message.matchAll(pattern)) {
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      emphasizedParts.push(message.slice(lastIndex, matchIndex));
    }

    if (match[2]) {
      emphasizedParts.push(
        <strong key={`actor-${matchIndex}`} className="font-semibold">
          {match[2]}
        </strong>,
        "님",
      );
    } else if (match[3]) {
      emphasizedParts.push(
        <strong key={`keyword-${matchIndex}`} className="font-semibold">
          {match[3]}
        </strong>,
      );
    } else if (isCommentActivityMessage && match[1]?.startsWith("'")) {
      emphasizedParts.push(match[1]);
    } else {
      emphasizedParts.push(
        <strong key={`quote-${matchIndex}`} className="font-semibold">
          {match[1]}
        </strong>,
      );
    }

    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < message.length) {
    emphasizedParts.push(message.slice(lastIndex));
  }

  return emphasizedParts.length > 0 ? emphasizedParts : message;
}

function getNotificationDateKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatNotificationDateBadge(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatNotificationTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default function MyPageDrawer({ open, onClose }: Props) {
  const { data: session } = useSession();
  const isLoggedIn = Boolean(session?.user?.email);
  const pathname = usePathname();
  const platform = getPlatformFromPathname(pathname);
  const isCoding = platform === "coding";
  const { profile, refresh } = usePlatformProfile(open);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(open);
  const [portalReady, setPortalReady] = useState(false);
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationDeleteMode, setIsNotificationDeleteMode] =
    useState(false);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<
    number[]
  >([]);
  const [stats, setStats] = useState({
    first: 0,
    second: 0,
    third: 0,
  });
  const [draftPostCount, setDraftPostCount] = useState(0);
  const codingStatLinks = [
    "/horok-coding?tab=solved#coding-problem-tabs",
    "/horok-coding?tab=failed#coding-problem-tabs",
    "/horok-coding?tab=bookmarked#coding-problem-tabs",
  ] as const;
  const getCallbackUrl = useCallback(() => {
    if (typeof window === "undefined") {
      return "/";
    }

    return `${window.location.pathname}${window.location.search}`;
  }, []);

  const notifyNotificationsUpdated = () => {
    window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
  };

  const deleteSelectedNotifications = async () => {
    if (selectedNotificationIds.length === 0) {
      return;
    }

    try {
      await Promise.all(
        selectedNotificationIds.map(async (notificationId) => {
          const response = await fetch(`/api/notifications/${notificationId}`, {
            method: "DELETE",
          });

          if (!response.ok) {
            throw new Error("알림 삭제 실패");
          }
        }),
      );

      setNotifications((current) =>
        current.filter(
          (notification) => !selectedNotificationIds.includes(notification.id),
        ),
      );
      setSelectedNotificationIds([]);
      setIsNotificationDeleteMode(false);
      notifyNotificationsUpdated();
    } catch (error) {
      console.error(error);
    }
  };

  // ESC 닫기
  useEffect(() => {
    if (!open || isCoding) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCoding, onClose, open]);

  // 드로어가 닫히면 설정 모달도 닫기(자연스럽게)
  useEffect(() => {
    if (!open) setSettingsOpen(false);
  }, [open]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsVisible(false);
    }, DRAWER_TRANSITION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (isCoding) {
      setNotifications([]);
      return;
    }

    const loadNotifications = async () => {
      try {
        const res = await fetch("/api/notifications");

        console.log("🔔 응답 상태:", res.status);

        if (!res.ok) {
          console.error("알림 API 실패", res.status);
          setNotifications([]);
          return;
        }

        const text = await res.text();

        if (!text) {
          console.warn("⚠️ 알림 응답 바디 비어있음");
          setNotifications([]);
          return;
        }

        const data = JSON.parse(text);
        console.log("🔔 알림 데이터:", data);
        setNotifications(data);
      } catch (e) {
        console.error("알림 로드 실패", e);
        setNotifications([]);
      }
    };

    loadNotifications();
  }, [isCoding, open]);

  useEffect(() => {
    if (!open) return;

    if (isCoding || !isLoggedIn) {
      setDraftPostCount(0);
    } else {
      void countSyncedPostDrafts(getLogPostDraftStorageKey()).then(
        setDraftPostCount,
      );
    }

    const loadStats = async () => {
      try {
        const res = await fetch(`/api/mypage/stats?platform=${platform}`);
        if (!res.ok) return;

        const data = await res.json();
        setStats(data);
      } catch (e) {
        console.error("stats 로드 실패", e);
      }
    };

    loadStats();
  }, [isCoding, isLoggedIn, open, platform]);

  if (!isVisible || !portalReady) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[150]",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      {/* dim + blur */}
      <button
        type="button"
        aria-label="마이페이지 닫기"
        onClick={onClose}
        className={cn(
          "absolute inset-0 cursor-pointer bg-black/50 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      <aside
        className={cn(
          "absolute left-0 top-0 flex h-full w-87.5 flex-col shadow-xl transition-transform duration-300 ease-out",
          isCoding
            ? "bg-white text-slate-900 dark:bg-[#111727] dark:text-white"
            : "bg-background text-foreground",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between p-2">
          <nav className="flex items-center gap-4 text-sm">
            {session?.user?.role === "ADMIN" && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push("/admin");
                }}
                className="text-red-500 font-semibold hover:underline"
              >
                관리자
              </button>
            )}
          </nav>
          <button
            type="button"
            aria-label="설정 열기"
            onClick={() => setSettingsOpen(true)}
            className={cn(
              "rounded-md p-2",
              isCoding
                ? "hover:bg-slate-900/6 dark:hover:bg-white/10"
                : "hover:bg-muted",
            )}
          >
            <Settings size={18} />
          </button>
        </div>

        {/* profile */}
        <div className="px-4 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setImagePreviewOpen(true)}
            className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`${profile?.name ?? session?.user?.name ?? "사용자"} 프로필 이미지 확대`}
          >
            <Image
              src={profile?.image ?? session?.user?.image ?? "/logo.png"}
              alt="profile"
              width={150}
              height={150}
              className={cn(
                "h-[150px] w-[150px] rounded-full border border-border object-cover",
                !(profile?.image ?? session?.user?.image) && "grayscale",
              )}
            />
          </button>
          <div className="flex flex-col items-center">
            <p
              className={cn(
                "text-2xl font-semibold",
                isCoding ? "text-slate-900 dark:text-white" : "text-foreground",
              )}
            >
              {profile?.name ?? session?.user?.name ?? "사용자"}
            </p>
            <p
              className={cn(
                "text-xs",
                isCoding
                  ? "text-slate-500 dark:text-white/75"
                  : "text-muted-foreground",
              )}
            >
              {profile?.email ?? session?.user?.email}
            </p>
          </div>
        </div>

        {/* platform stats */}
        <div className="flex justify-around mx-4 gap-2 items-center">
          {[
            isCoding ? "맞은 문제" : "글",
            isCoding ? "틀린 문제" : "댓글",
            isCoding ? "찜한 문제" : "팔로워",
          ].map((label, index) => {
            const value =
              index === 0
                ? stats.first + (!isCoding && isLoggedIn ? draftPostCount : 0)
                : index === 1
                  ? stats.second
                  : stats.third;
            const sharedClass = cn(
              "shadow-sm rounded-lg w-full py-2 my-6",
              isCoding
                ? "border border-[#06923E] bg-[#06923E] text-white"
                : "bg-primary text-primary-foreground border border-border",
            );

            if (isCoding) {
              return (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    sharedClass,
                    "flex flex-col items-center cursor-pointer hover:opacity-90 transition-opacity",
                  )}
                  onClick={() => {
                    onClose();
                    router.push(codingStatLinks[index]);
                  }}
                >
                  <p className="font-light text-white">{label}</p>
                  <p className="font-extrabold text-white">{value}</p>
                </button>
              );
            }

            return (
              <button
                key={label}
                type="button"
                className={sharedClass}
                onClick={() => {
                  onClose();
                  router.push(
                    index === 0
                      ? getLogMyPagePath("tab=posts")
                      : index === 1
                        ? getLogMyPagePath("tab=comments")
                        : getLogMyPagePath("tab=friends&friendType=following"),
                  );
                }}
              >
                <p className="font-light text-white">{label}</p>
                <p className="font-extrabold text-white">{value}</p>
              </button>
            );
          })}
        </div>

        <div
          className={cn(
            "mx-4 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden rounded-3xl border px-4 py-3 shadow-md",
            isCoding
              ? "border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50"
              : "border-border bg-muted text-foreground",
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold">알림</h3>
            {notifications.length > 0 ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={
                    isNotificationDeleteMode
                      ? "선택한 알림 삭제"
                      : "알림 삭제 모드 켜기"
                  }
                  aria-pressed={isNotificationDeleteMode}
                  onClick={() => {
                    if (isNotificationDeleteMode) {
                      void deleteSelectedNotifications();
                      return;
                    }

                    setSelectedNotificationIds([]);
                    setIsNotificationDeleteMode(true);
                  }}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center justify-center rounded-md border transition",
                    isNotificationDeleteMode
                      ? "border-red-500 bg-red-500 px-3 text-xs font-semibold text-white hover:bg-red-600"
                      : "size-8 border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-foreground",
                    isNotificationDeleteMode &&
                      selectedNotificationIds.length === 0 &&
                      "opacity-60",
                  )}
                >
                  {isNotificationDeleteMode ? (
                    "삭제"
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
                {isNotificationDeleteMode ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNotificationIds([]);
                      setIsNotificationDeleteMode(false);
                    }}
                    className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
                  >
                    취소
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            className={cn(
              "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto pr-2 text-sm",
              isCoding ? "scrollbar-green" : "scrollbar-orange",
            )}
          >
            {notifications.length === 0 && (
              <p className="text-muted-foreground">알림이 없습니다.</p>
            )}

            <ul className="min-w-0 space-y-2">
              {notifications.map((n, index) => {
                const previousNotification = notifications[index - 1];
                const showDateBadge =
                  !previousNotification ||
                  getNotificationDateKey(previousNotification.created_at) !==
                    getNotificationDateKey(n.created_at);

                return (
                  <li key={n.id} className="min-w-0 space-y-2">
                    {showDateBadge ? (
                      <div
                        className={cn(
                          "flex justify-center",
                          !previousNotification ? "mt-1 mb-2" : "mt-6 mb-2",
                        )}
                      >
                        <span className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm ring-1 ring-border">
                          {formatNotificationDateBadge(n.created_at)}
                        </span>
                      </div>
                    ) : null}

                    <div className="group flex min-w-0 items-start gap-2">
                      <button
                        type="button"
                        className="flex w-full min-w-0 flex-1 items-start gap-2 text-left text-[15px] leading-[18px] text-muted-foreground hover:underline disabled:cursor-default disabled:no-underline disabled:opacity-70 [&_strong]:text-foreground"
                        onClick={async () => {
                          if (isNotificationDeleteMode) {
                            setSelectedNotificationIds((current) =>
                              current.includes(n.id)
                                ? current.filter(
                                    (notificationId) => notificationId !== n.id,
                                  )
                                : [...current, n.id],
                            );
                            return;
                          }

                          if (!n.is_read) {
                            try {
                              const response = await fetch(
                                `/api/notifications/${n.id}/read`,
                                {
                                  method: "PATCH",
                                },
                              );

                              if (response.ok) {
                                setNotifications((current) =>
                                  current.map((notification) =>
                                    notification.id === n.id
                                      ? { ...notification, is_read: 1 }
                                      : notification,
                                  ),
                                );
                                notifyNotificationsUpdated();
                              }
                            } catch (error) {
                              console.error("알림 읽음 처리 실패", error);
                            }
                          }

                          if (n.is_post_deleted || n.is_comment_deleted) {
                            window.alert(
                              n.is_post_deleted
                                ? n.is_notice_post
                                  ? "삭제된 문의입니다."
                                  : "삭제된 게시물입니다."
                                : "삭제된 댓글입니다.",
                            );
                            return;
                          }

                          onClose();
                          if (
                            n.type === "CHAT_HANDOFF" &&
                            typeof n.chat_thread_id === "number"
                          ) {
                            window.dispatchEvent(
                              new CustomEvent(OPEN_CHAT_THREAD_EVENT, {
                                detail: {
                                  threadId: String(n.chat_thread_id),
                                },
                              }),
                            );
                            return;
                          }

                          if (
                            n.type === "NEW_FOLLOWER" ||
                            n.type === "FRIEND_REQUEST"
                          ) {
                            const params = new URLSearchParams({
                              tab: "friends",
                              friendType: "followers",
                            });
                            if (typeof n.actor_id === "number") {
                              params.set("friendId", String(n.actor_id));
                            }
                            router.push(getLogMyPagePath(params.toString()));
                            return;
                          }

                          const postPath = n.post_path;
                          const shouldOpenNoticeDetail =
                            typeof postPath === "string" &&
                            postPath.startsWith("/horok-log/notices/");

                          const shouldOpenQnaList =
                            shouldOpenNoticeDetail &&
                            n.type === "POST_COMMENT" &&
                            typeof n.comment_id !== "number" &&
                            typeof n.post_id === "number";

                          if (shouldOpenQnaList) {
                            router.push(
                              `/horok-log/notices?category=QnA&target=${n.post_id}`,
                            );
                            return;
                          }

                          if (shouldOpenNoticeDetail && !n.is_post_deleted) {
                            const targetPath = n.comment_id
                              ? `${postPath}?commentId=${n.comment_id}`
                              : postPath;
                            router.push(targetPath);
                            return;
                          }

                          if (
                            (n.type === "POST_COMMENT" ||
                              n.type === "COMMENT_REPLY") &&
                            typeof postPath === "string" &&
                            typeof n.comment_id === "number"
                          ) {
                            router.push(
                              `${postPath}?commentId=${n.comment_id}`,
                            );
                            return;
                          }

                          if (
                            n.type === "POST_LIKE" &&
                            typeof n.post_id === "number"
                          ) {
                            router.push(
                              getLogMyPagePath(`tab=posts&postId=${n.post_id}`),
                            );
                            return;
                          }

                          if (
                            typeof postPath === "string" &&
                            !n.is_post_deleted
                          ) {
                            const targetPath = n.comment_id
                              ? `${postPath}?commentId=${n.comment_id}`
                              : postPath;
                            router.push(targetPath);
                          }
                        }}
                      >
                        {isNotificationDeleteMode ? (
                          selectedNotificationIds.includes(n.id) ? (
                            <CircleCheckBig
                              className="mt-[3px] size-[18px] shrink-0"
                              color="#ef4444"
                            />
                          ) : (
                            <Circle
                              className="mt-[3px] size-[18px] shrink-0"
                              color="#ef4444"
                            />
                          )
                        ) : n.is_read ? (
                          <CircleCheckBig
                            className="mt-[3px] size-[18px] shrink-0"
                            color="#4CB975"
                          />
                        ) : (
                          <Circle
                            className="mt-[3px] size-[18px] shrink-0"
                            color="#ccc"
                          />
                        )}
                        <Image
                          src={n.actor_image ?? "/logo.png"}
                          alt={`${n.actor_name ?? "알림 발신자"} 프로필`}
                          width={24}
                          height={24}
                          className={cn(
                            "size-6 shrink-0 rounded-full border object-cover",
                            !n.actor_image && "grayscale",
                          )}
                        />
                        <span
                          className={cn(
                            "min-w-0 flex-1 break-words [overflow-wrap:anywhere] [&_strong]:break-words",
                            (n.is_post_deleted || n.is_comment_deleted) &&
                              "line-through decoration-foreground",
                          )}
                        >
                          {renderEmphasizedNotificationMessage(
                            renderNotificationMessage(n),
                          )}
                        </span>
                        <span className="mt-0.5 shrink-0 whitespace-nowrap text-[11px] leading-none text-muted-foreground/75">
                          {formatNotificationTime(n.created_at)}
                        </span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <p
          className={cn(
            "text-center text-xs font-light my-4",
            isCoding
              ? "text-slate-500 dark:text-white/70"
              : "text-muted-foreground",
          )}
        >
          Developed by{" "}
          <a
            href="https://github.com/Green-JEONG/horok-dev"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "underline",
              isCoding
                ? "hover:text-slate-900 dark:hover:text-white"
                : "hover:text-foreground",
            )}
          >
            Green_JEONG
          </a>
        </p>

        {/* footer */}
        <div
          className={cn(
            "flex border-t py-6 mx-4",
            isCoding ? "border-slate-200 dark:border-white/10" : "border-border",
          )}
        >
          <button
            type="button"
            className={cn(
              "w-full border-r text-sm hover:underline",
              isCoding
                ? "border-slate-200 text-red-400 dark:border-white/10"
                : "text-red-400",
            )}
            onClick={async () => {
              const ok = confirm("정말 회원탈퇴를 하시겠습니까?");
              if (!ok) return;

              const res = await fetch("/api/user/delete", {
                method: "DELETE",
              });

              if (!res.ok) {
                alert("회원탈퇴에 실패했습니다.");
                return;
              }

              await signOut({ callbackUrl: getCallbackUrl() });
            }}
          >
            회원탈퇴
          </button>

          <button
            type="button"
            className={cn(
              "w-full rounded-md text-sm",
              isCoding ? "text-muted-foreground" : "text-muted-foreground",
            )}
            onClick={() => signOut({ callbackUrl: getCallbackUrl() })}
          >
            로그아웃
          </button>
        </div>
      </aside>

      {/* settings modal */}
      <AccountSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={refresh}
      />

      {imagePreviewOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${profile?.name ?? session?.user?.name ?? "사용자"} 프로필 이미지`}
        >
          <button
            type="button"
            className="absolute inset-0 z-0 bg-black/60"
            onClick={() => setImagePreviewOpen(false)}
            aria-label="프로필 이미지 닫기"
          />
          <div className="relative z-10 rounded-2xl bg-background p-4 shadow-xl">
            <Image
              src={profile?.image ?? session?.user?.image ?? "/logo.png"}
              alt={`${profile?.name ?? session?.user?.name ?? "사용자"} 프로필 확대`}
              width={360}
              height={360}
              className={`max-h-[80vh] max-w-[80vw] object-contain ${
                !(profile?.image ?? session?.user?.image) ? "grayscale" : ""
              }`}
            />
            <button
              type="button"
              onClick={() => setImagePreviewOpen(false)}
              className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur-sm transition hover:bg-muted hover:text-foreground"
              aria-label="프로필 이미지 닫기"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
