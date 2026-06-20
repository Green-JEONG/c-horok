import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ErrorState from "@/components/common/ErrorState";
import CommentList from "@/components/posts/CommentList";
import PostActions from "@/components/posts/PostActions";
import PostContent from "@/components/posts/PostContent";
import PostFooter from "@/components/posts/PostFooter";
import PostScrollTopButton from "@/components/posts/PostScrollTopButton";
import PostSecretAccessGate from "@/components/posts/PostSecretAccessGate";
import PostViewTracker from "@/components/posts/PostViewTracker";
import { findPostAccessMetaById, findPostSeriesByTitle } from "@/lib/db";
import { horokLogTitle } from "@/lib/page-titles";
import { loadPostDetailAccess } from "@/lib/post-detail-access";

type Props = {
  params: Promise<{ id: string }>;
};

function getPostDescription(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, 160);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    return {
      title: horokLogTitle("글"),
    };
  }

  const { post } = await loadPostDetailAccess(postId);

  if (!post || (post.is_secret && !post.can_view_secret)) {
    return {
      title: horokLogTitle("글"),
    };
  }

  return {
    title: horokLogTitle(post.title),
    description: getPostDescription(post.content),
  };
}

export default async function HorokLogPostPage({ params }: Props) {
  const { id } = await params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    notFound();
  }

  const { post, dbUserId, session, secretMeta } =
    await loadPostDetailAccess(postId);

  if (!post) {
    const accessMeta = await findPostAccessMetaById(postId);

    if (accessMeta.exists && accessMeta.isDeleted) {
      return <ErrorState code={404} message="삭제된 게시물입니다." />;
    }

    notFound();
  }

  if (post.is_secret && !post.can_view_secret) {
    return (
      <PostSecretAccessGate
        postId={postId}
        hasPassword={Boolean(secretMeta?.hasSecretPassword)}
        message={
          secretMeta?.hasSecretPassword
            ? "비밀번호를 입력하면 게시물을 볼 수 있습니다."
            : "이 게시물은 작성자만 볼 수 있습니다."
        }
      />
    );
  }

  const isOwner =
    typeof session?.user?.id === "string" &&
    Number(session.user.id) === post.user_id;
  const seriesItems = await findPostSeriesByTitle(post.title, {
    authorUserId: post.user_id,
    includeHiddenForUserId: dbUserId,
    includeHiddenForAdmin: session?.user?.role === "ADMIN",
  });

  return (
    <article className="w-full min-w-0">
      <PostViewTracker postId={postId} title={post.title} />
      <PostActions
        postId={postId}
        initialTitle={post.title}
        initialContent={post.content}
        initialCategoryName={post.category_name}
        initialCategoryNames={post.category_names}
        initialThumbnail={post.thumbnail}
        initialThumbnailCrop={post.thumbnail_crop}
        initialIsHidden={post.is_hidden}
        initialIsSecret={post.is_secret}
        initialCopiedFromPost={post.copied_from_post}
        seriesItems={seriesItems}
        isOwner={isOwner}
        headerPost={post}
      >
        <PostContent post={post} />
      </PostActions>
      <PostFooter postId={postId} />

      {!post.can_view_secret ? (
        <p className="mt-4 text-sm text-muted-foreground">
          비밀글은 작성자와 관리자만 댓글을 확인할 수 있습니다.
        </p>
      ) : null}
      {post.can_view_secret ? <CommentList postId={postId} /> : null}
      <PostScrollTopButton />
    </article>
  );
}
