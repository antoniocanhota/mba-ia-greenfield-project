const FALLBACK_BASENAME = 'video';

// "My Trip.mov" -> "My Trip"; names without a usable base fall back to "video".
export function downloadBasename(originalFilename: string): string {
  const dot = originalFilename.lastIndexOf('.');
  const base = dot > 0 ? originalFilename.slice(0, dot) : originalFilename;
  const trimmed = base.trim();
  return trimmed === '' ? FALLBACK_BASENAME : trimmed;
}

// Content-Disposition for the normalized MP4 download: ASCII `filename` for old clients
// plus RFC 5987 `filename*` so accents and symbols survive. Characters that could break
// out of the quoted string are neutralized.
export function downloadDisposition(originalFilename: string): string {
  const name = `${downloadBasename(originalFilename)}.mp4`;
  const ascii = name.replace(/[^\x20-\x7E]|["\\%]/g, '_');
  const encoded = encodeURIComponent(name).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
