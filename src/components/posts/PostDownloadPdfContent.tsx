import type { CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { normalizeHtmlLikeMarkdown } from "@/components/posts/MarkdownRenderer";
import {
  extendSanitizeSchemaForMath,
  normalizeLatexMathDelimiters,
  rehypeKatexPlugin,
  remarkMathPlugin,
} from "@/lib/markdown-math";
import { remarkDisableAutolinkLiterals } from "@/lib/remark-disable-autolink";
import { MARKDOWN_INLINE_CODE_COLOR } from "@/lib/markdown-styles";

type Props = {
  title: string;
  content: string;
  authorName: string;
  createdAtText: string;
  postUrl: string;
};

const bodyStyle: CSSProperties = {
  margin: 0,
  padding: 40,
  backgroundColor: "#ffffff",
  color: "#18181b",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: 16,
  lineHeight: "28px",
};

const headingStyle = (
  fontSize: number,
  color: string,
  fontWeight: CSSProperties["fontWeight"] = 700,
): CSSProperties => ({
  margin: "24px 0 12px",
  fontWeight,
  fontSize,
  lineHeight: 1.3,
  color,
});

const pdfHeadingColors = [
  "#f97316",
  "#ea580c",
  "#c2410c",
  "#18181b",
  "#52525b",
  "#71717a",
] as const;

export default function PostDownloadPdfContent({
  title,
  content,
  authorName,
  createdAtText,
  postUrl,
}: Props) {
  return (
    <div style={bodyStyle}>
      <div
        style={{
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: "1px solid #e4e4e7",
        }}
      >
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 30,
            fontWeight: 700,
            lineHeight: 1.2,
            color: "#18181b",
          }}
        >
          {title}
        </h1>
        <p style={{ margin: "0 0 4px", fontSize: 14, color: "#52525b" }}>
          {authorName} · {createdAtText}
        </p>
        <p style={{ margin: 0, fontSize: 14, color: "#2563eb" }}>{postUrl}</p>
      </div>

      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkDisableAutolinkLiterals, remarkMathPlugin]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, extendSanitizeSchemaForMath()],
          rehypeKatexPlugin,
        ]}
        components={{
          h1: ({ children }) => (
            <h1 style={headingStyle(28, pdfHeadingColors[0])}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 style={headingStyle(24, pdfHeadingColors[1])}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 style={headingStyle(20, pdfHeadingColors[2], 600)}>
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 style={headingStyle(18, pdfHeadingColors[3], 600)}>
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 style={headingStyle(16, pdfHeadingColors[4], 500)}>
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 style={headingStyle(14, pdfHeadingColors[5], 500)}>
              {children}
            </h6>
          ),
          p: ({ children }) => (
            <p style={{ margin: "16px 0", whiteSpace: "pre-wrap" }}>
              {children}
            </p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              style={{ color: "#2563eb", textDecoration: "underline" }}
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: "16px 0", paddingLeft: 24 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: "16px 0", paddingLeft: 24 }}>{children}</ol>
          ),
          li: ({ children }) => <li style={{ margin: "4px 0" }}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote
              style={{
                margin: "16px 0",
                paddingLeft: 16,
                borderLeft: "4px solid #d4d4d8",
                color: "#52525b",
              }}
            >
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code
              style={{
                display: "inline-block",
                width: "fit-content",
                maxWidth: "100%",
                backgroundColor: MARKDOWN_INLINE_CODE_COLOR,
                color: "#18181b",
                borderRadius: 4,
                padding: "0 2px",
                fontFamily: "monospace",
                fontSize: "0.9em",
                lineHeight: 1.35,
              }}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              style={{
                margin: "16px 0",
                padding: 16,
                overflowX: "auto",
                borderRadius: 8,
                backgroundColor: "#f4f4f5",
                color: "#18181b",
                fontFamily: "monospace",
                fontSize: 14,
                lineHeight: "22px",
              }}
            >
              {children}
            </pre>
          ),
          img: ({ src, alt }) => (
            // biome-ignore lint/performance/noImgElement: PDF export needs native image rendering
            <img
              src={typeof src === "string" ? src : ""}
              alt={alt ?? ""}
              crossOrigin="anonymous"
              style={{
                display: "block",
                margin: "16px 0",
                maxWidth: "100%",
                height: "auto",
              }}
            />
          ),
          sup: ({ children }) => (
            <sup
              style={{
                verticalAlign: "super",
                fontSize: "0.75em",
                lineHeight: 0,
              }}
            >
              {children}
            </sup>
          ),
          sub: ({ children }) => (
            <sub
              style={{
                verticalAlign: "sub",
                fontSize: "0.75em",
                lineHeight: 0,
              }}
            >
              {children}
            </sub>
          ),
          hr: () => (
            <hr
              style={{
                margin: "24px 0",
                border: 0,
                borderTop: "1px solid #e4e4e7",
              }}
            />
          ),
          table: ({ children }) => (
            <table
              style={{
                width: "100%",
                margin: "16px 0",
                borderCollapse: "collapse",
              }}
            >
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th
              style={{
                border: "1px solid #e4e4e7",
                padding: "8px 12px",
                backgroundColor: "#f4f4f5",
                textAlign: "left",
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              style={{
                border: "1px solid #e4e4e7",
                padding: "8px 12px",
              }}
            >
              {children}
            </td>
          ),
        }}
      >
        {normalizeLatexMathDelimiters(normalizeHtmlLikeMarkdown(content))}
      </ReactMarkdown>
    </div>
  );
}
