"use client";

import { useEffect, useState } from "react";
import PostMediaThumbnail from "@/components/posts/PostMediaThumbnail";
import {
  getPostThumbnailCropStyle,
  type PostThumbnailCrop,
} from "@/lib/post-thumbnail-crop";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  crop?: PostThumbnailCrop | null;
  className?: string;
  containerClassName?: string;
  fill?: boolean;
  sizes?: string;
  loading?: "eager" | "lazy";
  priority?: boolean;
  unoptimized?: boolean;
  quality?: number;
  objectFit?: "cover" | "contain";
};

function useNaturalImageSize(src: string, enabled: boolean) {
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setNaturalSize(null);
      return;
    }

    let cancelled = false;
    const image = new window.Image();
    image.decoding = "async";
    image.src = src;

    image.onload = () => {
      if (cancelled) {
        return;
      }

      setNaturalSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.onerror = () => {
      if (!cancelled) {
        setNaturalSize(null);
      }
    };

    return () => {
      cancelled = true;
    };
  }, [enabled, src]);

  return naturalSize;
}

export default function PostCroppedThumbnail({
  src,
  alt,
  crop,
  className,
  containerClassName,
  fill = false,
  sizes,
  loading = "lazy",
  priority = false,
  unoptimized = false,
  quality = 90,
  objectFit = "cover",
}: Props) {
  const hasCrop = Boolean(crop && crop.width > 0 && crop.height > 0);
  const naturalSize = useNaturalImageSize(src, hasCrop);

  if (!hasCrop) {
    return (
      <PostMediaThumbnail
        src={src}
        alt={alt}
        className={className}
        fill={fill}
        sizes={sizes}
        loading={loading}
        priority={priority}
        unoptimized={unoptimized}
        quality={quality}
        objectFit={objectFit}
      />
    );
  }

  return (
    <div
      className={cn(
        fill ? "absolute inset-0" : "relative h-full w-full",
        "overflow-hidden",
        containerClassName,
        className,
      )}
    >
      {naturalSize ? (
        // biome-ignore lint/performance/noImgElement: crop positioning requires native img for gif animation
        <img
          src={src}
          alt={alt}
          width={naturalSize.width}
          height={naturalSize.height}
          loading={loading}
          decoding={priority ? "sync" : "async"}
          fetchPriority={priority ? "high" : undefined}
          draggable={false}
          className="absolute max-w-none select-none"
          style={getPostThumbnailCropStyle(crop!)}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-zinc-900/40" />
      )}
    </div>
  );
}
