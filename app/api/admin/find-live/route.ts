import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/admin-auth";
import { YouTubeClient, getYouTubeApiKeys } from "@/lib/youtube/client";
import { extractVideo } from "@/lib/youtube/extractors";

async function fetchChannelVideoIds(channelId: string, yt: YouTubeClient): Promise<string[]> {
  try {
    const uploadsPlaylistId = "UU" + channelId.slice(2);
    const res = await yt.playlistItems({
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "10",
    });
    return (res.items ?? []).map((item) => item.contentDetails.videoId).filter(Boolean);
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const authError = requireAdmin(req);
  if (authError) return authError;
  try {
    const ytKeys = getYouTubeApiKeys();
    if (ytKeys.length === 0) return NextResponse.json({ error: "YOUTUBE_API_KEY missing" }, { status: 500 });

    const { data: channelsData } = await supabase
      .from("channels")
      .select("channel_id, name");
    const channels = (channelsData ?? []) as { channel_id: string; name: string }[];
    if (channels.length === 0) return NextResponse.json({ found: 0, lives: [] });

    const channelNameMap = new Map(channels.map((c) => [c.channel_id, c.name]));
    const yt = new YouTubeClient(ytKeys);

    // playlistItems で最新動画IDを収集（1ユニット/チャンネル）
    const rssResults = await Promise.allSettled(
      channels.map((c) => fetchChannelVideoIds(c.channel_id, yt))
    );

    const allVideoIds = new Set<string>();
    for (const r of rssResults) {
      if (r.status === "fulfilled") r.value.forEach((id) => allVideoIds.add(id));
    }

    const allIds = Array.from(allVideoIds);
    if (allIds.length === 0) return NextResponse.json({ found: 0, lives: [] });

    // DB から既知のステータスを取得
    const { data: existingData } = await supabase
      .from("videos")
      .select("video_id, status, channel_id, title")
      .in("video_id", allIds);

    type VideoRow = { video_id: string; status: string; channel_id: string; title: string };
    const rows = (existingData ?? []) as VideoRow[];
    const existingMap = new Map(rows.map((v) => [v.video_id, v]));

    // DB で既に live 確定のものはそのまま返す
    const knownLive = rows.filter((v) => v.status === "live");

    // upcoming または未登録のみ videos.list で確認
    const toCheck = allIds.filter((id) => {
      const s = existingMap.get(id)?.status;
      return s === undefined || s === "upcoming";
    });

    type LiveEntry = { videoId: string; channelId: string; channelName: string; title: string };

    const liveVideos: LiveEntry[] = knownLive.map((v) => ({
      videoId: v.video_id,
      channelId: v.channel_id,
      channelName: channelNameMap.get(v.channel_id) ?? v.channel_id,
      title: v.title,
    }));

    if (toCheck.length > 0) {

      for (let i = 0; i < toCheck.length; i += 50) {
        const batch = toCheck.slice(i, i + 50);
        const res = await yt.videos({
          part: "snippet,liveStreamingDetails",
          id: batch.join(","),
        });

        for (const item of res.items ?? []) {
          const video = extractVideo(item);
          await supabase.from("videos").upsert(video, { onConflict: "video_id" });

          if (video.status === "live" && !liveVideos.some((v) => v.videoId === item.id)) {
            liveVideos.push({
              videoId: item.id,
              channelId: video.channel_id,
              channelName: channelNameMap.get(video.channel_id) ?? video.channel_id,
              title: video.title,
            });
          }
        }
      }
    }

    return NextResponse.json({ found: liveVideos.length, lives: liveVideos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
