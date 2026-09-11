import * as UTIF from 'utif2';

export interface DecodedImage {
  width: number;
  height: number;
  /** RGBA8, row-major, ready to drop into an ImageData. */
  rgba: Uint8ClampedArray<ArrayBuffer>;
}

/** Decodes a TIFF ArrayBuffer to raw RGBA8 pixels, using the first image in the file. */
export function decodeTiff(buffer: ArrayBuffer): DecodedImage {
  const ifds = UTIF.decode(buffer);
  if (!ifds.length) throw new Error('no images found in TIFF');

  const first = ifds[0];
  UTIF.decodeImage(buffer, first);
  const rgba = UTIF.toRGBA8(first);

  return {
    width: first.width,
    height: first.height,
    rgba: Uint8ClampedArray.from(rgba)
  };
}
