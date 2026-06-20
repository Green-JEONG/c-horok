"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";
import ProfileImagePreviewModal from "@/components/common/ProfileImagePreviewModal";
import { Button } from "@/components/ui/button";
import type { PixelCrop } from "@/lib/image-crop";
import type { PostThumbnailCrop } from "@/lib/post-thumbnail-crop";

export type ImageCropCompleteResult = {
  pixelCrop: PixelCrop;
  naturalWidth: number;
  naturalHeight: number;
};

type ImageCropModalProps = {
  open: boolean;
  imageSrc: string;
  aspect?: number;
  initialCrop?: PostThumbnailCrop | null;
  onClose: () => void;
  onComplete: (result: ImageCropCompleteResult) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  isSaving?: boolean;
  isDeleting?: boolean;
};

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

type ResizeHandle = "nw" | "ne" | "sw" | "se";

type InteractionState = {
  mode: "move" | "resize";
  handle?: ResizeHandle;
  pointerId: number;
  startX: number;
  startY: number;
  originCrop: CropRect;
};

const MIN_CROP_WIDTH = 48;
const HANDLE_SIZE = 12;

function getImageLayout(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): ImageLayout {
  const scale = Math.min(
    containerWidth / naturalWidth,
    containerHeight / naturalHeight,
  );
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;

  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
    scale,
  };
}

function getMaxCropSize(
  displayWidth: number,
  displayHeight: number,
  aspect: number,
) {
  if (displayWidth / displayHeight > aspect) {
    return {
      width: displayHeight * aspect,
      height: displayHeight,
    };
  }

  return {
    width: displayWidth,
    height: displayWidth / aspect,
  };
}

function constrainCropRect(
  crop: CropRect,
  layout: ImageLayout,
  aspect: number,
): CropRect {
  let width = Math.max(MIN_CROP_WIDTH, crop.width);
  let height = width / aspect;

  if (width > layout.width) {
    width = layout.width;
    height = width / aspect;
  }

  if (height > layout.height) {
    height = layout.height;
    width = height * aspect;
  }

  const x = Math.min(
    Math.max(crop.x, layout.x),
    layout.x + layout.width - width,
  );
  const y = Math.min(
    Math.max(crop.y, layout.y),
    layout.y + layout.height - height,
  );

  return { x, y, width, height };
}

function centerCropRect(
  cropWidth: number,
  cropHeight: number,
  layout: ImageLayout,
  aspect: number,
): CropRect {
  return constrainCropRect(
    {
      x: layout.x + (layout.width - cropWidth) / 2,
      y: layout.y + (layout.height - cropHeight) / 2,
      width: cropWidth,
      height: cropHeight,
    },
    layout,
    aspect,
  );
}

function cropRectToPixelCrop(crop: CropRect, layout: ImageLayout) {
  const scale = layout.scale;

  return {
    x: Math.round((crop.x - layout.x) / scale),
    y: Math.round((crop.y - layout.y) / scale),
    width: Math.round(crop.width / scale),
    height: Math.round(crop.height / scale),
  };
}

function postThumbnailCropToCropRect(
  crop: PostThumbnailCrop,
  layout: ImageLayout,
  aspect: number,
): CropRect {
  return constrainCropRect(
    {
      x: layout.x + crop.x * layout.width,
      y: layout.y + crop.y * layout.height,
      width: crop.width * layout.width,
      height: crop.height * layout.height,
    },
    layout,
    aspect,
  );
}

