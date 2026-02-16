import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Content-Security-Policy
// ---------------------------------------------------------------------------
// Build a reasonably strict CSP that still allows the app to function:
//  - Google Fonts (loaded via next/font/google at build time, but the CSS /
//    font files are still fetched from Google domains at runtime)
//  - soundfont-player fetches instrument samples from gleitz.github.io (or a
//    custom base URL configured via NEXT_PUBLIC_SOUNDFONT_BASE_URL)
//  - blob: URLs are used for client-side file downloads (export zip, mp3, etc.)
//  - data: URIs are used for inline SVGs / small assets
//  - 'unsafe-inline' for styles is required by Next.js (style injection)
//  - 'unsafe-eval' is intentionally NOT allowed for scripts
// ---------------------------------------------------------------------------
const cspDirectives = [
  "default-src 'self'",
  // Scripts: self + Next.js inline scripts (nonce would be ideal but requires
  // custom server; 'unsafe-inline' is the pragmatic choice for App Router).
  "script-src 'self' 'unsafe-inline'",
  // Styles: self + Google Fonts CSS + Next.js style injection
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Fonts: self + Google Fonts files
  "font-src 'self' https://fonts.gstatic.com data:",
  // Images: self + data URIs + blob URLs + GitHub avatars (OAuth profile pics)
  "img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
  // Media: self + blob (mp3 / midi previews played from object URLs) + soundfont samples
  "media-src 'self' blob: https://gleitz.github.io",
  // Connect: self (API routes) + soundfont sample fetches
  "connect-src 'self' https://gleitz.github.io",
  // Workers: self + blob (Web Audio worklets / offline rendering)
  "worker-src 'self' blob:",
  // Child / frame: none (we don't embed iframes)
  "frame-src 'none'",
  // Object: none
  "object-src 'none'",
  // Base URI: self (prevent <base> tag hijacking)
  "base-uri 'self'",
  // Form action: self (forms should only post to our own origin)
  "form-action 'self'",
  // Frame ancestors: none (equivalent to X-Frame-Options DENY)
  "frame-ancestors 'none'",
];

const ContentSecurityPolicy = cspDirectives.join("; ");

// ---------------------------------------------------------------------------
// Security headers applied to every route
// ---------------------------------------------------------------------------
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // X-XSS-Protection: "0" disables the legacy XSS auditor; CSP is the proper
  // mitigation and the auditor can introduce vulnerabilities in some browsers.
  { key: "X-XSS-Protection", value: "0" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
];

const nextConfig: NextConfig = {
  turbopack: {
    // Avoid picking up lockfiles outside this app when the repo is used as a workspace.
    root: currentDir,
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
