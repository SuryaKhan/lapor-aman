import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import LaporBot from "../components/LaporBot";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import type { Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#030712",
};

export const metadata: Metadata = {
  title: "LaporAman | Sistem Pelaporan AI",
  description: "Platform cerdas pelaporan jalan dan fasilitas publik bermasalah menggunakan analisis AI.",
  manifest: "/manifest.json",
  openGraph: {
    title: "LaporAman Command Center",
    description: "Laporkan jalan rusak dan infrastruktur kota dengan analisis AI cerdas secara real-time.",
    url: "https://laporaman.com",
    siteName: "LaporAman",
    images: [
      {
        url: "/icon.png",
        width: 512,
        height: 512,
        alt: "Logo LaporAman",
      },
    ],
    locale: "id_ID",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LaporAman | Pelaporan Infrastruktur AI",
    description: "Platform cerdas pelaporan jalan dan fasilitas publik bermasalah menggunakan analisis AI.",
    images: ["/icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <LaporBot />
      </body>
    </html>
  );
}
