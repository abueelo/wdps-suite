// Opens display.html on a second screen. Tries the Window Management API
// (getScreenDetails) first — auto-places and fullscreens a window on
// whichever screen isn't the current one — and falls back to a plain
// popup the presenter drags to the projector and fullscreens themselves
// (F11) when that API isn't available, its permission is refused, or
// anything else about the auto path goes wrong. The fallback always
// works, so the auto path can only improve on it, never block it.
//
// getScreenDetails() is still an experimental API with no stable TS
// lib.dom types, hence the `any` here rather than hand-rolled ambient
// declarations for a shape that's still changing.

export type SecondScreenMode = 'auto' | 'manual';

export async function openDisplayWindow(url: string): Promise<{ mode: SecondScreenMode; window: Window }> {
  const win = window as unknown as { getScreenDetails?: () => Promise<any> };

  if (typeof win.getScreenDetails === 'function') {
    try {
      const screenDetails = await win.getScreenDetails();
      const target = screenDetails.screens.find((s: any) => s !== screenDetails.currentScreen) ?? screenDetails.currentScreen;
      const features = `left=${target.availLeft},top=${target.availTop},width=${target.availWidth},height=${target.availHeight}`;
      const opened = window.open(url, 'wdps-presenter-display', features);
      if (!opened) throw new Error('popup blocked');
      opened.addEventListener('load', () => {
        opened.moveTo(target.availLeft, target.availTop);
        opened.resizeTo(target.availWidth, target.availHeight);
        opened.document.documentElement.requestFullscreen?.().catch(() => {});
      });
      return { mode: 'auto', window: opened };
    } catch {
      // fall through to the manual popup below
    }
  }

  const opened = window.open(url, 'wdps-presenter-display');
  if (!opened) throw new Error('popup blocked — allow popups for this site to open the display window');
  return { mode: 'manual', window: opened };
}
