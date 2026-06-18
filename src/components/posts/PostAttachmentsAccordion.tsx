"use client";

import { ChevronDown, Download, Paperclip } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { DbPostAttachment } from "@/lib/db";
import { formatAttachmentFileSize } from "@/lib/post-attachments";
import { cn } from "@/lib/utils";

type Props = {
  attachments: DbPostAttachment[];
  className?: string;
};

export default function PostAttachmentsAccordion({
  attachments,
  className = "",
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

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

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div ref={menuRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-8 items-center gap-1 rounded-md border border-border/80 bg-background px-2.5 text-sm font-medium text-muted-foreground transition hover:border-primary/30 hover:bg-primary/10 hover:text-foreground"
        aria-expanded={isOpen}
        aria-label="첨부파일"
      >
        <Paperclip className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">첨부파일</span>
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
          "absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-52 overflow-hidden rounded-md border border-border bg-background shadow-md transition-all duration-200",
          isOpen
            ? "pointer-events-auto max-h-80 opacity-100"
            : "pointer-events-none max-h-0 opacity-0",
        )}
      >
        {attachments.map((attachment, index) => {
          const fileSizeLabel = formatAttachmentFileSize(attachment.file_size);

          return (
            <div key={attachment.id}>
              {index > 0 ? <div className="h-px bg-border" /> : null}
              <a
                href={attachment.file_url}
                download={attachment.file_name}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-muted/60"
              >
                <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {attachment.file_name}
                </span>
                {fileSizeLabel ? (
                  <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">
                    {fileSizeLabel}
                  </span>
                ) : null}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
