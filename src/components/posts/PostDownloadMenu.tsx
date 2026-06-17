"use client";

import { ChevronDown, Download, FileText } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { downloadPostMarkdownFile } from "@/lib/post-download";
import { downloadPostPdfFile } from "@/lib/post-download-pdf";
import { cn, formatSeoulDateTime } from "@/lib/utils";

type Props = {
  postId: number;
  title: string;
  content: string;
  authorName: string;
  createdAt: Date;
  initialMarkdownCount?: number;
  initialPdfCount?: number;
  className?: string;
};

function getPostUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.href;
}

export default function PostDownloadMenu({
  postId,
  title,
  content,
  authorName,
  createdAt,
  initialMarkdownCount = 0,
  initialPdfCount = 0,
  className,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [markdownCount, setMarkdownCount] = useState(initialMarkdownCount);
  const [pdfCount, setPdfCount] = useState(initialPdfCount);

  async function trackDownload(type: "markdown" | "pdf") {
    try {
      const response = await fetch(`/api/posts/${postId}/downloads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type }),
      });
      const payload = await response.json().catch(() => null);

      if (response.ok) {
        if (typeof payload?.markdownCount === "number") {
          setMarkdownCount(payload.markdownCount);
        }

        if (typeof payload?.pdfCount === "number") {
          setPdfCount(payload.pdfCount);
        }
      }
    } catch {
      // Download should still succeed even if tracking is unavailable.
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  async function handleDownloadPdf() {
    if (isDownloadingPdf) {
      return;
    }

    setIsDownloadingPdf(true);
    setDownloadError(null);

    try {
      await downloadPostPdfFile({
        title,
        content,
        authorName,
        createdAtText: formatSeoulDateTime(createdAt),
        postUrl: getPostUrl(),
      });
      void trackDownload("pdf");
      setIsOpen(false);
    } catch {
      setDownloadError("PDF 다운로드 중 오류가 발생했습니다.");
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  function handleDownloadMarkdown() {
    downloadPostMarkdownFile({
      title,
      content,
      authorName,
      createdAt,
      postUrl: getPostUrl(),
    });
    void trackDownload("markdown");
    setIsOpen(false);
    setDownloadError(null);
  }

  return (
    <div ref={menuRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-border/80 bg-background px-2.5 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
        aria-expanded={isOpen}
        aria-label="게시글 다운로드"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">다운로드</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            isOpen ? "rotate-180" : "",
          )}
          aria-hidden="true"
        />
      </button>

      <div
        className={cn(
          "absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-44 overflow-hidden rounded-md border border-border bg-background shadow-md transition-all duration-200",
          isOpen
            ? "pointer-events-auto max-h-40 opacity-100"
            : "pointer-events-none max-h-0 opacity-0",
        )}
      >
        <button
          type="button"
          onClick={handleDownloadMarkdown}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-muted/60"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">Markdown (.md)</span>
          <span className="font-semibold tabular-nums text-muted-foreground">
            {markdownCount}
          </span>
        </button>
        <div className="h-px bg-border" />
        <button
          type="button"
          onClick={() => void handleDownloadPdf()}
          disabled={isDownloadingPdf}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            {isDownloadingPdf ? "PDF 생성 중..." : "PDF (.pdf)"}
          </span>
          <span className="font-semibold tabular-nums text-muted-foreground">
            {pdfCount}
          </span>
        </button>
      </div>

      {downloadError ? (
        <p className="absolute right-0 top-[calc(100%+0.25rem)] z-10 w-max max-w-52 text-right text-xs text-red-500">
          {downloadError}
        </p>
      ) : null}
    </div>
  );
}
