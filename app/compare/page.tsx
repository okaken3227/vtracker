import type { Metadata } from "next";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Group } from "@/lib/types";
import CompareClient from "./CompareClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "チャンネル比較",
  description: "複数のVTuberチャンネルを比較。同接推移・スパチャ・登録者数を並べてグラフで確認できます。",
};

export default async function ComparePage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [chRes, grRes, liveRes, scRes] = await Promise.all([
    supabase.from("channels").select("*").order("subscriber_count", { ascending: false }),
    supabase
      .from("groups")
      .select("*")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name"),
    supabase.from("videos").select("channel_id").eq("status", "live"),
    supabase
      .from("superchats")
      .select("video_id, amount_jpy")
      .gte("published_at", thirtyDaysAgo)
      .not("amount_jpy", "is", null)
      .limit(200000),
  ]);

  const channels = (chRes.data ?? []) as Channel[];
  const groups = (grRes.data ?? []) as Group[];
  const liveChannelIds = [...new Set(
    ((liveRes.data ?? []) as { channel_id: string }[]).map((v) => v.channel_id)
  )];

  // SC上位チャンネルを計算
  const scByVideo = new Map<string, number>();
  for (const sc of (scRes.data ?? []) as { video_id: string; amount_jpy: number }[]) {
    scByVideo.set(sc.video_id, (scByVideo.get(sc.video_id) ?? 0) + sc.amount_jpy);
  }

  let defaultScChannelIds: string[] = [];
  if (scByVideo.size > 0) {
    const scVideoIds = Array.from(scByVideo.keys());
    const { data: scVideos } = await supabase
      .from("videos")
      .select("video_id, channel_id")
      .in("video_id", scVideoIds);

    const scByChannel = new Map<string, number>();
    for (const v of (scVideos ?? []) as { video_id: string; channel_id: string }[]) {
      const amt = scByVideo.get(v.video_id) ?? 0;
      scByChannel.set(v.channel_id, (scByChannel.get(v.channel_id) ?? 0) + amt);
    }
    defaultScChannelIds = [...scByChannel.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
  }

  return (
    <div>
      <CompareClient
        channels={channels}
        groups={groups}
        liveChannelIds={liveChannelIds}
        defaultScChannelIds={defaultScChannelIds}
      />
    </div>
  );
}
