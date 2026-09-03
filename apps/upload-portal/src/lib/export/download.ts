// Saves a streamed sequence of chunks as a file download. Prefers the
// File System Access API (streams straight to disk, so the browser never
// needs to hold the whole archive in memory) where available; falls back
// to accumulating a Blob and a synthetic <a download> click for browsers
// without it (notably Safari). Same approach as comp-sheets'
// apps/comp-sheets/src/lib/export/download.ts.

interface SaveFilePickerOptions {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}

interface FileSystemWritableStream {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableStream>;
}

declare global {
  interface Window {
    showSaveFilePicker?: (options: SaveFilePickerOptions) => Promise<FileSystemFileHandleLike>;
  }
}

export async function saveStreamedFile(
  suggestedName: string,
  mimeType: string,
  produce: (onChunk: (chunk: Uint8Array) => void) => Promise<void>
): Promise<'saved' | 'cancelled'> {
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'Archive', accept: { [mimeType]: [`.${suggestedName.split('.').pop()}`] } }]
      });
      const writable = await handle.createWritable();
      await produce((chunk) => {
        void writable.write(chunk);
      });
      await writable.close();
      return 'saved';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }

  const chunks: Uint8Array[] = [];
  await produce((chunk) => chunks.push(chunk));
  const blob = new Blob(chunks as BlobPart[], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'saved';
}
