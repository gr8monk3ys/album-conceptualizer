// Where to go after signing in, read from `?callbackUrl=` on the sign-in page.
//
// The value arrives in two shapes: a path ("/app/library", from the sign-in redirect and our own
// links) and, after a failed attempt, the absolute URL NextAuth rewrites it to
// ("http://127.0.0.1:3002/app/library"). Both keep the destination, but only on this site: an
// absolute URL is accepted only when its origin is one of `allowedOrigins` (the page's own and the
// one the auth server knows), and the result is always a same-site path, so a protocol-relative
// "//elsewhere", a "javascript:" URL, backslash or whitespace tricks and other origins all fall
// back to the app.

export const DEFAULT_CALLBACK_PATH = "/app";

// Any origin will do as a base for reading a relative value: what matters is that it stays put.
const PROBE_ORIGIN = "https://callback.invalid";

function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function safeCallbackPath(
  raw: string | null | undefined,
  allowedOrigins: ReadonlyArray<string | null | undefined> = [],
): string {
  if (!raw) return DEFAULT_CALLBACK_PATH;
  // Browsers read "\" as "/" and drop tabs and newlines, which turns "/\evil.example" into
  // "//evil.example"; nothing we link to needs any of them.
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_CALLBACK_PATH;

  let url: URL;
  if (raw.startsWith("/")) {
    if (raw.startsWith("//")) return DEFAULT_CALLBACK_PATH;
    try {
      url = new URL(raw, PROBE_ORIGIN);
    } catch {
      return DEFAULT_CALLBACK_PATH;
    }
    if (url.origin !== PROBE_ORIGIN) return DEFAULT_CALLBACK_PATH;
  } else {
    try {
      url = new URL(raw);
    } catch {
      return DEFAULT_CALLBACK_PATH;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_CALLBACK_PATH;
    if (url.username || url.password) return DEFAULT_CALLBACK_PATH;
    const allowed = new Set(allowedOrigins.map(originOf).filter((o): o is string => Boolean(o)));
    if (!allowed.has(url.origin)) return DEFAULT_CALLBACK_PATH;
  }

  const path = `${url.pathname}${url.search}${url.hash}`;
  // "https://this.site//elsewhere" has the path "//elsewhere", which reads as another host once it
  // is used on its own.
  if (!path.startsWith("/") || path.startsWith("//")) return DEFAULT_CALLBACK_PATH;
  // Coming back to the sign-in page after signing in would look like the sign-in failed.
  if (url.pathname === "/sign-in" || url.pathname.startsWith("/sign-in/")) {
    return DEFAULT_CALLBACK_PATH;
  }
  return path;
}
