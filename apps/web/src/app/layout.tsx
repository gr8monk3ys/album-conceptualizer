import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
