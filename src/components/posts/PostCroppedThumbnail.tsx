"use client";

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
      {/* biome-ignore lint/performance/noImgElement: crop positioning requires native img for gif animation */}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        draggable={false}
        className="absolute max-w-none select-none"
        style={getPostThumbnailCropStyle(crop!)}
      />
    </div>
  );
}
