import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import type { Video, Channel } from "@/lib/types";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const exclude = req.nextUrl.searchParams.getAll("exclude");

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from("videos")
    .select("video_id, title, channel_id, start_time, status, platform, thumbnail_url")
    .gte("start_time", since)
    .order("start_time", { ascending: false })
    .limit(60);

  if (exclude.length > 0) query = query.not("video_id", "in", `(${exclude.join(",")})`);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data: videos } = await query;
  if (!videos || videos.length === 0) return NextResponse.json([]);

  const channelIds = [...new Set((videos as Pick<Video, "channel_id">[]).map((v) => v.channel_id))];
  const { data: channels } = await supabase
    .from("channels")
    .select("channel_id, name, icon_url")
    .in("channel_id", channelIds);

  const chMap = new Map(
    ((channels ?? []) as Pick<Channel, "channel_id" | "name" | "icon_url">[]).map((c) => [c.channel_id, c])
  );

  const result = (videos as (Pick<Video, "video_id" | "title" | "channel_id" | "start_time" | "status" | "platform"> & { thumbnail_url?: string })[]).map((v) => {
    const ch = chMap.get(v.channel_id);
    return {
      videoId: v.video_id,
      title: v.title,
      channelName: ch?.name ?? v.channel_id,
      iconUrl: ch?.icon_url ?? null,
      startTime: v.start_time,
      status: v.status,
      platform: v.platform ?? "youtube",
    };
  });

  return NextResponse.json(result);
}
