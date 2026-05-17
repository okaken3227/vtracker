import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import DesktopSidebar from "./components/DesktopSidebar";
import SidebarProvider from "./components/SidebarProvider";
import { GroupsProvider } from "./components/GroupsProvider";
import { supabase } from "@/lib/supabase/client";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, color, icon_url")
    .order("name");

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6560735293239350"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <body className="text-gray-900">
        <GroupsProvider groups={groups ?? []}>
          <SidebarProvider>
            <div className="sticky top-0 z-30 shrink-0">
              <Header />
            </div>
            <div className="flex">
              <DesktopSidebar />
              <main id="main-scroll" className="flex-1 min-w-0 px-4 py-8">
                {children}
              </main>
            </div>
          </SidebarProvider>
        </GroupsProvider>
        <Footer />
      </body>
    </html>
  );
}
