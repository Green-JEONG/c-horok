import type { KeyboardEvent } from "react";

const TAB_SPACES = "    ";

type MarkdownEditorKeyDownOptions = {
  isComposing?: boolean;
  onUpdate: (
    nextContent: string,
    selectionStart: number,
    selectionEnd?: number,
  ) => void;
};

export function handleMarkdownEditorKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  { isComposing = false, onUpdate }: MarkdownEditorKeyDownOptions,
) {
  if (isComposing || event.nativeEvent.isComposing) {
    return;
  }

  const textarea = event.currentTarget;
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  if (event.key === "Tab" && !event.shiftKey) {
    event.preventDefault();
    const nextContent = `${value.slice(0, start)}${TAB_SPACES}${value.slice(end)}`;
    const nextCursor = start + TAB_SPACES.length;
    onUpdate(nextContent, nextCursor);
    return;
  }

  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  if (start !== end) {
    return;
  }

  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lineEndIndex = value.indexOf("\n", start);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const currentLine = value.slice(lineStart, lineEnd);
  const orderedMatch = currentLine.match(/^(\d+)\.\s(.*)$/);
  const unorderedMatch = currentLine.match(/^-\s(.*)$/);

  if (!orderedMatch && !unorderedMatch) {
    return;
  }

  event.preventDefault();

  if (orderedMatch) {
    const [, currentNumber, currentText] = orderedMatch;

    if (currentText.trim().length === 0) {
      const nextContent =
        value.slice(0, lineStart) +
        value.slice(lineStart + orderedMatch[0].length);
      onUpdate(nextContent, lineStart);
      return;
    }

    const nextNumber = Number(currentNumber) + 1;
    const insertedText = `\n${nextNumber}. `;
    const nextContent = `${value.slice(0, start)}${insertedText}${value.slice(end)}`;
    const nextCursorPosition = start + insertedText.length;

    onUpdate(nextContent, nextCursorPosition);
    return;
  }

  const [, currentText] = unorderedMatch!;

  if (currentText.trim().length === 0) {
    const nextContent =
      value.slice(0, lineStart) +
      value.slice(lineStart + unorderedMatch![0].length);
    onUpdate(nextContent, lineStart);
    return;
  }

  const insertedText = "\n- ";
  const nextContent = `${value.slice(0, start)}${insertedText}${value.slice(end)}`;
  const nextCursorPosition = start + insertedText.length;

  onUpdate(nextContent, nextCursorPosition);
}

export const markdownHeadingClassName =
  "[&_h1]:text-primary [&_h2]:text-orange-600 dark:[&_h2]:text-orange-400 [&_h3]:text-orange-700 dark:[&_h3]:text-orange-300 [&_h4]:text-foreground [&_h5]:text-muted-foreground [&_h6]:text-muted-foreground";
