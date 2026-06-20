"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import {
  postImageDarkModeClassName,
  shouldDarkenImageInDarkMode,
} from "@/lib/post-image-dark-mode";
import { isGifImageUrl } from "@/lib/post-thumbnails";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
};

export default function PostThumbnailImage({ src, alt, className }: Props) {
  const [shouldDarkenInDarkMode, setShouldDarkenInDarkMode] = useState(false);

  const handleLoadingComplete = useCallback((image: HTMLImageElement) => {
    setShouldDarkenInDarkMode(shouldDarkenImageInDarkMode(image));
  }, []);

  if (isGifImageUrl(src)) {
    return (
      // biome-ignore lint/performance/noImgElement: animated gif thumbnails must use native img
      <img
        src={src}
        alt={alt}
        onLoad={(event) =>
          setShouldDarkenInDarkMode(shouldDarkenImageInDarkMode(event.currentTarget))
        }
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          shouldDarkenInDarkMode && postImageDarkModeClassName,
          className,
        )}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority
      loading="eager"
      className={cn(
        className,
        shouldDarkenInDarkMode && postImageDarkModeClassName,
      )}
      onLoadingComplete={handleLoadingComplete}
    />
  );
}
