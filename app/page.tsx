import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, Superchat, Group } from "@/lib/types";
import { getJstMidnightMs } from "@/lib/jst";
import HomeContent from "./components/HomeContent";

export const dynamic = "force-dynamic";

const fetchCachedChannelsGroupsVideos = unstable_cache(
  async () => {
    const [chRes, grRes, vRes] = await Promise.all([
      supabase.from("channels").select("*").order("subscriber_count", { ascending: false }),
      supabase.from("groups").select("*").order("sort_order", { ascending: true, nullsFirst: false }).order("name"),
      supabase.from("videos").select("*").order("start_time", { ascending: false }).limit(300),
    ]);
    return {
      channels: (chRes.data ?? []) as Channel[],
      groups: (grRes.data ?? []) as Group[],
      videos: (vRes.data ?? []) as Video[],
    };
  },
  ["home-static-data"],
  { revalidate: 60 },
);

export const metadata: Metadata = {
  title: "vtracker | VTuber同接グラフ・視聴者数・スパチャ統計をリアルタイム追跡",
  description:
    "VTuberの同時接続数グラフ・視聴者数ランキング・スパチャ統計・配信履歴をリアルタイムで追跡。にじさんじ・ホロライブ・ぶいすぽっ！など人気VTuberのチャンネル登録者数・同接ピークを無料で確認できるVTuber統計サイト。Track VTuber live viewers, superchat stats, and subscriber rankings in real time.",
  alternates: { canonical: "/" },
};

type SCRow = Pick<Superchat, "video_id" | "amount" | "amount_jpy" | "currency">;
type GraphPoint = { video_id: string; concurrent_viewers: number; recorded_at: string };

async function fetchData() {
  const jstMidnightMs = getJstMidnightMs();
  const since3hMs = Date.now() - 3 * 60 * 60 * 1000;
  // 今日の開始か3時間前の、いずれか早い方（深夜帯でも最低3時間分を確保）
  const effectiveFromMs = Math.min(jstMidnightMs, since3hMs);
  const todayIso = new Date(effectiveFromMs).toISOString();
  const since90mIso = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  try {
    const [{ channels, groups, videos }, scRes, gpRes, lpRes] = await Promise.all([
      fetchCachedChannelsGroupsVideos(),
      supabase.from("superchats").select("video_id, amount, amount_jpy, currency").gte("published_at", todayIso).limit(2000),
      supabase
        .from("live_graph_points")
        .select("video_id, concurrent_viewers, recorded_at")
        .gte("recorded_at", todayIso)
        .order("recorded_at", { ascending: true })
        .limit(100000),
      supabase
        .from("live_graph_points")
        .select("video_id, concurrent_viewers, recorded_at")
        .gte("recorded_at", since90mIso)
        .order("recorded_at", { ascending: true })
        .limit(30000),
    ]);

    return {
      channels,
      videos,
      groups,
      superchats: (scRes.data ?? []) as SCRow[],
      todayPoints: (gpRes.data ?? []) as GraphPoint[],
      livePoints: (lpRes.data ?? []) as GraphPoint[],
      error: scRes.error?.message ?? gpRes.error?.message ?? lpRes.error?.message ?? null,
    };
  } catch (e) {
    return { channels: [], videos: [], superchats: [], groups: [], todayPoints: [], livePoints: [], error: String(e) };
  }
}

function scTotalByVideo(superchats: SCRow[]): Record<string, number> {
  return superchats.reduce<Record<string, number>>((acc, sc) => {
    const jpy = sc.amount_jpy ?? (sc.currency === "JPY" ? sc.amount : 0);
    acc[sc.video_id] = (acc[sc.video_id] ?? 0) + jpy;
    return acc;
  }, {});
}

function scTotalByChannel(videos: Video[], scByVideo: Record<string, number>): Record<string, number> {
  return videos.reduce<Record<string, number>>((acc, v) => {
    acc[v.channel_id] = (acc[v.channel_id] ?? 0) + (scByVideo[v.video_id] ?? 0);
    return acc;
  }, {});
}

export default async function Home() {
  const { channels, videos, superchats, groups, todayPoints, livePoints, error } = await fetchData();
  const scByVideo = scTotalByVideo(superchats);
  const scByChannel = scTotalByChannel(videos, scByVideo);

  return (
    <HomeContent
      channels={channels}
      videos={videos}
      scByVideo={scByVideo}
      scByChannel={scByChannel}
      groups={groups}
      todayPoints={todayPoints}
      livePoints={livePoints}
      error={error}
    />
  );
}
