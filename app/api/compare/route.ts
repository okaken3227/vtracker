import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import type { Video, Channel } from "@/lib/types";
import type { LineConfig } from "@/app/components/CombinedLiveGraph";

const STREAM_COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#3b82f6", "#a21caf"];
const BUCKET_MS = 5 * 60 * 1000;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function formatJST(ms: number, includeDate: boolean): string {
  const utc = ms + JST_OFFSET_MS;
  const h = String(Math.floor((utc % 86400000) / 3600000)).padStart(2, "0");
  const m = String(Math.floor((utc % 3600000) / 60000)).padStart(2, "0");
  if (!includeDate) return `${h}:${m}`;
  const totalDays = Math.floor(utc / 86400000);
  const d = new Date(totalDays * 86400000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${h}:${m}`;
}

export async function GET(req: NextRequest) {
  const videoIds = req.nextUrl.searchParams.getAll("v").slice(0, 8);
  if (videoIds.length === 0) return NextResponse.json({ data: [], lines: [] });

  const [vRes, gpRes, chRes] = await Promise.all([
    supabase.from("videos").select("*").in("video_id", videoIds),
    supabase
      .from("live_graph_points")
      .select("video_id, concurrent_viewers, recorded_at")
      .in("video_id", videoIds)
      .order("recorded_at", { ascending: true }),
    supabase.from("channels").select("channel_id, name, icon_url, color"),
  ]);

  const videos = (vRes.data ?? []) as Video[];
  const graphPoints = (gpRes.data ?? []) as { video_id: string; concurrent_viewers: number; recorded_at: string }[];
  const channels = (chRes.data ?? []) as Pick<Channel, "channel_id" | "name" | "icon_url" | "color">[];

  const channelMap = new Map(channels.map((c) => [c.channel_id, c]));
  const videoMap = new Map(videos.map((v) => [v.video_id, v]));

  const allBuckets = new Set<number>();
  const videoSeries = new Map<string, Map<number, number[]>>();

  for (const videoId of videoIds) {
    if (!videoMap.has(videoId)) continue;
    const buckets = new Map<number, number[]>();
    for (const p of graphPoints) {
      if (p.video_id !== videoId) continue;
      const bucket = Math.floor(new Date(p.recorded_at).getTime() / BUCKET_MS) * BUCKET_MS;
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket)!.push(p.concurrent_viewers);
    }
    if (buckets.size === 0) continue;
    videoSeries.set(videoId, buckets);
    buckets.forEach((_, t) => allBuckets.add(t));
  }

  const sortedBuckets = Array.from(allBuckets).sort((a, b) => a - b);

  // 複数日にまたがる場合は日付も表示
  const includeDate =
    sortedBuckets.length >= 2 &&
    Math.floor((sortedBuckets[0] + JST_OFFSET_MS) / 86400000) !==
      Math.floor((sortedBuckets[sortedBuckets.length - 1] + JST_OFFSET_MS) / 86400000);

  const data: Record<string, number | string | null>[] = sortedBuckets.map((bucket) => {
    const row: Record<string, number | string | null> = { t: formatJST(bucket, includeDate) };
    for (const videoId of videoIds) {
      const vs = videoSeries.get(videoId)?.get(bucket);
      row[videoId] = vs ? Math.round(vs.reduce((s, x) => s + x, 0) / vs.length) : null;
    }
    return row;
  });

  const lines: LineConfig[] = videoIds
    .filter((id) => videoSeries.has(id))
    .map((videoId, i) => {
      const v = videoMap.get(videoId)!;
      const ch = channelMap.get(v.channel_id);
      return {
        key: videoId,
        channelName: ch?.name ?? v.channel_id,
        color: STREAM_COLORS[i % STREAM_COLORS.length],
        videoId,
        iconUrl: ch?.icon_url ?? undefined,
      };
    });

  return NextResponse.json({ data, lines });
}
