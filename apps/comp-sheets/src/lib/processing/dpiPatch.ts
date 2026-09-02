// Sets a JPEG's DPI metadata to a fixed value.
//
// canvas.toBlob()/OffscreenCanvas.convertToBlob() give no way to set DPI
// directly, and different tools read DPI from different places, so this
// writes it in two places:
//
//  1. The JFIF APP0 density header — browsers' built-in JPEG encoders
//     emit this as the first marker after SOI per spec, but with
//     units=0 (no real density). We overwrite it in place (same byte
//     length, no re-encoding) if present, or insert a fresh one if not.
//  2. EXIF XResolution/YResolution via piexifjs, for tools that check
//     EXIF resolution specifically instead of/as well as JFIF. This step
//     is best-effort — piexifjs has had limited recent maintenance, so
//     failures here are swallowed and the JFIF patch (the more load-
//     bearing of the two, since it's a spec-guaranteed segment) still
//     stands on its own.

const SOI = 0xffd8;
const APP0_MARKER = 0xffe0;

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function writeUint16BE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

function isJfifApp0(bytes: Uint8Array, offset: number): boolean {
  if (readUint16BE(bytes, offset) !== APP0_MARKER) return false;
  // "JFIF\0" starts 4 bytes into the segment (after marker + length).
  const magic = [0x4a, 0x46, 0x49, 0x46, 0x00];
  for (let i = 0; i < magic.length; i++) {
    if (bytes[offset + 4 + i] !== magic[i]) return false;
  }
  return true;
}

function buildApp0Segment(dpi: number): Uint8Array {
  const seg = new Uint8Array(18);
  writeUint16BE(seg, 0, APP0_MARKER);
  writeUint16BE(seg, 2, 16); // length field, excludes the marker itself
  seg.set([0x4a, 0x46, 0x49, 0x46, 0x00], 4); // "JFIF\0"
  seg[9] = 1; // version major
  seg[10] = 1; // version minor
  seg[11] = 1; // units: 1 = dots per inch
  writeUint16BE(seg, 12, dpi); // Xdensity
  writeUint16BE(seg, 14, dpi); // Ydensity
  seg[16] = 0; // Xthumbnail
  seg[17] = 0; // Ythumbnail
  return seg;
}

/** Patches (or inserts) the JFIF APP0 density header so the image reports `dpi` DPI. */
export function setJfifDpi(bytes: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  if (readUint16BE(bytes, 0) !== SOI) {
    throw new Error('not a JPEG (missing SOI marker)');
  }

  if (isJfifApp0(bytes, 2)) {
    const patched = bytes.slice();
    patched[2 + 11] = 1; // units = dots per inch
    writeUint16BE(patched, 2 + 12, dpi);
    writeUint16BE(patched, 2 + 14, dpi);
    return patched;
  }

  // No existing APP0 — insert a fresh one right after SOI.
  const app0 = buildApp0Segment(dpi);
  const result = new Uint8Array(bytes.length + app0.length);
  result.set(bytes.slice(0, 2), 0); // SOI
  result.set(app0, 2);
  result.set(bytes.slice(2), 2 + app0.length);
  return result;
}

function uint8ToBinaryString(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return binary;
}

function binaryStringToUint8(binary: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i) & 0xff;
  return bytes;
}

/** Best-effort EXIF XResolution/YResolution write via piexifjs. Never throws. */
async function setExifDpi(bytes: Uint8Array<ArrayBuffer>, dpi: number): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const piexif = await import('piexifjs');
    const binary = uint8ToBinaryString(bytes);
    const exifObj = {
      '0th': {
        [piexif.ImageIFD.XResolution]: [dpi, 1],
        [piexif.ImageIFD.YResolution]: [dpi, 1],
        [piexif.ImageIFD.ResolutionUnit]: 2 // inches
      }
    };
    const exifBytes = piexif.dump(exifObj);
    const withExif = piexif.insert(exifBytes, binary);
    return binaryStringToUint8(withExif);
  } catch {
    // piexifjs failed (unexpected byte layout, etc.) — return the input
    // unchanged; the JFIF patch applied afterwards is sufficient on its
    // own either way.
    return bytes;
  }
}

/**
 * Applies both the EXIF and JFIF DPI writes — EXIF first, JFIF last.
 *
 * piexifjs's insert() rebuilds the JPEG header and does not preserve an
 * existing JFIF APP0 segment (verified empirically: it left the file
 * with only an EXIF APP1 segment after SOI, no APP0 at all). Running the
 * JFIF patch second fixes this regardless of piexifjs's internals — it's
 * self-sufficient (patches an existing APP0 or inserts a fresh one), so
 * whichever order piexifjs leaves things in, the JFIF density header is
 * guaranteed correct as the final step. This also happens to match the
 * conventional segment order (APP0/JFIF before APP1/EXIF).
 */
export async function setJpegDpi(bytes: Uint8Array, dpi: number): Promise<Uint8Array<ArrayBuffer>> {
  const withExif = await setExifDpi(bytes as Uint8Array<ArrayBuffer>, dpi);
  return setJfifDpi(withExif, dpi);
}
