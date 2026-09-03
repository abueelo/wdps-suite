// Decodes an accepted upload (tiff/png/jpeg) in the browser to get its
// pixel dimensions and a small JPEG thumbnail — the same reason
// comp-sheets decodes on-device (apps/comp-sheets/src/lib/processing/
// tiffDecode.ts): browsers can't render TIFF natively, and the file has to
// be decoded to validate it anyway, so there's no server-side round trip
// needed just to get a thumbnail.
import * as UTIF from 'utif2';

const THUMB_MAX = 480;

export interface DecodedForUpload {
  width: number;
  height: number;
  thumbnail: Blob;
}

function decodeTiff(buffer: ArrayBuffer) {
  const ifds = UTIF.decode(buffer);
  if (!ifds.length) throw new Error('no images found in TIFF');
  const first = ifds[0];
  UTIF.decodeImage(buffer, first);
  const rgba = UTIF.toRGBA8(first);
  return { width: first.width, height: first.height, rgba: Uint8ClampedArray.from(rgba) };
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('thumbnail encode failed'))), 'image/jpeg', 0.8);
  });
}

export async function decodeForUpload(file: File): Promise<DecodedForUpload> {
  const isTiff = /\.tiff?$/i.test(file.name);

  let width: number;
  let height: number;
  let full: HTMLCanvasElement | ImageBitmap;

  if (isTiff) {
    const decoded = decodeTiff(await file.arrayBuffer());
    width = decoded.width;
    height = decoded.height;
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    c.getContext('2d')!.putImageData(new ImageData(decoded.rgba, width, height), 0, 0);
    full = c;
  } else {
    const bitmap = await createImageBitmap(file);
    width = bitmap.width;
    height = bitmap.height;
    full = bitmap;
  }

  const scale = Math.min(1, THUMB_MAX / Math.max(width, height));
  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = outW;
  thumbCanvas.height = outH;
  thumbCanvas.getContext('2d')!.drawImage(full, 0, 0, outW, outH);
  if (full instanceof ImageBitmap) full.close();

  return { width, height, thumbnail: await canvasToJpeg(thumbCanvas) };
}
