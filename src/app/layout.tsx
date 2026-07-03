import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mydsstudio",
  description: "Discover a design system by interview, not by form.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex h-full min-h-full flex-col">{children}</body>
    </html>
  );
}
