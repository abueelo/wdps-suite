// Turns a PresenterImage's blob into something an <img> can show, at
// full size and correctly oriented. Modern browsers already apply a
// JPEG's EXIF orientation tag when rendering an <img>, so JPEG/PNG need
// nothing extra here — only TIFF needs decoding first, since no browser
// can render it directly.

import { decodeTiff } from '../processing/tiffDecode.js';

function isTiff(blob: Blob, filename: string): boolean {
  return blob.type === 'image/tiff' || /\.tiff?$/i.test(filename);
}

/** Returns an object URL ready to hand to an <img src>. Caller owns revoking it. */
export async function blobToDisplayUrl(blob: Blob, filename: string): Promise<string> {
  if (!isTiff(blob, filename)) {
    return URL.createObjectURL(blob);
  }

  const { width, height, rgba } = decodeTiff(await blob.arrayBuffer());
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.putImageData(new ImageData(rgba, width, height), 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((out) => {
      if (!out) {
        reject(new Error('could not convert this TIFF for display'));
        return;
      }
      resolve(URL.createObjectURL(out));
    }, 'image/jpeg', 0.92);
  });
}
