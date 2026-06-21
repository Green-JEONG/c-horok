import type { KeyboardEvent } from "react";

const TAB_SPACES = "    ";

const AUTO_PAIR_OPENERS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
  "`": "`",
};

const AUTO_PAIR_CLOSERS = new Set(Object.values(AUTO_PAIR_OPENERS));

type MarkdownEditorKeyDownOptions = {
  isComposing?: boolean;
  onUpdate: (
    nextContent: string,
    selectionStart: number,
    selectionEnd?: number,
  ) => void;
};

function getLineBounds(value: string, position: number) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, position - 1)) + 1;
  const lineEndIndex = value.indexOf("\n", position);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

  return {
    lineStart,
    lineEnd,
    currentLine: value.slice(lineStart, lineEnd),
  };
}

function isInsideFencedCodeBlock(value: string, position: number) {
  const before = value.slice(0, position);
  let fenceCount = 0;
  let searchFrom = 0;

  while (searchFrom < before.length) {
    const nextFence = before.indexOf("```", searchFrom);
    if (nextFence === -1) {
      break;
    }

    fenceCount += 1;
    searchFrom = nextFence + 3;
  }

  return fenceCount % 2 === 1;
}

function handleAutoPair(
  event: KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  start: number,
  end: number,
  onUpdate: MarkdownEditorKeyDownOptions["onUpdate"],
) {
  const closer = AUTO_PAIR_OPENERS[event.key];

  if (closer) {
    event.preventDefault();

    if (start !== end) {
      const selectedText = value.slice(start, end);
      const nextContent = `${value.slice(0, start)}${event.key}${selectedText}${closer}${value.slice(end)}`;
      onUpdate(nextContent, start + 1, end + 1);
      return true;
    }

    if (value[start] === closer) {
      onUpdate(value, start + 1);
      return true;
    }

    const nextContent = `${value.slice(0, start)}${event.key}${closer}${value.slice(end)}`;
    onUpdate(nextContent, start + 1);
    return true;
  }

  if (
    AUTO_PAIR_CLOSERS.has(event.key) &&
    start === end &&
    value[start] === event.key
  ) {
    event.preventDefault();
    onUpdate(value, start + 1);
    return true;
  }

  return false;
}

function handleCodeBlockEnter(
  event: KeyboardEvent<HTMLTextAreaElement>,
  value: string,
  start: number,
  onUpdate: MarkdownEditorKeyDownOptions["onUpdate"],
) {
  const { lineStart, lineEnd, currentLine } = getLineBounds(value, start);
  const leadingWhitespace = currentLine.match(/^(\s*)/)?.[1] ?? "";

  if (currentLine.trim().length === 0 && leadingWhitespace.length > 0) {
    event.preventDefault();
    const nextContent = `${value.slice(0, lineStart)}${value.slice(lineEnd)}`;
    onUpdate(nextContent, lineStart);
    return true;
  }

  event.preventDefault();

  const beforeCursor = value.slice(lineStart, start);
  const afterCursor = value.slice(start, lineEnd);
  const nextIndent =
    afterCursor.trim().length === 0 && beforeCursor.trimEnd().endsWith(":")
      ? `${leadingWhitespace}${TAB_SPACES}`
      : leadingWhitespace;
  const insertedText = `\n${nextIndent}`;
  const nextContent = `${value.slice(0, start)}${insertedText}${value.slice(start)}`;
  const nextCursor = start + insertedText.length;

  onUpdate(nextContent, nextCursor);
  return true;
}

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
  const inCodeBlock = isInsideFencedCodeBlock(value, start);

  if (event.key === "Tab" && !event.shiftKey) {
    event.preventDefault();
    const nextContent = `${value.slice(0, start)}${TAB_SPACES}${value.slice(end)}`;
    const nextCursor = start + TAB_SPACES.length;
    onUpdate(nextContent, nextCursor);
    return;
  }

  if (start === end && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (handleAutoPair(event, value, start, end, onUpdate)) {
      return;
    }
  }

  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  if (start !== end) {
    return;
  }

  if (inCodeBlock) {
    handleCodeBlockEnter(event, value, start, onUpdate);
    return;
  }

  const { lineStart, lineEnd, currentLine } = getLineBounds(value, start);
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
