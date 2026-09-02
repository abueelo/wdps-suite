// Generates a small preview image for the Review table. JPEG/PNG can be
// shown directly via an object URL — the browser decodes them natively,
// no work needed here. TIFF can't be put in an <img src> in most
// browsers, so it's decoded (reusing the same decoder the export
// pipeline uses) and redrawn at a small size on the main thread. This
// runs once per image (results are cached by the caller), so the cost
// is bounded even though it isn't off-thread like the real export pass.

import { decodeTiff } from '../processing/tiffDecode.js';

const PREVIEW_SIZE = 96;

function isTiff(file: File): boolean {
  return /\.tiff?$/i.test(file.name) || file.type === 'image/tiff';
}

export async function generatePreviewUrl(file: File): Promise<string> {
  if (!isTiff(file)) {
    return URL.createObjectURL(file);
  }

  const buffer = await file.arrayBuffer();
  const { width, height, rgba } = decodeTiff(buffer);

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = width;
  fullCanvas.height = height;
  fullCanvas.getContext('2d')!.putImageData(new ImageData(rgba, width, height), 0, 0);

  const scale = PREVIEW_SIZE / Math.max(width, height);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const small = document.createElement('canvas');
  small.width = targetWidth;
  small.height = targetHeight;
  small.getContext('2d')!.drawImage(fullCanvas, 0, 0, targetWidth, targetHeight);

  return new Promise((resolve, reject) => {
    small.toBlob((blob) => {
      if (!blob) {
        reject(new Error('could not generate a preview for this TIFF'));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.7);
  });
}
