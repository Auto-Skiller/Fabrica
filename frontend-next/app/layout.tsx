import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fabrica — Watch your company get built.",
  description: "AI knows HOW to build. It just doesn't know WHAT. Drop in your spreadsheets, files, and processes — Fabrica learns how your business works and builds real systems to run it on.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

