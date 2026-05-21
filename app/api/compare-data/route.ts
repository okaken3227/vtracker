import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

type VideoRow = { video_id: string; channel_id: string };
type RawPoint = { video_id: string; concurrent_viewers: number; recorded_at: string };
type SCRow = { video_id: string; amount_jpy: number | null };
type StatsRow = { channel_id: string; subscriber_count: number; recorded_at: string };

const BUCKET_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type");
  const channelIds = (searchParams.get("channelIds") ?? "").split(",").filter(Boolean);
  const fromIso = searchParams.get("from") ?? "";
  const toIso = searchParams.get("to") ?? "";

  if (channelIds.length === 0) return NextResponse.json({ data: [] });

  if (type === "viewers") {
    // 時間範囲内の動画のみ取得（全履歴を取らない）
    let videoQuery = supabase
      .from("videos")
      .select("video_id, channel_id")
      .in("channel_id", channelIds)
      .lte("start_time", toIso);
    if (fromIso) {
      const bufferIso = new Date(new Date(fromIso).getTime() - 12 * 3600 * 1000).toISOString();
      videoQuery = videoQuery.gte("start_time", bufferIso);
    }
    const { data: videosData } = await videoQuery;

    const videos = (videosData ?? []) as VideoRow[];
    const videoIdToChannelId = new Map(videos.map((v) => [v.video_id, v.channel_id]));
    const videoIds = videos.map((v) => v.video_id);

    if (videoIds.length === 0) return NextResponse.json({ data: [] });

    // video_idと時間範囲で直接フィルタ（RPCで全データ取得しない）
    let gpQuery = supabase
      .from("live_graph_points")
      .select("video_id, concurrent_viewers, recorded_at")
      .in("video_id", videoIds)
      .lte("recorded_at", toIso)
      .limit(50000);
    if (fromIso) gpQuery = gpQuery.gte("recorded_at", fromIso);
    const { data: gpData } = await gpQuery;

    const points = (gpData ?? []) as RawPoint[];

    // 5分バケットに集約
    const bucketMap = new Map<number, Map<string, number[]>>();
    for (const p of points) {
      const channelId = videoIdToChannelId.get(p.video_id);
      if (!channelId) continue;
      const t = Math.floor(new Date(p.recorded_at).getTime() / BUCKET_MS) * BUCKET_MS;
      if (!bucketMap.has(t)) bucketMap.set(t, new Map());
      const cm = bucketMap.get(t)!;
      if (!cm.has(channelId)) cm.set(channelId, []);
      cm.get(channelId)!.push(p.concurrent_viewers);
    }

    const buckets = Array.from(bucketMap.keys()).sort((a, b) => a - b);
    const chartData = buckets.map((t) => {
      const cm = bucketMap.get(t)!;
      const row: Record<string, string | number | null> = { t: new Date(t).toISOString() };
      for (const channelId of channelIds) {
        const vals = cm.get(channelId);
        row[channelId] = vals ? Math.round(vals.reduce((s, x) => s + x, 0) / vals.length) : null;
      }
      return row;
    });

    return NextResponse.json({ data: chartData });
  }

  if (type === "sc") {
    // 時間範囲内の動画のみ取得
    let scVideoQuery = supabase
      .from("videos")
      .select("video_id, channel_id")
      .in("channel_id", channelIds)
      .lte("start_time", toIso);
    if (fromIso) {
      const bufferIso = new Date(new Date(fromIso).getTime() - 12 * 3600 * 1000).toISOString();
      scVideoQuery = scVideoQuery.gte("start_time", bufferIso);
    }
    const { data: videosData } = await scVideoQuery;

    const videos = (videosData ?? []) as VideoRow[];
    const videoIdToChannelId = new Map(videos.map((v) => [v.video_id, v.channel_id]));
    const videoIds = videos.map((v) => v.video_id);

    if (videoIds.length === 0) return NextResponse.json({ data: [] });

    let scQuery = supabase
      .from("superchats")
      .select("video_id, amount_jpy")
      .in("video_id", videoIds)
      .lte("published_at", toIso)
      .not("amount_jpy", "is", null)
      .limit(200000);
    if (fromIso) scQuery = scQuery.gte("published_at", fromIso);
    const { data: scData } = await scQuery;

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
    let subsQuery = supabase
      .from("channel_stats_history")
      .select("channel_id, subscriber_count, recorded_at")
      .in("channel_id", channelIds)
      .lte("recorded_at", toIso)
      .order("recorded_at", { ascending: true })
      .limit(10000);
    if (fromIso) subsQuery = subsQuery.gte("recorded_at", fromIso);
    const { data: histData } = await subsQuery;

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
