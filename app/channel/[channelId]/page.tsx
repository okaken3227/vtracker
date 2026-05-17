import type { Metadata } from "next";
import { supabase } from "@/lib/supabase/client";
import type { Channel, Video, ChannelStatsHistory, Group, Superchat } from "@/lib/types";
import { fetchRatesToJPY } from "@/lib/exchange";
import BackButton from "./BackButton";
import ChannelPageContent, { type ChData } from "./ChannelPageContent";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ channelId: string }>;
}): Promise<Metadata> {
  const { channelId } = await params;
  const { data } = await supabase
    .from("channels")
    .select("name, description, icon_url, subscriber_count")
    .eq("channel_id", channelId)
    .single();
  if (!data) return {};
  const ch = data as { name: string; description: string | null; icon_url: string | null; subscriber_count: number | null };
  const sub = ch.subscriber_count ? `登録者${ch.subscriber_count >= 10000 ? `${(ch.subscriber_count / 10000).toFixed(0)}万` : ch.subscriber_count.toLocaleString()}人` : null;
  const description = `${ch.name}の視聴者数・スパチャ・配信履歴を追跡します。${sub ? `${sub}。` : ""}`;
  const images = ch.icon_url ? [{ url: ch.icon_url }] : [];
  return {
    title: ch.name,
    description,
    openGraph: { title: `${ch.name} | vtracker`, description, images },
    twitter: { card: "summary", title: `${ch.name} | vtracker`, description, images },
  };
}

async function fetchChannelData(channelId: string): Promise<ChData | null> {
  const [channelRes, videosRes, historyRes, allVideoIdsRes] = await Promise.all([
    supabase.from("channels").select("*").eq("channel_id", channelId).single(),
    supabase
      .from("videos")
      .select("*")
      .eq("channel_id", channelId)
      .order("start_time", { ascending: false })
      .limit(30),
    supabase
      .from("channel_stats_history")
      .select("id, channel_id, subscriber_count, view_count, recorded_at")
      .eq("channel_id", channelId)
      .order("recorded_at", { ascending: true })
      .limit(200),
    supabase.from("videos").select("video_id").eq("channel_id", channelId),
  ]);

  const channel = channelRes.data as Channel | null;
  if (!channel) return null;

  const videos = (videosRes.data ?? []) as Video[];
  const history = (historyRes.data ?? []) as ChannelStatsHistory[];
  const allVideoIds = ((allVideoIdsRes.data ?? []) as { video_id: string }[]).map((v) => v.video_id);
  const videoIds = videos.map((v) => v.video_id);

  const [groupRes, scRes, peakRes] = await Promise.all([
    channel.group_id
      ? supabase.from("groups").select("*").eq("id", channel.group_id).single()
      : Promise.resolve({ data: null }),
    allVideoIds.length > 0
      ? supabase.from("superchats").select("amount_jpy, amount, currency").in("video_id", allVideoIds)
      : Promise.resolve({ data: [] }),
    videoIds.length > 0
      ? supabase.from("live_graph_points").select("video_id, concurrent_viewers").in("video_id", videoIds)
      : Promise.resolve({ data: [] }),
  ]);

  const group = groupRes.data as Group | null;

  const scRows = (scRes.data ?? []) as Pick<Superchat, "amount_jpy" | "amount" | "currency">[];
  const needsRates = scRows.some((sc) => sc.amount_jpy == null && sc.currency !== "JPY");
  const rates = needsRates ? await fetchRatesToJPY() : {};
  const totalSCJPY = scRows.reduce((sum, sc) => {
    const jpy = sc.amount_jpy ?? (sc.currency === "JPY" ? sc.amount : rates[sc.currency] ? Math.round(sc.amount / rates[sc.currency]) : 0);
    return sum + jpy;
  }, 0);

  const peakByVideo: Record<string, number> = {};
  for (const p of (peakRes.data ?? []) as { video_id: string; concurrent_viewers: number }[]) {
    peakByVideo[p.video_id] = Math.max(peakByVideo[p.video_id] ?? 0, p.concurrent_viewers);
  }

  return { channel, videos, history, group, totalSCJPY, peakByVideo };
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;

  const mainData = await fetchChannelData(channelId);

  if (!mainData) {
    return (
      <div className="py-20 text-center text-gray-500">
        チャンネルが見つかりません
      </div>
    );
  }

  const linkedChannelId = mainData.channel.linked_channel_id;
  const linkedData = linkedChannelId ? await fetchChannelData(linkedChannelId) : null;

  return (
    <div>
      <BackButton />
      <ChannelPageContent
        mainData={mainData}
        linkedData={linkedData}
        startChannelId={channelId}
      />
    </div>
  );
}
