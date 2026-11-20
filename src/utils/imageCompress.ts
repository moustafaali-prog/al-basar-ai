/**
 * Compress an image data URL, Blob, canvas or decoded <img> to JPEG with size
 * limits suitable for study storage.
 * Target: max width 1024px, quality 0.85 => ~80-150KB per photo while keeping the
 * pupil / corneal-reflex / eyelid-margin detail readable for the Hirschberg audit.
 */
export async function compressImageToBlob(
  input: string | Blob | HTMLCanvasElement | HTMLImageElement,
  maxWidth = 1024,
  quality = 0.85,
): Promise<Blob> {
  const dataUrl = await resolveSource(input);
  const img = await loadImage(dataUrl);

  const ratio = Math.min(1, maxWidth / img.width);
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas not supported');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality);
  });
  return blob;
}

/** Normalizes any supported image source into a data URL string. */
async function resolveSource(
  input: string | Blob | HTMLCanvasElement | HTMLImageElement,
): Promise<string> {
  if (typeof input === 'string') return input;
  if (typeof HTMLCanvasElement !== 'undefined' && input instanceof HTMLCanvasElement) {
    // A single high-quality JPEG frame is far cheaper in memory than a PNG frame
    // and keeps the pupil/reflex edges intact before the final resize.
    return input.toDataURL('image/jpeg', 0.92);
  }
  if (typeof HTMLImageElement !== 'undefined' && input instanceof HTMLImageElement) {
    return input.src;
  }
  return blobToDataUrl(input as Blob);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Reads a Blob as a data URL (used to preview / persist the compressed photo). */
export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Return a file name safe for Supabase Storage */
export function photoFileName(userId: string, childId: string) {
  const ts = Date.now();
  return `${userId}/${childId}/${ts}.jpg`;
}
