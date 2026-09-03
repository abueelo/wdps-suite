// Sets the footer's #year span to the current year. Each footer's markup
// carries "1970" as its static text (see terminal.css's .edit-link
// neighbour, or any app's footer) — that's the fallback. If this never
// runs (script blocked, throws before reaching here, whatever), 1970
// just stays put instead of the page breaking. Same trick as the source
// site this look is lifted from.
export function setFooterYear(): void {
  const el = document.getElementById('year');
  if (el) el.textContent = String(new Date().getFullYear());
}
