// Same accepted-format validation as comp-sheets
// (apps/comp-sheets/src/lib/upload/collectFiles.ts) — tiff, png, jpeg,
// checked by magic bytes rather than trusting the extension.

const ACCEPTED_EXTENSIONS = /\.(tiff?|png|jpe?g)$/i;

function sniffFormat(bytes: Uint8Array): 'tiff' | 'png' | 'jpeg' | 'unknown' {
  if (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) return 'tiff';
  if (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a) return 'tiff';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  return 'unknown';
}

export async function isAcceptedImage(file: File): Promise<boolean> {
  if (!ACCEPTED_EXTENSIONS.test(file.name)) return false;
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return sniffFormat(head) !== 'unknown';
}

export async function filterAcceptedFiles(files: File[]): Promise<File[]> {
  const checks = await Promise.all(files.map(async (f) => ((await isAcceptedImage(f)) ? f : null)));
  return checks.filter((f): f is File => f !== null);
}
