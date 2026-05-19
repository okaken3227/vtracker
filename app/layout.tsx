import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Header from "./components/Header";
import Footer from "./components/Footer";
import DesktopSidebar from "./components/DesktopSidebar";
import SidebarProvider from "./components/SidebarProvider";
import { GroupsProvider } from "./components/GroupsProvider";
import { supabase } from "@/lib/supabase/client";
import { unstable_cache } from "next/cache";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "vtracker | VTuberリアルタイム視聴者数・スパチャ追跡",
    template: "%s | vtracker",
  },
  description:
    "VTuberのリアルタイム視聴者数・スパチャ（スーパーチャット）・配信履歴を追跡するサービスです。にじさんじ・ホロライブなど人気事務所の全チャンネルを一覧でチェック。",
  keywords: ["VTuber", "視聴者数", "スパチャ", "スーパーチャット", "ライブ追跡", "配信", "にじさんじ", "ホロライブ", "YouTube", "Twitch"],
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "vtracker",
    title: "vtracker | VTuberリアルタイム視聴者数・スパチャ追跡",
    description:
      "VTuberのリアルタイム視聴者数・スパチャ・配信履歴を追跡するサービスです。",
  },
  twitter: {
    card: "summary_large_image",
    title: "vtracker | VTuberリアルタイム視聴者数・スパチャ追跡",
    description:
      "VTuberのリアルタイム視聴者数・スパチャ・配信履歴を追跡するサービスです。",
  },
  robots: { index: true, follow: true },
  other: {
    "google-adsense-account": "ca-pub-6560735293239350",
  },
  manifest: "/site.webmanifest",
};

const fetchLayoutGroups = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("groups")
      .select("id, name, color, icon_url, sort_order")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name");
    return data ?? [];
  },
  ["layout-groups"],
  { revalidate: 60 },
);

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#faf8ff",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const groups = await fetchLayoutGroups();

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
        <GroupsProvider groups={groups}>
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
