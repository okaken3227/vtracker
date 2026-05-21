import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

type VideoRow = { video_id: string; channel_id: string };
type GraphPoint = { video_id: string; bucket: string; avg_viewers: number };
type SCRow = { video_id: string; amount_jpy: number | null };
type StatsRow = { channel_id: string; subscriber_count: number; recorded_at: string };

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const channelIds = (searchParams.get("channelIds") ?? "").split(",").filter(Boolean);
  const fromIso = searchParams.get("from") ?? "";
  const toIso = searchParams.get("to") ?? "";

  if (channelIds.length === 0) return NextResponse.json({ data: [] });

  if (type === "viewers") {
    const { data: videosData } = await supabase
      .from("videos")
      .select("video_id, channel_id")
      .in("channel_id", channelIds);

    const videos = (videosData ?? []) as VideoRow[];
    const videoIdToChannelId = new Map(videos.map((v) => [v.video_id, v.channel_id]));
    const videoIds = videos.map((v) => v.video_id);

    if (videoIds.length === 0) return NextResponse.json({ data: [] });

    const { data: gpData } = await supabase
      .rpc("get_chart_data", { from_ts: fromIso, to_ts: toIso })
      .limit(200000);

    const allPoints = (gpData ?? []) as GraphPoint[];
    const points = allPoints.filter((p) => videoIdToChannelId.has(p.video_id));

    const bucketMap = new Map<string, Map<string, number[]>>();
    for (const p of points) {
      const channelId = videoIdToChannelId.get(p.video_id);
      if (!channelId) continue;
      if (!bucketMap.has(p.bucket)) bucketMap.set(p.bucket, new Map());
      const cm = bucketMap.get(p.bucket)!;
      if (!cm.has(channelId)) cm.set(channelId, []);
      cm.get(channelId)!.push(p.avg_viewers);
    }

    const buckets = Array.from(bucketMap.keys()).sort();
    const chartData = buckets.map((bucket) => {
      const cm = bucketMap.get(bucket)!;
      const row: Record<string, string | number | null> = { t: bucket };
      for (const channelId of channelIds) {
        const vals = cm.get(channelId);
        row[channelId] = vals ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : null;
      }
      return row;
    });

    return NextResponse.json({ data: chartData });
  }

  if (type === "sc") {
    const { data: videosData } = await supabase
      .from("videos")
      .select("video_id, channel_id")
      .in("channel_id", channelIds);

    const videos = (videosData ?? []) as VideoRow[];
    const videoIdToChannelId = new Map(videos.map((v) => [v.video_id, v.channel_id]));
    const videoIds = videos.map((v) => v.video_id);

    if (videoIds.length === 0) return NextResponse.json({ data: [] });

    const { data: scData } = await supabase
      .from("superchats")
      .select("video_id, amount_jpy")
      .in("video_id", videoIds)
      .gte("published_at", fromIso)
      .lte("published_at", toIso)
      .not("amount_jpy", "is", null)
      .limit(200000);

    const scRows = (scData ?? []) as SCRow[];
    const scByChannel = new Map<string, number>();
    for (const sc of scRows) {
      const channelId = videoIdToChannelId.get(sc.video_id);
      if (!channelId) continue;
      scByChannel.set(channelId, (scByChannel.get(channelId) ?? 0) + (sc.amount_jpy ?? 0));
    }

    const data = channelIds.map((channelId) => ({
      channelId,
      value: scByChannel.get(channelId) ?? 0,
    }));

    return NextResponse.json({ data });
  }

  if (type === "subs") {
    const { data: histData } = await supabase
      .from("channel_stats_history")
      .select("channel_id, subscriber_count, recorded_at")
      .in("channel_id", channelIds)
      .gte("recorded_at", fromIso)
      .lte("recorded_at", toIso)
      .order("recorded_at", { ascending: true })
      .limit(10000);

    const rows = (histData ?? []) as StatsRow[];
    const dateMap = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const day = r.recorded_at.slice(0, 10);
      if (!dateMap.has(day)) dateMap.set(day, new Map());
      dateMap.get(day)!.set(r.channel_id, r.subscriber_count);
    }

    const days = Array.from(dateMap.keys()).sort();
    const chartData = days.map((day) => {
      const cm = dateMap.get(day)!;
      const row: Record<string, string | number | null> = { t: day };
      for (const channelId of channelIds) {
        row[channelId] = cm.get(channelId) ?? null;
      }
      return row;
    });

    return NextResponse.json({ data: chartData });
  }

  return NextResponse.json({ data: [] });
}
