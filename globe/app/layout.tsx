import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Allswell × 穩發 · 空中魚探 Aerial Fish Spotting",
  description:
    "Fishing-master console for Allswell VTOL drone fish-school detections aboard Win Far (穩發) purse seiners.",
  applicationName: "Allswell × 穩發 空中魚探",
};

export const viewport: Viewport = {
  themeColor: "#04070d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant-TW" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden">{children}</body>
    </html>
  );
}
