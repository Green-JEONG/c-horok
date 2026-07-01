import type { ComponentProps, CSSProperties } from "react";
import { Fragment } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import CodeBlock from "@/components/posts/CodeBlock";
import MarkdownAnchor from "@/components/posts/MarkdownAnchor";
import PostMarkdownImage from "@/components/posts/PostMarkdownImage";
import { markdownHeadingClassName } from "@/lib/markdown-editor-keydown";
import {
  extendSanitizeSchemaForMath,
  normalizeLatexMathDelimiters,
  rehypeKatexPlugin,
  remarkMathPlugin,
} from "@/lib/markdown-math";
import {
  markdownInlineCodeClassName,
  markdownInlineCodeContainerClassName,
} from "@/lib/markdown-styles";
import {
  isPostStoragePath,
  normalizePostStorageReference,
} from "@/lib/post-storage";
import { remarkDisableAutolinkLiterals } from "@/lib/remark-disable-autolink";
import {
  parseMarkdownAttributeBlock,
  remarkLinkAttributes,
} from "@/lib/remark-link-attributes";
import { cn } from "@/lib/utils";

type Props = {
  content: string;
  className?: string;
};

const inlineCodeClassName = markdownInlineCodeClassName;

type MarkdownLayout = "default" | "inline-row";

