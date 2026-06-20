"use client";

import { X } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type ProfileImagePreviewModalProps = {
  open: boolean;
  onClose: () => void;
  imageSrc?: string;
  alt?: string;
  ariaLabel?: string;
  children?: ReactNode;
  contentClassName?: string;
  imageClassName?: string;
  showCloseButton?: boolean;
};

export default function ProfileImagePreviewModal({
  open,
  onClose,
  imageSrc,
  alt = "이미지",
  ariaLabel = "이미지",
  children,
  contentClassName,
  imageClassName,
  showCloseButton = true,
}: ProfileImagePreviewModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !mounted) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        className="absolute inset-0 z-0 bg-black/60"
        onClick={onClose}
        aria-label="닫기"
      />
      <div
        className={cn(
          "relative z-10 rounded-2xl bg-background p-4 shadow-xl",
          contentClassName,
        )}
      >
        {children ??
          (imageSrc ? (
            <Image
              src={imageSrc}
              alt={alt}
              width={360}
              height={360}
              className={cn(
                "max-h-[80vh] max-w-[80vw] object-contain",
                imageClassName,
              )}
            />
          ) : null)}
        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur-sm transition hover:bg-muted hover:text-foreground"
            aria-label="닫기"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
