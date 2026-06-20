"use client";

import Image from "next/image";
import { isGifImageUrl } from "@/lib/post-thumbnails";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  loading?: "eager" | "lazy";
  priority?: boolean;
  unoptimized?: boolean;
  quality?: number;
  objectFit?: "cover" | "contain";
};

export default function PostMediaThumbnail({
  src,
  alt,
  className,
  fill = false,
  sizes,
  loading = "lazy",
  priority = false,
  unoptimized = false,
  quality = 90,
  objectFit = "cover",
}: Props) {
  const objectClass =
    objectFit === "contain" ? "object-contain" : "object-cover";

  if (isGifImageUrl(src)) {
    return (
      // biome-ignore lint/performance/noImgElement: animated gif thumbnails must use native img
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        className={cn(
          fill ? `absolute inset-0 h-full w-full ${objectClass}` : `h-full w-full ${objectClass}`,
          className,
        )}
      />
    );
  }

  if (fill) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        loading={loading}
        priority={priority}
        unoptimized={unoptimized}
        quality={quality}
        className={cn(objectClass, className)}
      />
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: thumbnail picker preview
    <img
      src={src}
      alt={alt}
      className={cn(`h-full w-full ${objectClass}`, className)}
    />
  );
}
