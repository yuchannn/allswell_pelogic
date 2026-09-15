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
  title: "Allswell × 穩發 · 空中魚探 無人機畫面 Drone Feeds",
  description:
    "Fishing-master feed wall: latest Allswell VTOL drone captures and fish-school alerts aboard Win Far (穩發) purse seiners.",
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
