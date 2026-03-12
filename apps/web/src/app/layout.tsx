import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Album Conceptualizer",
  description: "Concept album dashboard for writing, planning, and release workflows.",
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
