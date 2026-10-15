// Default title for a new draft: the original filename without its last extension,
// or the full filename when stripping leaves nothing (".mp4"). The AddVideoTitle
// migration backfills existing rows with the same rule in SQL.
export function titleFromFilename(filename: string): string {
  const stripped = filename.replace(/\.[^.]*$/, '');
  return stripped === '' ? filename : stripped;
}
