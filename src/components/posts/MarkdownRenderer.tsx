import type { ComponentProps } from "react";
import { Fragment } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import CodeBlock from "@/components/posts/CodeBlock";
import { cn } from "@/lib/utils";

type Props = {
  content: string;
  className?: string;
};

export default function MarkdownRenderer({ content, className = "" }: Props) {
  const normalizedContent = normalizeHtmlLikeMarkdown(content);
  const segments = splitAlignedSegments(normalizedContent);

  return (
    <div
      className={cn(
        "max-w-none text-left text-base leading-8 text-foreground",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
        "[&_code]:rounded [&_code]:bg-orange-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-orange-900 dark:[&_code]:bg-transparent dark:[&_code]:text-inherit",
        "[&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-bold",
        "[&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold",
        "[&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold",
        "[&_hr]:my-6 [&_hr]:border-border",
        "[&_img]:my-4 [&_img]:block [&_img]:h-auto [&_img]:w-full",
        "[&_li]:my-1",
        "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_p]:my-4 [&_p]:whitespace-pre-wrap",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden",
        "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left",
        "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6",
        className,
      )}
    >
      {segments.map((segment) => (
        <Fragment key={`${segment.type}-${segment.start}`}>
          {segment.type === "markdown" ? (
            renderMarkdownBody(segment.content)
          ) : (
            <div
              className={
                segment.type === "center"
                  ? "text-center"
                  : segment.type === "right"
                    ? "text-right"
                    : "text-left"
              }
            >
              {renderMarkdownBody(segment.content)}
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function renderMarkdownBody(content: string) {
  const sanitizeSchema = {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      code: [...(defaultSchema.attributes?.code ?? []), ["className"]],
      span: [...(defaultSchema.attributes?.span ?? []), ["className"]],
      div: [...(defaultSchema.attributes?.div ?? []), ["className"]],
    },
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight, [rehypeSanitize, sanitizeSchema]]}
      components={{
        img(props) {
          const { src, alt } = props;
          const normalizedAlt = alt?.trim().toLowerCase();

          if (normalizedAlt === "video" && typeof src === "string") {
            const youtubeEmbedUrl = toYouTubeEmbedUrl(src);

            if (youtubeEmbedUrl) {
              return (
                <div className="my-4 overflow-hidden rounded-xl border border-border">
                  <iframe
                    src={youtubeEmbedUrl}
                    title="동영상"
                    className="aspect-video w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              );
            }

            if (isVideoUrl(src)) {
              return (
                // biome-ignore lint/a11y/useMediaCaption: user-uploaded videos do not have caption tracks
                <video
                  src={src}
                  controls
                  playsInline
                  preload="metadata"
                  className="my-4 max-h-[32rem] w-full rounded-xl border border-border bg-black"
                  aria-label="업로드 동영상"
                >
                  동영상을 재생할 수 없습니다.
                </video>
              );
            }
          }

          return (
            // biome-ignore lint/performance/noImgElement: markdown content needs native rendering
            <img
              src={typeof src === "string" ? src : ""}
              alt={alt ?? ""}
              className="my-4 block h-auto w-full"
            />
          );
        },
        code(props) {
          const { children, className: codeClassName, ...rest } = props;
          const code = getCodeText(children).replace(/\n$/, "");
          const isBlockCode =
            /language-/.test(codeClassName ?? "") || code.includes("\n");

          if (!isBlockCode) {
            return (
              <code
                className={[
                  "rounded-md bg-orange-100 px-1.5 py-0.5 font-mono text-[0.9em] text-orange-900 dark:bg-transparent dark:text-inherit",
                  codeClassName,
                ]
                  .filter(Boolean)
                  .join(" ")}
                {...rest}
              >
                {children}
              </code>
            );
          }

          return (
            <CodeBlock code={code} className={codeClassName}>
              {children}
            </CodeBlock>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function splitAlignedSegments(content: string) {
  const pattern = /\[(left|center|right)\]\n?([\s\S]*?)\n?\[\/\1\]/g;
  const segments: Array<{
    type: "markdown" | "left" | "center" | "right";
    content: string;
    start: number;
  }> = [];
  let lastIndex = 0;
  let match = pattern.exec(content);

  while (match) {
    const [fullMatch, align, blockContent] = match;
    const matchIndex = match.index;

    if (matchIndex > lastIndex) {
      segments.push({
        type: "markdown",
        content: content.slice(lastIndex, matchIndex),
        start: lastIndex,
      });
    }

    segments.push({
      type: align as "left" | "center" | "right",
      content: blockContent,
      start: matchIndex,
    });

    lastIndex = matchIndex + fullMatch.length;
    match = pattern.exec(content);
  }

  if (lastIndex < content.length) {
    segments.push({
      type: "markdown",
      content: content.slice(lastIndex),
      start: lastIndex,
    });
  }

  return segments.length > 0
    ? segments
    : [{ type: "markdown" as const, content, start: 0 }];
}

function toYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);

    if (
      parsedUrl.hostname === "youtu.be" ||
      parsedUrl.hostname.endsWith(".youtu.be")
    ) {
      const videoId = parsedUrl.pathname.replace("/", "");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (
      parsedUrl.hostname.includes("youtube.com") &&
      parsedUrl.searchParams.has("v")
    ) {
      return `https://www.youtube.com/embed/${parsedUrl.searchParams.get("v")}`;
    }

    return null;
  } catch {
    return null;
  }
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(getUrlPathname(url));
}

function getUrlPathname(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

function normalizeHtmlLikeMarkdown(content: string): string {
  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<div\s+align=["']left["']>([\s\S]*?)<\/div>/gi,
      (_, text: string) => `[left]\n${text.trim()}\n[/left]`,
    )
    .replace(
      /<div\s+align=["']center["']>([\s\S]*?)<\/div>/gi,
      (_, text: string) => `[center]\n${text.trim()}\n[/center]`,
    )
    .replace(
      /<div\s+align=["']right["']>([\s\S]*?)<\/div>/gi,
      (_, text: string) => `[right]\n${text.trim()}\n[/right]`,
    )
    .replace(/<h1>([\s\S]*?)<\/h1>/gi, (_, text: string) => `# ${text.trim()}`)
    .replace(/<h2>([\s\S]*?)<\/h2>/gi, (_, text: string) => `## ${text.trim()}`)
    .replace(
      /<h3>([\s\S]*?)<\/h3>/gi,
      (_, text: string) => `### ${text.trim()}`,
    )
    .replace(
      /<strong>([\s\S]*?)<\/strong>/gi,
      (_, text: string) => `**${text.trim()}**`,
    )
    .replace(/<b>([\s\S]*?)<\/b>/gi, (_, text: string) => `**${text.trim()}**`)
    .replace(
      /\s*<em>([\s\S]*?)<\/em>\s*/gi,
      (_, text: string) => `*${text.trim()}*`,
    )
    .replace(
      /\s*<i>([\s\S]*?)<\/i>\s*/gi,
      (_, text: string) => `*${text.trim()}*`,
    )
    .replace(
      /<code>([\s\S]*?)<\/code>/gi,
      (_, text: string) => `\`${text.trim()}\``,
    )
    .replace(/<p>([\s\S]*?)<\/p>/gi, (_, text: string) => `${text.trim()}\n\n`);
}

function getCodeText(children: ComponentProps<"code">["children"]): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (!children) return "";
  if (Array.isArray(children)) {
    return children.map((child) => getCodeText(child)).join("");
  }
  if (typeof children === "object" && "props" in children) {
    return getCodeText(
      (
        children as {
          props?: ComponentProps<"code">;
        }
      ).props?.children,
    );
  }
  return "";
}
