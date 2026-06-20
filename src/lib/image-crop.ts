export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

async function resolveImageSource(src: string) {
  try {
    const response = await fetch(src);

    if (!response.ok) {
      throw new Error("Failed to fetch image");
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return src;
  }
}

export async function getVideoPosterBlobUrl(videoSrc: string) {
  const resolvedSrc = await resolveImageSource(videoSrc);

  return new Promise<string>((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const cleanup = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    video.onloadeddata = () => {
      video.currentTime = Math.min(0.1, video.duration || 0);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");

        if (!context || video.videoWidth === 0 || video.videoHeight === 0) {
          cleanup();
          reject(new Error("동영상 미리보기를 생성하지 못했습니다."));
          return;
        }

        context.drawImage(video, 0, 0);
        canvas.toBlob(
          (blob) => {
            cleanup();

            if (!blob) {
              reject(new Error("동영상 미리보기를 생성하지 못했습니다."));
              return;
            }

            resolve(URL.createObjectURL(blob));
          },
          "image/jpeg",
          0.92,
        );
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("동영상을 불러오지 못했습니다."));
    };

    video.src = resolvedSrc;
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    image.src = src;
  });
}

export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: PixelCrop,
  mimeType = "image/jpeg",
  quality = 0.92,
) {
  const resolvedSrc = await resolveImageSource(imageSrc);

  try {
    const image = await loadImage(resolvedSrc);
    const canvas = document.createElement("canvas");
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("이미지 자르기를 지원하지 않는 환경입니다.");
    }

    context.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height,
    );

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("이미지 자르기에 실패했습니다."));
            return;
          }

          resolve(blob);
        },
        mimeType,
        quality,
      );
    });
  } finally {
    if (resolvedSrc !== imageSrc) {
      URL.revokeObjectURL(resolvedSrc);
    }
  }
}
