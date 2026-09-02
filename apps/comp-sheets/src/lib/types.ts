export type Confidence = 'high' | 'medium' | 'low';

export interface ImageRecord {
  id: string;
  originalFile: File;
  originalName: string;
  /** Photographer name as currently confirmed/edited. Empty until set. */
  photographer: string;
  /** Image title, entered/edited by the user — not reliably derivable from filename. */
  title: string;
  confidence: Confidence;
  /** Set once the user has confirmed/edited this row in the Review step. */
  confirmed: boolean;
  /** Order among this photographer's images, as set in Review/priority list. Lower = higher priority. */
  priority: number;
}

export interface ProcessedImage {
  imageId: string;
  /** Final export bytes: 1920px longest side, JPEG, 72 DPI patched in. */
  bytes: Uint8Array<ArrayBuffer>;
  /** Small embeddable thumbnail (for optional docx column). */
  thumbnail: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
}

export interface Settings {
  limit: number;
  randomizeOrder: boolean;
  includeThumbnails: boolean;
}

export interface CapResult {
  caps: Record<string, number>; // photographer name -> included count
  tier: number;
  totalSelected: number;
  fullySatisfied: boolean;
}

export interface CapError {
  error: true;
  photographerCount: number;
  limit: number;
}

export interface OrderedEntry {
  entryNumber: number;
  image: ImageRecord;
  scorerFilename: string; // NN_Photographer_Title.jpg
  judgeFilename: string; // NN_Title.jpg — no photographer name
}

export type ProcessingStage = 'decode' | 'resize' | 'encode' | 'dpi' | 'thumbnail' | 'done';

export interface ProgressEvent {
  imageId: string;
  stage: ProcessingStage;
  error?: string;
}
