// Folder/file picker + drag-drop collection, same approach as
// comp-sheets' own intake (webkitdirectory, DataTransferItem tree
// walking, magic-byte sniff) — a folder loaded straight into presenter
// might be raw originals rather than comp-sheets' always-JPEG export.

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

export async function collectFromDataTransferItems(items: DataTransferItemList): Promise<File[]> {
  const entries: FileSystemEntry[] = [];
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.();
    if (entry) entries.push(entry);
  }
  const files: File[] = [];
  await Promise.all(entries.map((entry) => walkEntry(entry, files)));
  return files;
}

function walkEntry(entry: FileSystemEntry, out: File[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (entry.isFile) {
      (entry as FileSystemFileEntry).file(
        (file) => {
          out.push(file);
          resolve();
        },
        reject
      );
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const readAll = () => {
        reader.readEntries(async (batch) => {
          if (batch.length === 0) {
            resolve();
            return;
          }
          await Promise.all(batch.map((child) => walkEntry(child, out)));
          readAll();
        }, reject);
      };
      readAll();
    } else {
      resolve();
    }
  });
}

export async function filterAcceptedFiles(files: File[]): Promise<File[]> {
  const checks = await Promise.all(files.map(async (f) => ((await isAcceptedImage(f)) ? f : null)));
  return checks.filter((f): f is File => f !== null);
}
