// Small embeddable JPEG thumbnail for the results doc's optional
// thumbnail column, same idea as comp-sheets' own thumbnail/preview
// generation — decode to a canvas (TIFF needs a manual decode, JPEG/PNG
// can go through createImageBitmap directly), then downscale.

import { decodeTiff } from './tiffDecode.js';

export interface Thumbnail {
  bytes: Uint8Array;
  width: number;
  height: number;
}

const MAX_DIM = 240;

function isTiff(blob: Blob, filename: string): boolean {
  return blob.type === 'image/tiff' || /\.tiff?$/i.test(filename);
}

async function drawToCanvas(blob: Blob, filename: string): Promise<HTMLCanvasElement> {
  if (isTiff(blob, filename)) {
    const { width, height, rgba } = decodeTiff(await blob.arrayBuffer());
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.putImageData(new ImageData(rgba, width, height), 0, 0);
    return canvas;
  }
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

export async function generateThumbnail(blob: Blob, filename: string): Promise<Thumbnail> {
  const source = await drawToCanvas(blob, filename);
  const scale = Math.min(1, MAX_DIM / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  const small = document.createElement('canvas');
  small.width = width;
  small.height = height;
  small.getContext('2d')!.drawImage(source, 0, 0, width, height);

  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    small.toBlob((out) => {
      if (!out) {
        reject(new Error('could not generate a thumbnail'));
        return;
      }
      out.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
    }, 'image/jpeg', 0.75);
  });

  return { bytes, width, height };
}
