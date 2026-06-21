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
};

type TextareaWithValueTracker = HTMLTextAreaElement & {
  _valueTracker?: { setValue: (value: string) => void };
};

function syncTextareaToReact(textarea: HTMLTextAreaElement) {
  const valueTracker = (textarea as TextareaWithValueTracker)._valueTracker;
  valueTracker?.setValue("");
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function setTextareaSelection(
  textarea: HTMLTextAreaElement,
  selectionStart: number,
  selectionEnd = selectionStart,
) {
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(selectionStart, selectionEnd);
  });
}

function insertTextareaText(textarea: HTMLTextAreaElement, text: string) {
  textarea.focus();
  const inserted = document.execCommand("insertText", false, text);
  if (!inserted) {
    return false;
  }

  syncTextareaToReact(textarea);
  return true;
}

function deleteTextareaSelection(textarea: HTMLTextAreaElement) {
  textarea.focus();
  const deleted = document.execCommand("delete", false);
  if (!deleted) {
    return false;
  }

  syncTextareaToReact(textarea);
  return true;
}

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
  textarea: HTMLTextAreaElement,
  value: string,
  start: number,
  end: number,
) {
  const closer = AUTO_PAIR_OPENERS[event.key];

  if (closer) {
    event.preventDefault();

    if (start !== end) {
      const selectedText = value.slice(start, end);
      if (
        !insertTextareaText(textarea, `${event.key}${selectedText}${closer}`)
      ) {
        return false;
      }

      setTextareaSelection(textarea, start + 1, end + 1);
      return true;
    }

    if (value[start] === closer) {
      setTextareaSelection(textarea, start + 1);
      return true;
    }

    if (!insertTextareaText(textarea, `${event.key}${closer}`)) {
      return false;
    }

    setTextareaSelection(textarea, start + 1);
    return true;
  }

  if (
    AUTO_PAIR_CLOSERS.has(event.key) &&
    start === end &&
    value[start] === event.key
  ) {
    event.preventDefault();
    setTextareaSelection(textarea, start + 1);
    return true;
  }

  return false;
}

function handleCodeBlockEnter(
  event: KeyboardEvent<HTMLTextAreaElement>,
  textarea: HTMLTextAreaElement,
  value: string,
  start: number,
) {
  const { lineStart, lineEnd, currentLine } = getLineBounds(value, start);
  const leadingWhitespace = currentLine.match(/^(\s*)/)?.[1] ?? "";

  if (currentLine.trim().length === 0 && leadingWhitespace.length > 0) {
    event.preventDefault();
    textarea.setSelectionRange(lineStart, lineEnd);
    if (!deleteTextareaSelection(textarea)) {
      return false;
    }

    setTextareaSelection(textarea, lineStart);
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

  if (!insertTextareaText(textarea, insertedText)) {
    return false;
  }

  setTextareaSelection(textarea, start + insertedText.length);
  return true;
}

export function handleMarkdownEditorKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  { isComposing = false }: MarkdownEditorKeyDownOptions = {},
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
    insertTextareaText(textarea, TAB_SPACES);
    return;
  }

  if (start === end && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (handleAutoPair(event, textarea, value, start, end)) {
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
    handleCodeBlockEnter(event, textarea, value, start);
    return;
  }

  const { lineStart, currentLine } = getLineBounds(value, start);
  const orderedMatch = currentLine.match(/^(\d+)\.\s(.*)$/);
  const unorderedMatch = currentLine.match(/^-\s(.*)$/);

  if (!orderedMatch && !unorderedMatch) {
    return;
  }

  event.preventDefault();

  if (orderedMatch) {
    const [, currentNumber, currentText] = orderedMatch;

    if (currentText.trim().length === 0) {
      textarea.setSelectionRange(lineStart, lineStart + orderedMatch[0].length);
      deleteTextareaSelection(textarea);
      setTextareaSelection(textarea, lineStart);
      return;
    }

    const nextNumber = Number(currentNumber) + 1;
    const insertedText = `\n${nextNumber}. `;
    insertTextareaText(textarea, insertedText);
    return;
  }

  const unorderedMatchResult = unorderedMatch;
  if (!unorderedMatchResult) {
    return;
  }

  const [, currentText] = unorderedMatchResult;

  if (currentText.trim().length === 0) {
    textarea.setSelectionRange(
      lineStart,
      lineStart + unorderedMatchResult[0].length,
    );
    deleteTextareaSelection(textarea);
    setTextareaSelection(textarea, lineStart);
    return;
  }

  insertTextareaText(textarea, "\n- ");
}

export const markdownHeadingClassName =
  "[&_h1]:text-primary [&_h2]:text-orange-600 dark:[&_h2]:text-orange-400 [&_h3]:text-orange-700 dark:[&_h3]:text-orange-300 [&_h4]:text-foreground [&_h5]:text-muted-foreground [&_h6]:text-muted-foreground";
