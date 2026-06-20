"use client";

import type { CSSProperties } from "react";
import { useCallback, useState } from "react";
import {
  postImageDarkModeClassName,
  shouldDarkenImageInDarkMode,
} from "@/lib/post-image-dark-mode";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
};

export default function PostMarkdownImage({
  src,
  alt,
  className,
  style,
}: Props) {
  const [shouldDarkenInDarkMode, setShouldDarkenInDarkMode] = useState(false);

  const handleLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    setShouldDarkenInDarkMode(shouldDarkenImageInDarkMode(event.currentTarget));
  }, []);

  return (
    // biome-ignore lint/performance/noImgElement: markdown content needs native rendering
    <img
      src={src}
      alt={alt}
      className={cn(
        className,
        shouldDarkenInDarkMode && postImageDarkModeClassName,
      )}
      style={style}
      onLoad={handleLoad}
    />
  );
}
