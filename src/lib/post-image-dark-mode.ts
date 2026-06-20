const BRIGHT_LUMINANCE_THRESHOLD = 0.62;
const SAMPLE_SIZE = 32;

export function getAverageImageLuminance(image: HTMLImageElement): number | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    let total = 0;
    const pixelCount = data.length / 4;

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      total += (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
    }

    return total / pixelCount;
  } catch {
    return null;
  }
}

export function shouldDarkenImageInDarkMode(image: HTMLImageElement): boolean {
  const averageLuminance = getAverageImageLuminance(image);

  if (averageLuminance === null) {
    return true;
  }

  return averageLuminance >= BRIGHT_LUMINANCE_THRESHOLD;
}

export const postImageDarkModeClassName =
  "transition-[filter] duration-200 dark:brightness-[0.86] dark:contrast-[1.02]";
