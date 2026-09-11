// Saves a Blob as a file download. Prefers the File System Access API
// (a proper save dialog) where available, falling back to a synthetic
// <a download> click for browsers without it (notably Safari) — same
// approach as comp-sheets' own download.ts, just for a ready Blob rather
// than a streamed sequence of chunks.

interface SaveFilePickerOptions {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}

interface FileSystemWritableStream {
  write(data: Blob): Promise<void>;
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

export async function saveBlob(suggestedName: string, blob: Blob): Promise<'saved' | 'cancelled'> {
  if (window.showSaveFilePicker) {
    try {
      const ext = suggestedName.split('.').pop() ?? '';
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'File', accept: { [blob.type || 'application/octet-stream']: [`.${ext}`] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Fall through to the <a download> fallback below.
    }
  }

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
