import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { seedLegacyBannerNotices } from "@/lib/notices";
import { createPost, deletePost, updatePost } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { horokLogTitle } from "@/lib/page-titles";

export const metadata: Metadata = {
  title: horokLogTitle("관리자"),
  description: "관리자 페이지",
  robots: {
    index: false,
    follow: false,
  },
};

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: "USER" | "ADMIN";
  provider: string | null;
  created_at: string;
};
type PostRow = {
  id: number;
  title: string;
  created_at: string;
  is_deleted: number;
  user_id: string;
  author_email: string | null;
  author_name: string | null;
  category_id: number;
  category_name: string | null;
  content: string;
};
type CommentRow = {
  id: number;
  post_id: number;
  user_id: string;
  author_email: string | null;
  author_name: string | null;
  content: string;
  is_deleted: number;
  created_at: string;
  post_title: string | null;
};

const LIMIT_USERS = 30;
const LIMIT_POSTS = 20;
const LIMIT_COMMENTS = 30;

function clampText(s: string, n: number) {
  const t = s ?? "";
  return t.length > n ? `${t.slice(0, n)}...` : t;
}

export default async function AdminPage() {
  const session = await auth();
  const role = session?.user?.role;

  if (!session) redirect("/");
  if (role !== "ADMIN") redirect("/");

  const [userRows, postRows, commentRows] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: LIMIT_USERS,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        provider: true,
        createdAt: true,
      },
    }),
    prisma.post.findMany({
      omit: {
        isResolved: true,
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT_POSTS,
      include: {
        user: { select: { email: true, name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.comment.findMany({
      orderBy: { createdAt: "desc" },
      take: LIMIT_COMMENTS,
      include: {
        user: { select: { email: true, name: true } },
        post: { select: { title: true } },
      },
    }),
  ]);

  const users: UserRow[] = userRows.map((r) => ({
    id: r.id.toString(),
    name: r.name,
    email: r.email,
    role: r.role,
    provider: r.provider,
    created_at: r.createdAt.toISOString(),
  }));

  const posts: PostRow[] = postRows.map((r) => ({
    id: Number(r.id),
    title: r.title,
    content: r.content,
    created_at: r.createdAt.toISOString(),
    is_deleted: r.isDeleted ? 1 : 0,
    user_id: r.userId.toString(),
    author_email: r.user?.email ?? null,
    author_name: r.user?.name ?? null,
    category_id: Number(r.categoryId),
    category_name: r.category?.name ?? null,
  }));

  const comments: CommentRow[] = commentRows.map((r) => ({
    id: Number(r.id),
    post_id: Number(r.postId),
    user_id: r.userId.toString(),
    author_email: r.user?.email ?? null,
    author_name: r.user?.name ?? null,
    content: r.content,
    is_deleted: r.isDeleted ? 1 : 0,
    created_at: r.createdAt.toISOString(),
    post_title: r.post?.title ?? null,
  }));

  async function createPostAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session || session.user.role !== "ADMIN" || !session.user.email)
      return;

    const title = String(formData.get("title") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    const categoryName = String(formData.get("categoryName") ?? "").trim();

    if (!title || !content || !categoryName) return;

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) return;

    await createPost({
      userId: Number(user.id),
      categoryName,
      title,
      content,
    });
  }

  async function updatePostAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") return;

    const postId = Number(formData.get("postId") ?? 0);
    const title = String(formData.get("title") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();
    const categoryName = String(formData.get("categoryName") ?? "").trim();

    if (Number.isNaN(postId) || postId <= 0) return;
    if (!title || !content || !categoryName) return;

    await updatePost({
      postId,
      title,
      content,
      categoryName,
    });
  }

  async function deletePostAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") return;

    const postId = Number(formData.get("postId") ?? 0);
    if (Number.isNaN(postId) || postId <= 0) return;

    await deletePost(postId);
  }

  async function deleteCommentAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") return;

    const commentId = Number(formData.get("commentId") ?? 0);
    if (Number.isNaN(commentId) || commentId <= 0) return;

    await prisma.comment.update({
      where: { id: BigInt(commentId) },
      data: { isDeleted: true },
    });
  }

  async function changeUserRoleAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") return;

    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "USER");
    if (!userId || (role !== "USER" && role !== "ADMIN")) return;

    await prisma.user.update({
      where: { id: BigInt(userId) },
      data: { role },
    });
  }

  async function deleteUserAction(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") return;

    const userId = String(formData.get("userId") ?? "");
    if (!userId) return;

    await prisma.user.delete({
      where: { id: BigInt(userId) },
    });
  }

  async function seedLegacyBannerNoticesAction() {
    "use server";
    const session = await auth();
    if (!session || session.user.role !== "ADMIN" || !session.user.email) {
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) return;

    await seedLegacyBannerNotices(Number(user.id));
    revalidatePath("/");
    revalidatePath("/horok-log/notices");
  }

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="text-sm text-muted-foreground">
            글/회원/댓글 관리를 한 화면에서 처리합니다.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          로그인: <span className="font-medium">{session.user.email}</span>
        </div>
      </header>

      <section className="rounded-2xl border bg-background p-6">
        <h2 className="mb-4 text-lg font-semibold">공지/배너 시드</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          기존 배너 문구 2개를 공지사항 게시물로 저장합니다. 이미 같은 제목의
          공지가 있으면 중복 생성하지 않습니다.
        </p>

        <form action={seedLegacyBannerNoticesAction}>
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            기존 배너 문구를 공지로 저장
          </button>
        </form>
      </section>

      <section className="rounded-2xl border bg-background p-6">
        <h2 className="mb-4 text-lg font-semibold">글쓰기</h2>

        <form action={createPostAction} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              name="title"
              placeholder="제목"
              className="md:col-span-2 w-full rounded-md border px-3 py-2 text-sm"
              required
            />
            <input
              name="categoryName"
              placeholder="카테고리 이름"
              className="w-full rounded-md border px-3 py-2 text-sm"
              required
            />
          </div>

          <textarea
            name="content"
            placeholder="내용"
            className="min-h-40 w-full rounded-md border px-3 py-2 text-sm"
            required
          />

          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            작성하기
          </button>

          <p className="text-xs text-muted-foreground">
            ※ 제출 후 새로고침하면 최신 목록에 반영됩니다.
          </p>
        </form>
      </section>

      <section className="rounded-2xl border bg-background p-6">
        <h2 className="mb-4 text-lg font-semibold">글 관리</h2>

        <div className="space-y-4">
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">게시글이 없습니다.</p>
          ) : (
            posts.map((p) => (
              <div
                key={p.id}
                className="space-y-3 rounded-xl border bg-muted/30 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      #{p.id} {p.title}{" "}
                      {p.is_deleted ? (
                        <span className="ml-2 rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-500">
                          DELETED
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {p.created_at} · {p.author_name ?? "Unknown"}(
                      {p.author_email ?? "no-email"}) ·{" "}
                      {p.category_name ?? `category:${p.category_id}`}
                    </p>
                  </div>

                  <a
                    className="text-xs text-muted-foreground underline hover:text-foreground"
                    href={`/horok-log/feeds/posts/${p.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    상세보기
                  </a>
                </div>

                <form action={updatePostAction} className="space-y-2">
                  <input type="hidden" name="postId" value={p.id} />

                  <div className="grid gap-2 md:grid-cols-3">
                    <input
                      name="title"
                      defaultValue={p.title}
                      className="md:col-span-2 w-full rounded-md border px-3 py-2 text-sm"
                      required
                    />
                    <input
                      name="categoryName"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      defaultValue={p.category_name ?? ""}
                      required
                    />
                  </div>

                  <textarea
                    name="content"
                    defaultValue={p.content}
                    className="min-h-30 w-full rounded-md border px-3 py-2 text-sm"
                    required
                  />

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted"
                    >
                      수정 저장
                    </button>
                  </div>
                </form>

                <form action={deletePostAction}>
                  <input type="hidden" name="postId" value={p.id} />
                  <button
                    type="submit"
                    className="rounded-md border px-3 py-2 text-sm text-red-500 hover:bg-red-500/10"
                  >
                    삭제
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-background p-6">
        <h2 className="mb-4 text-lg font-semibold">댓글 관리 (삭제)</h2>

        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">댓글이 없습니다.</p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    #{c.id}{" "}
                    {c.is_deleted ? (
                      <span className="ml-2 rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-500">
                        DELETED
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-sm">{clampText(c.content, 180)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.created_at} · {c.author_name ?? "Unknown"}(
                    {c.author_email ?? "no-email"}) · 글:{" "}
                    {c.post_title ?? `post#${c.post_id}`}
                  </p>

                  <a
                    className="mt-1 inline-block text-xs text-muted-foreground underline hover:text-foreground"
                    href={`/horok-log/feeds/posts/${c.post_id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    글로 이동
                  </a>
                </div>

                <form action={deleteCommentAction}>
                  <input type="hidden" name="commentId" value={c.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-md border px-3 py-2 text-sm text-red-500 hover:bg-red-500/10"
                  >
                    댓글 삭제(soft)
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-background p-6">
        <h2 className="mb-4 text-lg font-semibold">회원 관리</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">이름</th>
                <th className="py-2 pr-4">이메일</th>
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Role</th>
                <th className="py-2 pr-4">생성일</th>
                <th className="py-2 pr-0">작업</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b align-top">
                  <td className="whitespace-nowrap py-2 pr-4">{u.id}</td>
                  <td className="whitespace-nowrap py-2 pr-4">
                    {u.name ?? "-"}
                  </td>
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="whitespace-nowrap py-2 pr-4">
                    {u.provider ?? "-"}
                  </td>
                  <td className="py-2 pr-4">
                    <form
                      action={changeUserRoleAction}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="userId" value={u.id} />
                      <select
                        name="role"
                        defaultValue={u.role}
                        className="rounded-md border px-2 py-1 text-xs"
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                      >
                        변경
                      </button>
                    </form>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-4">
                    {u.created_at}
                  </td>
                  <td className="py-2 pr-0">
                    <form action={deleteUserAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button
                        type="submit"
                        className="rounded-md border px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
                      >
                        회원 삭제
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-muted-foreground"
                  >
                    회원이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
