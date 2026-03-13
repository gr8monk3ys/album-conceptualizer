/**
 * Build an RFC 6266 Content-Disposition header value.
 *
 * Provides both an ASCII `filename` fallback and a UTF-8 `filename*`
 * parameter so non-ASCII album titles download with the correct name
 * in modern browsers while remaining safe for older clients.
 */
export function contentDisposition(filename: string): string {
  // ASCII-safe fallback: strip anything outside printable ASCII (except quotes/semicolons).
  const ascii = filename.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\;]/g, "_");

  // RFC 5987 percent-encoding for UTF-8 filename*.
  const encoded = encodeURIComponent(filename).replace(/'/g, "%27");

  // If the filename is pure ASCII, a simple header suffices.
  if (ascii === filename) {
    return `attachment; filename="${ascii}"`;
  }
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
