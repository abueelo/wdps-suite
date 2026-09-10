// Best-effort photographer/title guess from a filename in comp-sheets'
// own naming convention (NN_Author_Title.ext). Unlike comp-sheets there's
// no review/correction step here — if this can't confidently split the
// name, photographer/title are just left blank and the presenter sees
// the filename instead.
export function guessMetaFromFilename(filename: string): { photographer?: string; title?: string } {
  const withoutExt = filename.replace(/\.[^.]+$/, '');
  const match = /^\d+[_-]+([^_-]+(?:[_-][^_-]+)?)[_-]+(.+)$/.exec(withoutExt);
  if (!match) return {};
  const humanize = (s: string) => s.replace(/[_-]+/g, ' ').trim();
  return { photographer: humanize(match[1]), title: humanize(match[2]) };
}
