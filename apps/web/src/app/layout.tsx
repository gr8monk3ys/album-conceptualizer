import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";

// Archivo, self-hosted from @fontsource-variable/archivo: the variable file carries both the
// weight axis and the width axis the display (expanded) and catalog (condensed) cuts use.
// Latin is preloaded; latin-ext is a separate face restricted by unicode-range, so browsers
// fetch it only for a page that actually uses one of its characters. (next/font needs its
// options written out literally, so the axis declaration is repeated in both calls.)
//
// The fallback is not next/font's: its generated face is Arial only (missing on Android and
// most Linux) and sized for the default instance, so the expanded display cut, a quarter
// wider, re-wrapped when Archivo swapped in. globals.css lists local faces sized per cut
// (font-fallbacks.css) after these, so swapping keeps every line where it was.

const archivo = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-archivo",
  adjustFontFallback: false,
  declarations: [
    { prop: "font-stretch", value: "62% 125%" },
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

const archivoExt = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/archivo/files/archivo-latin-ext-wdth-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-archivo-ext",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-stretch", value: "62% 125%" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

export const metadata: Metadata = {
  title: { default: "Album Conceptualizer", template: "%s · Album Conceptualizer" },
  description:
    "A workspace for concept albums: plan the narrative arc, write every track inside the sequence, check how the record holds together, and hand it off to your DAW.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${archivo.variable} ${archivoExt.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
