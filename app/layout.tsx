import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import Footer from "./components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "vtracker",
  description: "VTuber activity tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="flex h-screen flex-col overflow-hidden text-gray-900">
        <Header />
        <main id="main-scroll" className="flex-1 overflow-y-auto px-4 py-8">
          <div className="mx-auto max-w-6xl">
            {children}
          </div>
        </main>
        <Footer />
      </body>
    </html>
  );
}
