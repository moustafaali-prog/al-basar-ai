/**
 * Compress an image data URL or Blob to JPEG with size limits suitable for study storage.
 * Target: max width 1024px, quality 0.7 => ~150-400KB per photo.
 */
export async function compressImageToBlob(
  input: string | Blob,
  maxWidth = 1024,
  quality = 0.7,
): Promise<Blob> {
  const dataUrl = typeof input === 'string' ? input : await blobToDataUrl(input);
  const img = await loadImage(dataUrl);

  const ratio = Math.min(1, maxWidth / img.width);
  const width = Math.round(img.width * ratio);
  const height = Math.round(img.height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality);
  });
  return blob;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
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
