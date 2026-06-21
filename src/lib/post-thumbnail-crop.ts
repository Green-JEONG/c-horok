import type { CSSProperties } from "react";

export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PostThumbnailCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function normalizePostThumbnailCrop(
  pixelCrop: PixelCrop,
  naturalWidth: number,
  naturalHeight: number,
): PostThumbnailCrop {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    throw new Error("Invalid image dimensions");
  }

  const x = pixelCrop.x / naturalWidth;
  const y = pixelCrop.y / naturalHeight;
  const width = pixelCrop.width / naturalWidth;
  const height = pixelCrop.height / naturalHeight;

  return {
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.max(0, Math.min(width, 1 - x)),
    height: Math.max(0, Math.min(height, 1 - y)),
  };
}

export function denormalizePostThumbnailCrop(
  crop: PostThumbnailCrop,
  naturalWidth: number,
  naturalHeight: number,
): PixelCrop {
  return {
    x: Math.round(crop.x * naturalWidth),
    y: Math.round(crop.y * naturalHeight),
    width: Math.max(1, Math.round(crop.width * naturalWidth)),
    height: Math.max(1, Math.round(crop.height * naturalHeight)),
  };
}

export function parsePostThumbnailCrop(value: unknown): PostThumbnailCrop | null {
  if (typeof value === "string") {
    try {
      return parsePostThumbnailCrop(JSON.parse(value));
    } catch {
      return null;
    }
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const x = Number(record.x);
  const y = Number(record.y);
  const width = Number(record.width);
  const height = Number(record.height);

  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    x < 0 ||
    y < 0
  ) {
    return null;
  }

  const clampedWidth = Math.min(width, 1 - x);
  const clampedHeight = Math.min(height, 1 - y);

  if (clampedWidth <= 0 || clampedHeight <= 0) {
    return null;
  }

  return {
    x,
    y,
    width: clampedWidth,
    height: clampedHeight,
  };
}

export function getPostThumbnailCropStyle(
  crop: PostThumbnailCrop,
): CSSProperties {
  return {
    position: "absolute",
    width: `calc(100% / ${crop.width})`,
    height: `calc(100% / ${crop.height})`,
    maxWidth: "none",
    left: `calc(-100% * ${crop.x} / ${crop.width})`,
    top: `calc(-100% * ${crop.y} / ${crop.height})`,
  };
}

export function parseThumbnailCropFromRequestBody(
  body: Record<string, unknown>,
): PostThumbnailCrop | null | undefined {
  if (!("thumbnailCrop" in body)) {
    return undefined;
  }

  if (body.thumbnailCrop === null) {
    return null;
  }

  return parsePostThumbnailCrop(body.thumbnailCrop);
}

export function resolvePostThumbnailCrop(
  mapValue: PostThumbnailCrop | null | undefined,
  fieldValue: unknown,
): PostThumbnailCrop | null {
  if (mapValue) {
    return mapValue;
  }

  return parsePostThumbnailCrop(fieldValue);
}
