import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { DbPost } from "@/lib/db";
import { remarkDisableAutolinkLiterals } from "@/lib/remark-disable-autolink";
import { formatSeoulDateTime } from "@/lib/utils";

export default function PostDetail({ post }: { post: DbPost }) {
  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">{post.title}</h1>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{post.category_name}</span>
        <span>·</span>
        <span>{post.author_name}</span>
        <span>·</span>
        <span>{formatSeoulDateTime(post.created_at)}</span>
      </div>

      <hr />

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkDisableAutolinkLiterals]}
          rehypePlugins={[rehypeSanitize, rehypeHighlight]}
        >
          {post.content}
        </ReactMarkdown>
      </div>
    </article>
  );
}
