import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Album Conceptualizer",
  description: "Concept album dashboard for writing, planning, and release workflows.",
};

export const viewport: Viewport = {
  // Matches --bg so the browser chrome blends into the page.
  themeColor: "#0b0b10",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
