// Opens display.html on a second screen. Tries the Window Management API
// (getScreenDetails) first — auto-places and fullscreens a window on a
// chosen screen — and falls back to a plain popup the presenter drags to
// the projector and fullscreens themselves (F11) when that API isn't
// available, its permission is refused, or anything else about the auto
// path goes wrong. The fallback always works, so the auto path can only
// improve on it, never block it.
//
// getScreenDetails() is still an experimental API with no stable TS
// lib.dom types, hence the `any` here rather than hand-rolled ambient
// declarations for a shape that's still changing.

export type SecondScreenMode = 'auto' | 'manual';

export interface ScreenChoice {
  screen: any;
  label: string;
}

// Always pass a features string with explicit dimensions — without one,
// Chrome/Firefox open the URL as a new tab in this window rather than a
// separate OS window, which defeats the point (nothing to drag onto the
// projector). Manual mode doesn't know the target screen's size, so it
// just gets a reasonable fixed window instead of a real screen's bounds.
const MANUAL_FEATURES = 'width=1024,height=768,left=80,top=80';

function getScreenDetailsApi(): (() => Promise<any>) | undefined {
  return (window as unknown as { getScreenDetails?: () => Promise<any> }).getScreenDetails;
}

/**
 * Lists every screen other than the one this window is currently on.
 * Must be called from a user gesture (a click handler) — the browser's
 * one-time "see your screens?" permission prompt needs that, same as
 * the rest of the Window Management API. Returns [] if the API isn't
 * available or the permission is refused, so callers can fall back to
 * just opening a plain popup without asking anything first.
 */
export async function detectExternalScreens(): Promise<ScreenChoice[]> {
  const getScreenDetails = getScreenDetailsApi();
  if (!getScreenDetails) return [];
  try {
    const details = await getScreenDetails();
    return details.screens
      .filter((s: any) => s !== details.currentScreen)
      .map((s: any) => ({
        screen: s,
        label: `${s.width}×${s.height}${s.isPrimary ? ' — primary' : ''} at (${s.left}, ${s.top})`
      }));
  } catch {
    return [];
  }
}

/** Opens display.html, placed on `screen` if given (from detectExternalScreens), otherwise a plain popup. */
export async function openDisplayWindow(url: string, screen?: any): Promise<{ mode: SecondScreenMode; window: Window }> {
  // Fullscreen is requested by display.html itself, on its own load, not
  // from here — this synchronous point is still the popup's pre-
  // navigation placeholder document, not the real page. Cross-document
  // navigation exits fullscreen automatically (a browser security
  // measure), so fullscreening the placeholder just gets undone the
  // instant it navigates to `url`. Requesting it from inside the actual
  // loaded page is what survives.
  if (screen) {
    try {
      const features = `left=${screen.availLeft},top=${screen.availTop},width=${screen.availWidth},height=${screen.availHeight}`;
      const opened = window.open(url, 'wdps-presenter-display', features);
      if (!opened) throw new Error('popup blocked');
      opened.moveTo(screen.availLeft, screen.availTop);
      opened.resizeTo(screen.availWidth, screen.availHeight);
      return { mode: 'auto', window: opened };
    } catch {
      // fall through to the manual popup below
    }
  }

  const opened = window.open(url, 'wdps-presenter-display', MANUAL_FEATURES);
  if (!opened) throw new Error('popup blocked — allow popups for this site to open the display window');
  return { mode: 'manual', window: opened };
}
