import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AnnouncementMarquee from "./components/announcement-marquee";
import { I18nProvider } from "@/components/i18n-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "中港車預約平台",
  description: "香港到汕尾跨境包車/拼車預約平台",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-HK"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* i18n provider 包整個 app，提供 t() + locale context */}
        <I18nProvider>
          {/* 乘客端頂部跑馬燈（不影響 driver-app） */}
          <AnnouncementMarquee />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
