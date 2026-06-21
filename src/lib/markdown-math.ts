import rehypeKatex from "rehype-katex";
import { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import remarkMath from "remark-math";

export const remarkMathPlugin = remarkMath;

export const rehypeKatexPlugin = rehypeKatex;

const mathCodeClassNames = ["math-inline", "math-display"] as const;

export function extendSanitizeSchemaForMath(
  baseSchema: SanitizeSchema = defaultSchema,
): SanitizeSchema {
  return {
    ...baseSchema,
    attributes: {
      ...baseSchema.attributes,
      code: [
        ...(baseSchema.attributes?.code ?? []),
        ["className", /^language-./, ...mathCodeClassNames],
      ],
    },
  };
}

const codeSegmentPattern = /(```[\s\S]*?```|`[^`\n]+`)/g;

function convertLatexMathDelimiters(text: string): string {
  return text
    .replace(
      /\\\[([\s\S]*?)\\\]/g,
      (_, math: string) => `$$\n${math.trim()}\n$$`,
    )
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, math: string) => `$${math.trim()}$`);
}

export function normalizeLatexMathDelimiters(content: string): string {
  const parts: string[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(codeSegmentPattern)) {
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      parts.push(
        convertLatexMathDelimiters(content.slice(lastIndex, matchIndex)),
      );
    }

    parts.push(match[0]);
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(convertLatexMathDelimiters(content.slice(lastIndex)));
  }

  return parts.length > 0
    ? parts.join("")
    : convertLatexMathDelimiters(content);
}
