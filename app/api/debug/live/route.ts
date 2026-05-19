import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { YouTubeClient, getYouTubeApiKeys } from "@/lib/youtube/client";
import { extractVideo } from "@/lib/youtube/extractors";

async function fetchChannelVideoIds(channelId: string, yt: YouTubeClient): Promise<{ ids: string[]; ok: boolean; error?: string }> {
  try {
    const uploadsPlaylistId = "UU" + channelId.slice(2);
    const res = await yt.playlistItems({
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "10",
    });
    const ids = (res.items ?? []).map((item) => item.contentDetails.videoId).filter(Boolean);
    return { ids, ok: true };
  } catch (e) {
    return { ids: [], ok: false, error: String(e) };
  }
}

export async function POST() {
  const ytKeys = getYouTubeApiKeys();
  if (ytKeys.length === 0) return NextResponse.json({ error: "YOUTUBE_API_KEY missing" }, { status: 500 });

  const yt = new YouTubeClient(ytKeys);

  // Step 1: チャンネル一覧取得
  const { data: channelsData } = await supabase.from("channels").select("channel_id, name");
  const channels = (channelsData ?? []) as { channel_id: string; name: string }[];

  // Step 2: 各チャンネルのアップロードプレイリストから最新動画ID取得
  const playlistResults = await Promise.all(
    channels.map(async (ch) => {
      const result = await fetchChannelVideoIds(ch.channel_id, yt);
      return { channelId: ch.channel_id, channelName: ch.name, ...result };
    })
  );

  const allVideoIds = new Set<string>();
  for (const r of playlistResults) r.ids.forEach((id) => allVideoIds.add(id));

  const allIds = Array.from(allVideoIds);

  // Step 3: DBの既知ステータスを取得
  const { data: existingData } = await supabase
    .from("videos")
    .select("video_id, status, title")
    .in("video_id", allIds);

  type DbVideo = { video_id: string; status: string; title: string };
  const dbMap = new Map(((existingData ?? []) as DbVideo[]).map((v) => [v.video_id, v]));

  // Step 4: DB上でliveなもの（APIなしで確定）
  const dbLive = (existingData ?? []).filter((v) => (v as DbVideo).status === "live") as DbVideo[];

  // Step 5: APIで確認が必要なもの（upcoming or 未登録）
  const toCheck = allIds.filter((id) => {
    const s = dbMap.get(id)?.status;
    return s === undefined || s === "upcoming";
  });

  // Step 6: noneでスキップされたもの
  const skippedNone = allIds.filter((id) => dbMap.get(id)?.status === "none");

  // Step 7: videos.list で確認
  type ApiResult = {
    videoId: string;
    title: string;
    channelId: string;
    status: string;
    wasInDb: boolean;
    previousStatus: string | null;
  };
  const apiResults: ApiResult[] = [];

  for (let i = 0; i < toCheck.length; i += 50) {
    const batch = toCheck.slice(i, i + 50);
    try {
      const res = await yt.videos({
        part: "snippet,liveStreamingDetails",
        id: batch.join(","),
      });
      for (const item of res.items ?? []) {
        const video = extractVideo(item);
        apiResults.push({
          videoId: item.id,
          title: video.title,
          channelId: video.channel_id,
          status: video.status,
          wasInDb: dbMap.has(item.id),
          previousStatus: dbMap.get(item.id)?.status ?? null,
        });
      }
    } catch (e) {
      apiResults.push({
        videoId: `[batch error]`,
        title: `ERROR: ${String(e)}`,
        channelId: "",
        status: "error",
        wasInDb: false,
        previousStatus: null,
      });
    }
  }

  const finalLive = apiResults.filter((r) => r.status === "live");

  return NextResponse.json({
    summary: {
      totalChannels: channels.length,
      totalPlaylistVideos: allIds.length,
      dbLiveCount: dbLive.length,
      toCheckCount: toCheck.length,
      skippedNoneCount: skippedNone.length,
      apiCheckedCount: apiResults.length,
      finalLiveCount: finalLive.length + dbLive.length,
    },
    playlistPerChannel: playlistResults.map((r) => ({
      channelId: r.channelId,
      channelName: r.channelName,
      ok: r.ok,
      error: r.error,
      videoCount: r.ids.length,
      videoIds: r.ids,
    })),
    dbAlreadyLive: dbLive.map((v) => ({
      videoId: v.video_id,
      title: v.title,
    })),
    skippedBecauseNone: skippedNone.map((id) => ({
      videoId: id,
      title: dbMap.get(id)?.title ?? "?",
    })),
    apiResults,
    finalLive: [
      ...dbLive.map((v) => ({ videoId: v.video_id, title: v.title, source: "db" })),
      ...finalLive.map((r) => ({ videoId: r.videoId, title: r.title, source: "api" })),
    ],
  });
}
