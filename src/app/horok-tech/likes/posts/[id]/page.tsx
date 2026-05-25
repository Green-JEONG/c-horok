import { notFound } from "next/navigation";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import ErrorState from "@/components/common/ErrorState";
import CommentList from "@/components/posts/CommentList";
import PostActions from "@/components/posts/PostActions";
import PostContent from "@/components/posts/PostContent";
import PostFooter from "@/components/posts/PostFooter";
import PostViewTracker from "@/components/posts/PostViewTracker";
import { getDbUserIdFromSession } from "@/lib/auth-db";
import { findPostAccessMetaById, findPostById } from "@/lib/db";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function HorokTechLikedPostPage({ params }: Props) {
  const { id } = await params;
  const postId = Number(id);

  if (Number.isNaN(postId)) {
    notFound();
  }

  const dbUserId = await getDbUserIdFromSession();
  const session = await auth();
  const post = await findPostById(postId, {
    includeHiddenForUserId: dbUserId,
    includeHiddenForAdmin: session?.user?.role === "ADMIN",
  });
  if (!post) {
    const accessMeta = await findPostAccessMetaById(postId);

    if (accessMeta.exists && accessMeta.isDeleted) {
      return <ErrorState code={404} message="삭제된 게시물입니다." />;
    }

    notFound();
  }

  if (post.is_secret && !post.can_view_secret) {
    return (
      <ErrorState code={403} message="이 게시물은 작성자만 볼 수 있습니다." />
    );
  }

  const isOwner =
    typeof session?.user?.id === "string" &&
    Number(session.user.id) === post.user_id;

  return (
    <article className="w-full">
      <PostViewTracker postId={postId} title={post.title} />
      <PostActions
        postId={postId}
        initialTitle={post.title}
        initialContent={post.content}
        initialCategoryName={post.category_name}
        initialCategoryNames={post.category_names}
        initialThumbnail={post.thumbnail}
        initialIsHidden={post.is_hidden}
        initialIsSecret={post.is_secret}
        isOwner={isOwner}
        redirectPath="/horok-tech/likes"
        headerPost={post}
      >
        <PostContent post={post} />
      </PostActions>
      <PostFooter postId={postId} backHref="/horok-tech/likes" />

      {!post.can_view_secret ? (
        <p className="mt-4 text-sm text-muted-foreground">
          비밀글은 작성자와 관리자만 댓글을 확인할 수 있습니다.
        </p>
      ) : null}
      {post.can_view_secret ? <CommentList postId={postId} /> : null}
    </article>
  );
}
