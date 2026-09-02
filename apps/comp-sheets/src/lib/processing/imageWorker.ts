/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import { decodeTiff } from './tiffDecode.js';
import { setJpegDpi } from './dpiPatch.js';

export const TARGET_LONGEST_SIDE = 1920;
export const TARGET_DPI = 72;
export const JPEG_EXPORT_QUALITY = 0.9;
export const THUMBNAIL_LONGEST_SIDE = 150;
export const THUMBNAIL_QUALITY = 0.7;

export type Stage = 'decode' | 'resize' | 'encode' | 'dpi' | 'thumbnail' | 'done';
export type ProgressCallback = (stage: Stage) => void;

export interface WorkerResult {
  bytes: Uint8Array<ArrayBuffer>;
  thumbnail: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
}

function isTiff(file: File): boolean {
  return /\.tiff?$/i.test(file.name) || file.type === 'image/tiff';
}

async function decodeToBitmapSource(file: File): Promise<ImageBitmap> {
  if (isTiff(file)) {
    const buffer = await file.arrayBuffer();
    const { width, height, rgba } = decodeTiff(buffer);
    const imageData = new ImageData(rgba, width, height);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    return createImageBitmap(canvas);
  }
  return createImageBitmap(file);
}

function scaledDimensions(width: number, height: number, longestSide: number): { width: number; height: number } {
  const scale = longestSide / Math.max(width, height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

async function drawResized(source: ImageBitmap, width: number, height: number, quality: number): Promise<Uint8Array<ArrayBuffer>> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

async function processImage(file: File, onProgress: ProgressCallback): Promise<WorkerResult> {
  onProgress('decode');
  const bitmap = await decodeToBitmapSource(file);

  onProgress('resize');
  const { width, height } = scaledDimensions(bitmap.width, bitmap.height, TARGET_LONGEST_SIDE);

  onProgress('encode');
  const encoded = await drawResized(bitmap, width, height, JPEG_EXPORT_QUALITY);

  onProgress('dpi');
  const bytes = await setJpegDpi(encoded, TARGET_DPI);

  onProgress('thumbnail');
  const thumbDims = scaledDimensions(bitmap.width, bitmap.height, THUMBNAIL_LONGEST_SIDE);
  const thumbnail = await drawResized(bitmap, thumbDims.width, thumbDims.height, THUMBNAIL_QUALITY);

  bitmap.close();
  onProgress('done');

  return { bytes, thumbnail, width, height };
}

Comlink.expose({ processImage });