function isUnresolvedPostStorageSource(src?: string | null) {
  const trimmed = src?.trim();

  if (!trimmed || /^(?:https?:|data:|blob:|\/|#)/i.test(trimmed)) {
    return false;
  }

  const normalized = normalizePostStorageReference(trimmed);

  return Boolean(normalized && isPostStoragePath(normalized));
}

function PostStorageUnavailable({ label = "파일" }: { label?: string }) {
  return (
    <span className="my-4 block rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      {label}을 불러올 수 없습니다.
    </span>
  );
}

export default function MarkdownRenderer({ content, className = "" }: Props) {
  const normalizedContent = normalizeLatexMathDelimiters(
    normalizeHtmlLikeMarkdown(content),
  );
  const segments = splitLayoutSegments(normalizedContent);

  return (
    <div
      className={cn(
        "max-w-none text-left text-base leading-8 text-foreground",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
        "[&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
        markdownInlineCodeContainerClassName,
        "[&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:scroll-mt-6 [&_h1]:text-3xl [&_h1]:font-bold",
        "[&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:scroll-mt-6 [&_h2]:text-2xl [&_h2]:font-semibold",
        "[&_h3]:mt-6 [&_h3]:mb-3 [&_h3]:scroll-mt-6 [&_h3]:text-xl [&_h3]:font-semibold",
        "[&_h4]:mt-5 [&_h4]:mb-2 [&_h4]:scroll-mt-6 [&_h4]:text-lg [&_h4]:font-semibold",
        "[&_h5]:mt-4 [&_h5]:mb-2 [&_h5]:scroll-mt-6 [&_h5]:text-base [&_h5]:font-medium",
        "[&_h6]:mt-4 [&_h6]:mb-2 [&_h6]:scroll-mt-6 [&_h6]:text-sm [&_h6]:font-medium",
        markdownHeadingClassName,
        "[&_hr]:my-6 [&_hr]:border-border",
        "[&_img]:max-w-full",
        "[&_li]:my-1",
        "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6",
        "[&_p]:my-4 [&_p]:whitespace-pre-wrap",
        "[&_pre_code]:inline [&_pre_code]:w-auto [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_pre_code]:text-inherit dark:[&_pre_code]:bg-transparent dark:[&_pre_code]:text-inherit",
        "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden",
        "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left",
        "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6",
        "[&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto",
        className,
      )}
    >
      {segments.map((segment) => (
        <Fragment key={`${segment.type}-${segment.start}`}>
          {segment.type === "markdown" ? (
            renderMarkdownBody(segment.content)
          ) : segment.type === "flex" ? (
            <div
              className="my-4 flex flex-wrap items-start"
              style={{ gap: segment.gap ?? 10 }}
            >
              {renderMarkdownBody(segment.content, "inline-row")}
            </div>
          ) : (
            <div
              className={cn(
                "my-4",
                segment.type === "center"
                  ? "text-center"
                  : segment.type === "right"
                    ? "text-right"
                    : "text-left",
              )}
            >
              {renderMarkdownBody(segment.content, "inline-row")}
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function renderMarkdownBody(
  content: string,
  layout: MarkdownLayout = "default",
) {
  const sanitizeSchema = extendSanitizeSchemaForMath({
    ...defaultSchema,
    clobberPrefix: "",
    attributes: {
      ...defaultSchema.attributes,
      a: [...(defaultSchema.attributes?.a ?? []), "href", "target", "rel"],
      h1: [...(defaultSchema.attributes?.h1 ?? []), "id"],
      h2: [...(defaultSchema.attributes?.h2 ?? []), "id"],
      h3: [...(defaultSchema.attributes?.h3 ?? []), "id"],
      h4: [...(defaultSchema.attributes?.h4 ?? []), "id"],
      h5: [...(defaultSchema.attributes?.h5 ?? []), "id"],
      h6: [...(defaultSchema.attributes?.h6 ?? []), "id"],
      code: [...(defaultSchema.attributes?.code ?? []), ["className"]],
      span: [...(defaultSchema.attributes?.span ?? []), ["className"]],
      div: [...(defaultSchema.attributes?.div ?? []), ["className"]],
      img: [
        ...(defaultSchema.attributes?.img ?? []),
        "alt",
        "title",
        "width",
        "height",
      ],
    },
  });

  return (
    <ReactMarkdown
      remarkPlugins={[
        remarkGfm,
        remarkDisableAutolinkLiterals,
        remarkLinkAttributes,
        remarkMathPlugin,
      ]}
      rehypePlugins={[
        rehypeRaw,
        rehypeHighlight,
        rehypeSlug,
        [rehypeSanitize, sanitizeSchema],
        rehypeKatexPlugin,
      ]}
      components={{
        a({ href, children, target, rel, ...props }) {
          const normalizedRel =
            target === "_blank"
              ? (rel ?? "noopener noreferrer")
              : (rel ?? undefined);

          if (isUnresolvedPostStorageSource(href)) {
            return (
              <span className="text-muted-foreground line-through">
                {children}
              </span>
            );
          }

          return (
            <MarkdownAnchor
              href={href}
              target={target}
              rel={normalizedRel}
              {...props}
            >
              {children}
            </MarkdownAnchor>
          );
        },
        p({ children }) {
          if (layout === "inline-row") {
            return <div className="contents">{children}</div>;
          }

          return <p className="whitespace-pre-wrap">{children}</p>;
        },
        img(props) {
          const { src, alt, title, width, height } = props;
          const normalizedSrc = typeof src === "string" ? src : "";
          const normalizedAlt = alt?.trim().toLowerCase();
          const dimensions = parseImageDimensions({
            title: typeof title === "string" ? title : undefined,
            width,
            height,
          });
          const imageStyle = getImageStyle(dimensions);
          const imageClassName =
            layout === "inline-row"
              ? dimensions
                ? "inline-block max-w-full align-top"
                : "inline-block h-auto max-w-full align-top"
              : dimensions
                ? "my-4 block max-w-full"
                : "my-4 block h-auto w-full";

          if (isUnresolvedPostStorageSource(normalizedSrc)) {
            return <PostStorageUnavailable label="이미지" />;
          }

          if (normalizedAlt === "video" && normalizedSrc) {
            const youtubeEmbedUrl = toYouTubeEmbedUrl(normalizedSrc);

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

            if (isVideoUrl(normalizedSrc)) {
              const videoClassName = cn(
                layout === "inline-row" ? "inline-block align-top" : "block",
                "my-4 h-auto w-auto max-w-full max-h-[32rem] rounded-xl border border-border bg-black",
              );

              return (
                // biome-ignore lint/a11y/useMediaCaption: user-uploaded videos do not have caption tracks
                <video
                  src={normalizedSrc}
                  controls
                  playsInline
                  preload="metadata"
                  className={videoClassName}
                  style={imageStyle}
                  aria-label="업로드 동영상"
                >
                  동영상을 재생할 수 없습니다.
                </video>
              );
            }
          }

          return (
            <PostMarkdownImage
              src={normalizedSrc}
              alt={alt ?? ""}
              className={imageClassName}
              style={imageStyle}
            />
          );
        },
        sup({ children }) {
          return <sup className="align-super text-[0.75em]">{children}</sup>;
        },
        sub({ children }) {
          return <sub className="align-sub text-[0.75em]">{children}</sub>;
        },
        code(props) {
          const { children, className: codeClassName, ...rest } = props;
          const code = getCodeText(children).replace(/\n$/, "");
          const isBlockCode =
            /language-/.test(codeClassName ?? "") || code.includes("\n");

          if (!isBlockCode) {
            return (
              <code
                className={[inlineCodeClassName, codeClassName]
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

function splitLayoutSegments(content: string) {
  const pattern =
    /\[(flex(?:\s+gap=(\d+))?|left|center|right)\]\n?([\s\S]*?)\n?\[\/(?:flex|left|center|right)\]/g;
  const segments: Array<{
    type: "markdown" | "left" | "center" | "right" | "flex";
    content: string;
    start: number;
    gap?: number;
  }> = [];
  let lastIndex = 0;
  let match = pattern.exec(content);

  while (match) {
    const [fullMatch, opener, gapValue, blockContent] = match;
    const matchIndex = match.index;
    const isFlex = opener.startsWith("flex");

    if (matchIndex > lastIndex) {
      segments.push({
        type: "markdown",
        content: content.slice(lastIndex, matchIndex),
        start: lastIndex,
      });
    }

    segments.push({
      type: isFlex ? "flex" : (opener as "left" | "center" | "right"),
      content: blockContent,
      start: matchIndex,
      gap: isFlex ? Number(gapValue ?? 10) : undefined,
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

type ImageDimensions = {
  width?: number;
  height?: number;
};

function parseNumericDimension(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function parseImageAttributeBlock(attrBlock: string): ImageDimensions {
  const sizeMatch = attrBlock.trim().match(/^(\d+)\s*x\s*(\d+)$/i);

  return {
    width:
      parseNumericDimension(
        attrBlock.match(/\bwidth\s*=\s*["']?(\d+)["']?/i)?.[1],
      ) ?? parseNumericDimension(sizeMatch?.[1]),
    height:
      parseNumericDimension(
        attrBlock.match(/\bheight\s*=\s*["']?(\d+)["']?/i)?.[1],
      ) ?? parseNumericDimension(sizeMatch?.[2]),
  };
}

function parseImageDimensions({
  title,
  width,
  height,
}: {
  title?: string;
  width?: unknown;
  height?: unknown;
}): ImageDimensions {
  const dimensions: ImageDimensions = {
    width: parseNumericDimension(width),
    height: parseNumericDimension(height),
  };

  if (!title) {
    return dimensions;
  }

  const widthFromTitle = title.match(/width\s*:\s*(\d+)/i)?.[1];
  const heightFromTitle = title.match(/height\s*:\s*(\d+)/i)?.[1];
  const sizeFromTitle = title.match(/(\d+)\s*x\s*(\d+)/i);

  return {
    width:
      dimensions.width ??
      parseNumericDimension(widthFromTitle) ??
      parseNumericDimension(sizeFromTitle?.[1]),
    height:
      dimensions.height ??
      parseNumericDimension(heightFromTitle) ??
      parseNumericDimension(sizeFromTitle?.[2]),
  };
}

function formatImageTitle(dimensions: ImageDimensions): string | undefined {
  const parts: string[] = [];

  if (dimensions.width) {
    parts.push(`width:${dimensions.width}`);
  }

  if (dimensions.height) {
    parts.push(`height:${dimensions.height}`);
  }

  return parts.length > 0 ? parts.join(";") : undefined;
}

function buildMarkdownImage(
  alt: string,
  src: string,
  dimensions?: ImageDimensions,
): string {
  const title = dimensions ? formatImageTitle(dimensions) : undefined;

  return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
}

function getImageStyle(dimensions: ImageDimensions): CSSProperties | undefined {
  const style: CSSProperties = {};

  if (dimensions.width) {
    style.width = dimensions.width;
  }

  if (dimensions.height) {
    style.height = dimensions.height;
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

function convertHtmlImgToMarkdown(content: string): string {
  return content.replace(/<img\b([^>]*?)\/?>/gi, (_, attrs: string) => {
    const src =
      attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1] ??
      attrs.match(/\bsrc\s*=\s*([^\s>]+)/i)?.[1];
    const alt = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";

    if (!src) {
      return "";
    }

    const dimensions = parseImageDimensions({
      width: attrs.match(/\bwidth\s*=\s*["']?(\d+)["']?/i)?.[1],
      height: attrs.match(/\bheight\s*=\s*["']?(\d+)["']?/i)?.[1],
    });

    return buildMarkdownImage(alt, src, dimensions);
  });
}

function parseFlexGap(style: string): number {
  const gapValue = style.match(/gap\s*:\s*(\d+)\s*px?/i)?.[1];
  return gapValue ? Number(gapValue) : 10;
}

function convertHtmlFlexDivs(content: string): string {
  return content.replace(
    /<div\s+style=["']([^"']*display\s*:\s*flex[^"']*)["']\s*>([\s\S]*?)<\/div>/gi,
    (_, style: string, inner: string) =>
      `[flex gap=${parseFlexGap(style)}]\n${inner.trim()}\n[/flex]\n\n`,
  );
}

function convertHtmlAlignedParagraphs(content: string): string {
  return content.replace(
    /<p\s+align=["'](left|center|right)["']\s*>([\s\S]*?)<\/p>/gi,
    (_, align: string, inner: string) =>
      `[${align}]\n${inner.trim()}\n[/${align}]\n\n`,
  );
}

function collapseLayoutBlockImages(content: string): string {
  return content.replace(
    /\[(flex(?:\s+gap=\d+)?|left|center|right)\]\n([\s\S]*?)\n\[\/(?:flex|left|center|right)\]/g,
    (_full, opener: string, blockContent: string) => {
      const collapsed = blockContent
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join(" ");
      const closingTag = opener.startsWith("flex") ? "flex" : opener;

      return `[${opener}]\n${collapsed}\n[/${closingTag}]`;
    },
  );
}

function buildHtmlAnchor(
  text: string,
  url: string,
  attrs: Record<string, string>,
): string {
  const normalizedAttrs = { ...attrs };

  if (normalizedAttrs.target === "_blank" && !normalizedAttrs.rel) {
    normalizedAttrs.rel = "noopener noreferrer";
  }

  const attrString = Object.entries(normalizedAttrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");

  return attrString
    ? `<a href="${url}" ${attrString}>${text}</a>`
    : `<a href="${url}">${text}</a>`;
}

function convertMarkdownLinkAttributes(content: string): string {
  return content.replace(
    /(?<!!)\[([^\]]*)]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)\s*\{([^}]+)\}/g,
    (
      _,
      text: string,
      url: string,
      _existingTitle: string | undefined,
      attrBlock: string,
    ) => {
      const attrs = parseMarkdownAttributeBlock(attrBlock.replace(/^:/, ""));

      if (Object.keys(attrs).length === 0) {
        return _;
      }

      return buildHtmlAnchor(text, url, attrs);
    },
  );
}

function convertMarkdownImageAttributes(content: string): string {
  return content.replace(
    /!\[([^\]]*)]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)\s*\{([^}]+)\}/g,
    (
      _,
      alt: string,
      src: string,
      existingTitle: string | undefined,
      attrBlock: string,
    ) => {
      const dimensions = parseImageDimensions({
        title: existingTitle,
        ...parseImageAttributeBlock(attrBlock.replace(/^:/, "")),
      });

      return buildMarkdownImage(alt, src, dimensions);
    },
  );
}

export function normalizeHtmlLikeMarkdown(content: string): string {
  const normalized = convertHtmlAlignedParagraphs(
    convertHtmlFlexDivs(
      normalizeSupSubTags(content.replace(/<br\s*\/?>/gi, "\n")),
    ),
  )
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
    .replace(
      /<p(?!\s+align=)([^>]*)>([\s\S]*?)<\/p>/gi,
      (_, _attrs: string, text: string) => `${text.trim()}\n\n`,
    );

  return collapseLayoutBlockImages(
    convertMarkdownImageAttributes(
      convertMarkdownLinkAttributes(convertHtmlImgToMarkdown(normalized)),
    ),
  );
}

function normalizeSupSubTags(content: string): string {
  return content
    .replace(
      /<sup\b[^>]*>([\s\S]*?)<\/sup>/gi,
      (_, text: string) => `<sup>${text}</sup>`,
    )
    .replace(
      /<sub\b[^>]*>([\s\S]*?)<\/sub>/gi,
      (_, text: string) => `<sub>${text}</sub>`,
    );
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
