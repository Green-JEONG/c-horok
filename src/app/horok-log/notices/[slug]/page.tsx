import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import ErrorState from "@/components/common/ErrorState";
import CommentList from "@/components/posts/CommentList";
import InquiryStatusButton from "@/components/posts/InquiryStatusButton";
import PostActions from "@/components/posts/PostActions";
import PostContent from "@/components/posts/PostContent";
import PostFooter from "@/components/posts/PostFooter";
import PostScrollTopButton from "@/components/posts/PostScrollTopButton";
import PostSecretAccessGate from "@/components/posts/PostSecretAccessGate";
import PostViewTracker from "@/components/posts/PostViewTracker";
import {
  INQUIRY_TAG_OPTIONS,
  isPublicNoticeCategory,
  NOTICE_TAG_OPTIONS,
} from "@/lib/notice-categories";
import { findNoticeAccessMetaById, findNoticeById } from "@/lib/notices";
import { horokLogTitle } from "@/lib/page-titles";
import {
  getPostSecretPasswordMeta,
  hasPostSecretAccess,
} from "@/lib/post-secret-access";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ from?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const noticeId = Number(slug);

  if (Number.isNaN(noticeId)) {
    return {
      title: horokLogTitle("공지사항"),
    };
  }

  const session = await auth();
  const sessionUserId =
    typeof session?.user?.id === "string" ? Number(session.user.id) : null;
  const notice = await findNoticeById(noticeId, {
    includeHiddenForUserId:
      typeof sessionUserId === "number" && !Number.isNaN(sessionUserId)
        ? sessionUserId
        : null,
    isAdmin: session?.user?.role === "ADMIN",
  });

  if (!notice) {
    return {
      title: horokLogTitle("공지사항"),
    };
  }

  return {
    title: horokLogTitle(notice.title),
    description: notice.summary,
  };
}

function getSafeNoticeBackHref(from?: string) {
  if (!from) {
    return "/horok-log/notices";
  }

  return from === "/horok-log/notices" || from.startsWith("/horok-log/notices?")
    ? from
    : "/horok-log/notices";
}

export default async function HorokLogNoticeDetailPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const { from } = searchParams ? await searchParams : {};
  const noticeId = Number(slug);

  if (Number.isNaN(noticeId)) {
    notFound();
  }

  const session = await auth();
  const sessionUserId =
    typeof session?.user?.id === "string" ? Number(session.user.id) : null;
  const secretMeta = await getPostSecretPasswordMeta(noticeId);
  const hasPasswordAccess = secretMeta?.secretPasswordHash
    ? await hasPostSecretAccess(noticeId, secretMeta.secretPasswordHash)
    : false;
  const notice = await findNoticeById(noticeId, {
    includeHiddenForUserId:
      typeof sessionUserId === "number" && !Number.isNaN(sessionUserId)
        ? sessionUserId
        : null,
    isAdmin: session?.user?.role === "ADMIN",
    hasSecretPasswordAccess: hasPasswordAccess,
  });

  if (!notice) {
    const accessMeta = await findNoticeAccessMetaById(noticeId);

    if (accessMeta.exists && accessMeta.isDeleted) {
      return <ErrorState code={404} message="삭제된 게시물입니다." />;
    }

    notFound();
  }

  if (notice.isSecret && !notice.canViewSecret) {
    const isQnaNotice = notice.categoryName === "QnA";

    return (
      <PostSecretAccessGate
        postId={noticeId}
        hasPassword={Boolean(secretMeta?.hasSecretPassword)}
        message={
          secretMeta?.hasSecretPassword
            ? "비밀번호를 입력하면 게시물을 볼 수 있습니다."
            : isQnaNotice
              ? "이 문의 게시물은 작성자와 관리자만 볼 수 있습니다."
              : "이 게시물은 작성자만 볼 수 있습니다."
        }
      />
    );
  }
  const isAdmin = session?.user?.role === "ADMIN";
  const isQnaNotice = notice.categoryName === "QnA";
  const isBugNotice = notice.categoryName === "버그 제보";
  const isFaqNotice = notice.categoryName === "FAQ";
  const isInquiryNotice = isQnaNotice || isBugNotice;

  if (isFaqNotice) {
    redirect(`/horok-log/notices?category=FAQ&open=${notice.id}`);
  }

  const isOwner = isInquiryNotice
    ? typeof sessionUserId === "number" && notice.userId === sessionUserId
    : isAdmin ||
      (isPublicNoticeCategory(notice.categoryName) &&
        typeof sessionUserId === "number" &&
        notice.userId === sessionUserId);
  const fixedTagOptions = isAdmin
    ? NOTICE_TAG_OPTIONS.filter((option) => option !== "버그 제보")
    : ["QnA"];
  const isUserNoticeMode = isInquiryNotice;
  const backHref = getSafeNoticeBackHref(from);
  const noticePost = {
    id: notice.id,
    title: notice.title,
    content: notice.content,
    thumbnail: notice.thumbnail,
    created_at: notice.publishedAt,
    updated_at: notice.updatedAt,
    author_name: notice.authorName,
    author_image: notice.authorImage,
    category_name: notice.categoryName,
    view_count: notice.viewCount,
    likes_count: notice.likesCount,
    reactions_count: 0,
    comments_count: notice.commentsCount,
    is_banner: notice.isBanner,
    is_resolved: notice.isResolved,
    is_hidden: notice.isHidden,
    is_secret: notice.isSecret,
    can_view_secret: notice.canViewSecret,
    user_id: notice.userId,
    attachments: notice.attachments,
  };
  const inquiryStatus = notice.isResolved
    ? "resolved"
    : notice.hasAdminAnswer
      ? "checking"
      : "waiting";

  return (
    <article className="w-full min-w-0">
      <PostViewTracker
        postId={noticeId}
        title={notice.title}
        href={`/horok-log/notices/${notice.id}`}
      />
      <PostActions
        postId={notice.id}
        initialTitle={notice.title}
        initialContent={notice.content}
        initialCategoryName={isBugNotice ? "QnA" : notice.categoryName}
        initialThumbnail={notice.thumbnail}
        initialIsHidden={notice.isHidden}
        initialIsSecret={notice.isSecret}
        initialIsBanner={notice.isBanner}
        isOwner={isOwner}
        redirectPath="/horok-log/notices"
        categoryLocked
        fixedTagOptions={fixedTagOptions}
        inquiryTagOptions={isUserNoticeMode ? INQUIRY_TAG_OPTIONS : undefined}
        showBannerOption={!isUserNoticeMode}
        allowNoticeBannerForAllCategories={isAdmin}
        headerPost={noticePost}
        headerTitleAddon={
          isInquiryNotice ? (
            <InquiryStatusButton
              postId={notice.id}
              status="resolved"
              initialActive={inquiryStatus === "resolved"}
              canManage={isAdmin}
            />
          ) : null
        }
      >
        <PostContent post={noticePost} />
      </PostActions>
      <PostFooter
        postId={notice.id}
        backHref={backHref}
        showLikeButton
        markCheckingOnAdminReaction={isInquiryNotice && isAdmin}
      />
      {isInquiryNotice ? (
        <>
          {!notice.canViewSecret ? (
            <p className="mt-4 text-sm text-muted-foreground">
              비밀글은 작성자와 관리자만 답변을 확인할 수 있습니다.
            </p>
          ) : null}
          {notice.canViewSecret ? (
            <CommentList
              postId={notice.id}
              headingLabel="답변"
              emptyMessage="아직 등록된 답변이 없습니다."
              composerButtonLabel="답변하기"
              composerPlaceholder="답변을 작성하세요"
              composerSubmitLabel="답변 등록"
              showComposer={isAdmin}
              showComposerSecretOption
              adminOnly
              showReplyButton={false}
            />
          ) : null}
        </>
      ) : !isQnaNotice ? (
        <>
          {!notice.canViewSecret ? (
            <p className="mt-4 text-sm text-muted-foreground">
              비밀글은 작성자와 관리자만 댓글을 확인할 수 있습니다.
            </p>
          ) : null}
          {notice.canViewSecret ? <CommentList postId={notice.id} /> : null}
        </>
      ) : null}
      <PostScrollTopButton />
    </article>
  );
}
