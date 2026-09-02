// piexifjs ships no types. Only the small surface we use is declared here.
declare module 'piexifjs' {
  export const ImageIFD: { XResolution: number; YResolution: number; ResolutionUnit: number };
  export const ExifIFD: Record<string, number>;

  export function dump(exifObj: Record<string, Record<number, unknown>>): string;
  export function insert(exifBytes: string, jpegDataUrlOrBinaryString: string): string;

  export const GPSHelper: unknown;
}
