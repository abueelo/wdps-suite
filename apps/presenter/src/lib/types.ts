export interface PresenterImage {
  id: string;
  blob: Blob;
  filename: string;
  photographer?: string;
  title?: string;
  /** 1–20, or null until rated. */
  rating: number | null;
  held: boolean;
  order: number;
}

export interface SlideConfig {
  enabled: boolean;
  image?: Blob;
  /** Title slide only — ignored for the break slide. */
  heading?: string;
}

export type Scene = 'title' | 'break' | 'photo';

export interface LiveSession {
  images: PresenterImage[];
  scene: Scene;
  currentImageId: string | null;
  /** Independent toggles — title and photographer can be revealed separately. */
  revealTitle: boolean;
  revealPhotographer: boolean;
  /** When on, a revealed caption only shows for a few seconds after switching images, instead of staying up. */
  revealFlashOnly: boolean;
  borderGuide: boolean;
  titleSlide: SlideConfig;
  breakSlide: SlideConfig;
}

export function emptySession(): LiveSession {
  return {
    images: [],
    scene: 'title',
    currentImageId: null,
    revealTitle: false,
    revealPhotographer: false,
    revealFlashOnly: false,
    borderGuide: false,
    titleSlide: { enabled: true, heading: 'wdps' },
    breakSlide: { enabled: false }
  };
}
