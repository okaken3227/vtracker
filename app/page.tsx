import type { Metadata } from "next";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, Superchat, Group } from "@/lib/types";
import { getJstMidnightMs } from "@/lib/jst";
import HomeContent from "./components/HomeContent";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "vtracker | VTuberリアルタイム視聴者数・スパチャ追跡",
  description:
    "VTuberのリアルタイム視聴者数・スパチャ（スーパーチャット）・配信履歴を追跡するサービスです。にじさんじ・ホロライブなど人気事務所の全チャンネルを一覧でチェック。",
  alternates: { canonical: "/" },
};

type SCRow = Pick<Superchat, "video_id" | "amount" | "amount_jpy" | "currency">;
type GraphPoint = { video_id: string; concurrent_viewers: number; recorded_at: string };

async function fetchData() {
  const jstMidnightMs = getJstMidnightMs();
  const since3h = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  try {
    const [chRes, vRes, scRes, grRes, gpRes] = await Promise.all([
      supabase.from("channels").select("*").order("subscriber_count", { ascending: false }),
      supabase.from("videos").select("*").order("start_time", { ascending: false }).limit(500),
      supabase.from("superchats").select("video_id, amount, amount_jpy, currency").limit(5000),
      supabase.from("groups").select("*").order("name"),
      supabase
        .from("live_graph_points")
        .select("video_id, concurrent_viewers, recorded_at")
        .gte("recorded_at", new Date(jstMidnightMs).toISOString())
        .order("recorded_at", { ascending: true }),
    ]);

    // ライブ中の動画IDを取得し、24時間窓でグラフポイントを別途取得
    const liveVideoIds = ((vRes.data ?? []) as Video[])
      .filter((v) => v.status === "live")
      .map((v) => v.video_id);

    let livePoints: GraphPoint[] = [];
    if (liveVideoIds.length > 0) {
      const { data: lpData } = await supabase
        .from("live_graph_points")
        .select("video_id, concurrent_viewers, recorded_at")
        .in("video_id", liveVideoIds)
        .gte("recorded_at", since3h)
        .order("recorded_at", { ascending: true });
      livePoints = (lpData ?? []) as GraphPoint[];
    }

    return {
      channels: (chRes.data ?? []) as Channel[],
      videos: (vRes.data ?? []) as Video[],
      superchats: (scRes.data ?? []) as SCRow[],
      groups: (grRes.data ?? []) as Group[],
      todayPoints: (gpRes.data ?? []) as GraphPoint[],
      livePoints,
      error:
        chRes.error?.message ?? vRes.error?.message ??
        scRes.error?.message ?? grRes.error?.message ?? gpRes.error?.message ?? null,
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
