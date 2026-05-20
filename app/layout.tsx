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
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://vtracker.dev");

const SITE_TITLE = "vtracker | VTuber同接グラフ・視聴者数・スパチャ統計をリアルタイム追跡";
const SITE_DESCRIPTION =
  "VTuberの同時接続数グラフ・視聴者数ランキング・スパチャ（スーパーチャット）統計・配信履歴をリアルタイムで追跡。にじさんじ・ホロライブ・ぶいすぽっ！など人気VTuberのチャンネル登録者数・同接ピークを無料で確認できるVTuber統計サイト。Track VTuber live viewers, superchat stats, and subscriber rankings in real time.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | vtracker",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "VTuber", "VTuber統計", "VTuberグラフ", "VTuberランキング",
    "視聴者数", "同時接続数", "同接", "同接グラフ", "同接ランキング",
    "スパチャ", "スーパーチャット", "スパチャ統計", "スパチャランキング",
    "リアルタイム", "ライブ追跡", "配信", "配信統計",
    "チャンネル登録者数", "登録者数ランキング",
    "にじさんじ", "ホロライブ", "ぶいすぽっ！", "ぶいすぽ", "個人勢",
    "YouTube", "Twitch", "VTuber配信",
    "VTuber live viewers", "VTuber viewer count", "VTuber stats",
    "VTuber analytics", "VTuber tracker", "VTuber ranking",
    "VTuber superchat", "VTuber graph", "VTuber concurrent viewers",
    "Nijisanji", "Hololive", "VShojo", "Vspo",
    "live viewer tracker", "superchat ranking", "VTuber real time",
  ],
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "vtracker",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "https://vtracker.dev/tab-icon.png" }],
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["https://vtracker.dev/tab-icon.png"],
  },
  robots: { index: true, follow: true },
  verification: {
    google: "iNvU2SopDrUC7e9sApyPQZvO9L8I6jv-4mqZHxIz92w",
  },
  other: {
    "google-adsense-account": "ca-pub-6560735293239350",
  },
  manifest: "/site.webmanifest",
};

const fetchLayoutGroups = unstable_cache(
  async () => {
    const { data } = await supabase
      .from("groups")
      .select("id, name, color, icon_url, sort_order, parent_group_id")
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "vtracker",
            "url": SITE_URL,
            "description": SITE_DESCRIPTION,
            "applicationCategory": "EntertainmentApplication",
            "inLanguage": "ja",
            "keywords": "VTuber,同接グラフ,視聴者数,スパチャ統計,VTuber統計,にじさんじ,ホロライブ,ぶいすぽっ！",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "JPY" },
          }),
        }}
      />
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6560735293239350"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <body className="text-gray-900">
        <GroupsProvider groups={groups}>
          <SidebarProvider>
            <div className="fixed inset-x-0 top-0 z-30">
              <Header />
            </div>
            <div className="fixed inset-x-0 top-14 bottom-0 flex overflow-hidden">
              <DesktopSidebar />
              <main id="main-scroll" className="flex-1 min-w-0 overflow-y-auto px-4 pt-8 pb-24">
                {children}
              </main>
            </div>
            <Footer />
          </SidebarProvider>
        </GroupsProvider>
      </body>
    </html>
  );
}