function resizeCropRect(
  origin: CropRect,
  dx: number,
  dy: number,
  handle: ResizeHandle,
  layout: ImageLayout,
  aspect: number,
): CropRect {
  const right = origin.x + origin.width;
  const bottom = origin.y + origin.height;

  const sizeFromCornerDelta = (
    growX: number,
    growY: number,
    anchorX: number,
    anchorY: number,
  ) => {
    const widthFromX = origin.width + growX;
    const heightFromY = origin.height + growY;
    const widthFromY = heightFromY * aspect;
    const heightFromX = widthFromX / aspect;

    let width: number;
    let height: number;

    if (Math.abs(growX) >= Math.abs(growY * aspect)) {
      width = widthFromX;
      height = heightFromX;
    } else {
      width = widthFromY;
      height = heightFromY;
    }

    let x = anchorX;
    let y = anchorY;

    if (anchorX === right) {
      x = right - width;
    }

    if (anchorY === bottom) {
      y = bottom - height;
    }

    return constrainCropRect({ x, y, width, height }, layout, aspect);
  };

  switch (handle) {
    case "se":
      return sizeFromCornerDelta(dx, dy, origin.x, origin.y);
    case "nw":
      return sizeFromCornerDelta(-dx, -dy, right, bottom);
    case "ne":
      return sizeFromCornerDelta(dx, -dy, origin.x, bottom);
    case "sw":
      return sizeFromCornerDelta(-dx, dy, right, origin.y);
    default:
      return origin;
  }
}

const RESIZE_HANDLES: Array<{
  handle: ResizeHandle;
  className: string;
  cursor: string;
  ariaLabel: string;
}> = [
  {
    handle: "nw",
    className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
    cursor: "nwse-resize",
    ariaLabel: "왼쪽 위 모서리 크기 조절",
  },
  {
    handle: "ne",
    className: "right-0 top-0 translate-x-1/2 -translate-y-1/2",
    cursor: "nesw-resize",
    ariaLabel: "오른쪽 위 모서리 크기 조절",
  },
  {
    handle: "sw",
    className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
    cursor: "nesw-resize",
    ariaLabel: "왼쪽 아래 모서리 크기 조절",
  },
  {
    handle: "se",
    className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
    cursor: "nwse-resize",
    ariaLabel: "오른쪽 아래 모서리 크기 조절",
  },
];

export default function ImageCropModal({
  open,
  imageSrc,
  aspect = 16 / 9,
  initialCrop = null,
  onClose,
  onComplete,
  onDelete,
  isSaving = false,
  isDeleting = false,
}: ImageCropModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<InteractionState | null>(null);

  const [resolvedImageSrc, setResolvedImageSrc] = useState(imageSrc);
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [layout, setLayout] = useState<ImageLayout | null>(null);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [interactionMode, setInteractionMode] = useState<
    "move" | "resize" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const updateLayout = useCallback(() => {
    const container = containerRef.current;

    if (!container || !naturalSize) {
      return;
    }

    const nextLayout = getImageLayout(
      container.clientWidth,
      container.clientHeight,
      naturalSize.width,
      naturalSize.height,
    );
    const nextMaxCrop = getMaxCropSize(
      nextLayout.width,
      nextLayout.height,
      aspect,
    );

    setLayout(nextLayout);
    setCropRect((current) => {
      if (!current) {
        if (initialCrop) {
          return postThumbnailCropToCropRect(initialCrop, nextLayout, aspect);
        }

        return centerCropRect(
          nextMaxCrop.width,
          nextMaxCrop.height,
          nextLayout,
          aspect,
        );
      }

      const centerX = current.x + current.width / 2;
      const centerY = current.y + current.height / 2;
      const widthRatio = current.width / nextMaxCrop.width;
      const nextWidth = nextMaxCrop.width * widthRatio;
      const nextHeight = nextWidth / aspect;

      return constrainCropRect(
        {
          x: centerX - nextWidth / 2,
          y: centerY - nextHeight / 2,
          width: nextWidth,
          height: nextHeight,
        },
        nextLayout,
        aspect,
      );
    });
  }, [aspect, initialCrop, naturalSize]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    async function loadImage() {
      try {
        const response = await fetch(imageSrc);

        if (!response.ok) {
          throw new Error("Failed to fetch image");
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);

        if (!cancelled) {
          setResolvedImageSrc(objectUrl);
        }
      } catch {
        if (!cancelled) {
          setResolvedImageSrc(imageSrc);
        }
      }
    }

    void loadImage();

    return () => {
      cancelled = true;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [imageSrc, open]);

  useEffect(() => {
    if (!open) {
      setNaturalSize(null);
      setLayout(null);
      setCropRect(null);
      setInteractionMode(null);
      setError(null);
      interactionRef.current = null;
      return;
    }
  }, [open, imageSrc]);

  useEffect(() => {
    if (!open || !naturalSize) {
      return;
    }

    updateLayout();

    const container = containerRef.current;

    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateLayout();
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [naturalSize, open, updateLayout]);

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    setNaturalSize({
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
  };

  const startInteraction = (
    event: React.PointerEvent<HTMLElement>,
    mode: "move" | "resize",
    handle?: ResizeHandle,
  ) => {
    if (!cropRect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    interactionRef.current = {
      mode,
      handle,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originCrop: cropRect,
    };
    setInteractionMode(mode);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;

    if (!interaction || !layout || interaction.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - interaction.startX;
    const dy = event.clientY - interaction.startY;

    if (interaction.mode === "move") {
      setCropRect(
        constrainCropRect(
          {
            ...interaction.originCrop,
            x: interaction.originCrop.x + dx,
            y: interaction.originCrop.y + dy,
          },
          layout,
          aspect,
        ),
      );
      return;
    }

    if (interaction.handle) {
      setCropRect(
        resizeCropRect(
          interaction.originCrop,
          dx,
          dy,
          interaction.handle,
          layout,
          aspect,
        ),
      );
    }
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const interaction = interactionRef.current;

    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    interactionRef.current = null;
    setInteractionMode(null);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  async function handleApply() {
    if (!cropRect || !layout) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const pixelCrop = cropRectToPixelCrop(cropRect, layout);
      const naturalWidth = layout.width / layout.scale;
      const naturalHeight = layout.height / layout.scale;

      await onComplete({
        pixelCrop,
        naturalWidth,
        naturalHeight,
      });
    } catch (cropError) {
      setError(
        cropError instanceof Error
          ? cropError.message
          : "이미지 자르기에 실패했습니다.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  const isBusy = isSaving || isProcessing || isDeleting;

  return (
    <ProfileImagePreviewModal
      open={open}
      onClose={onClose}
      ariaLabel="썸네일 편집"
      contentClassName="w-[min(92vw,420px)]"
      showCloseButton={false}
    >
      <div className="space-y-4">
        <div
          ref={containerRef}
          className="relative isolate h-[225px] w-full overflow-hidden bg-muted"
        >
          <img
            src={resolvedImageSrc}
            alt=""
            draggable={false}
            onLoad={handleImageLoad}
            className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-contain"
          />

          {cropRect ? (
            <div
              className="absolute z-10 touch-none select-none"
              style={{
                left: cropRect.x,
                top: cropRect.y,
                width: cropRect.width,
                height: cropRect.height,
                boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)",
              }}
            >
              <div
                role="presentation"
                className="absolute inset-0 cursor-grab active:cursor-grabbing"
                style={{
                  cursor:
                    interactionMode === "move" ? "grabbing" : "grab",
                }}
                onPointerDown={(event) => startInteraction(event, "move")}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <div className="pointer-events-none absolute inset-0 border-2 border-white/90" />
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute inset-y-0 left-1/3 border-l border-white/50" />
                  <div className="absolute inset-y-0 left-2/3 border-l border-white/50" />
                  <div className="absolute inset-x-0 top-1/3 border-t border-white/50" />
                  <div className="absolute inset-x-0 top-2/3 border-t border-white/50" />
                </div>
              </div>

              {RESIZE_HANDLES.map(({ handle, className, cursor, ariaLabel }) => (
                <button
                  key={handle}
                  type="button"
                  aria-label={ariaLabel}
                  className={`absolute z-20 rounded-full border-2 border-white bg-primary shadow-sm ${className}`}
                  style={{
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    cursor,
                  }}
                  onPointerDown={(event) =>
                    startInteraction(event, "resize", handle)
                  }
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                />
              ))}
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-500">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isBusy}
          >
            취소
          </Button>
          {onDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onDelete()}
              disabled={isBusy}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            onClick={() => void handleApply()}
            disabled={isBusy || !cropRect}
            className="text-white dark:text-white"
          >
            {isSaving || isProcessing ? "저장 중..." : "적용"}
          </Button>
        </div>
      </div>
    </ProfileImagePreviewModal>
  );
}
