import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { YouTubeClient } from "@/lib/youtube/client";
import { extractVideo } from "@/lib/youtube/extractors";
import type { Video } from "@/lib/types";

// アップロードプレイリストから最新動画IDを取得（1ユニット/チャンネル）
async function fetchChannelVideoIds(channelId: string, yt: YouTubeClient): Promise<string[]> {
  try {
    const uploadsPlaylistId = "UU" + channelId.slice(2); // UC → UU
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

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return pollVideos();
}

export async function POST() {
  return pollVideos();
}

async function pollVideos(): Promise<NextResponse> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "YOUTUBE_API_KEY missing" }, { status: 500 });
    }

    const { data: channelsData, error: chErr } = await supabase
      .from("channels")
      .select("channel_id");
    if (chErr) throw chErr;
    const channelIds = ((channelsData ?? []) as { channel_id: string }[]).map((c) => c.channel_id);
    if (channelIds.length === 0) return NextResponse.json({ checked: 0, started: 0, discovered: 0 });

    const yt = new YouTubeClient(apiKey);

    // 1. 各チャンネルのアップロードプレイリストから最新動画IDを収集（1ユニット/チャンネル）
    const playlistResults = await Promise.allSettled(
      channelIds.map((id) => fetchChannelVideoIds(id, yt))
    );
    const allVideoIds = new Set<string>();
    for (const r of playlistResults) {
      if (r.status === "fulfilled") r.value.forEach((id) => allVideoIds.add(id));
    }

    // 2. DBに存在するビデオIDを取得
    const allIds = Array.from(allVideoIds);
    const { data: existingData } = await supabase
      .from("videos")
      .select("video_id, status")
      .in("video_id", allIds);
    const existingMap = new Map(
      ((existingData ?? []) as { video_id: string; status: string }[]).map((v) => [v.video_id, v.status])
    );

    // 3. upcoming/none（status確認が必要）& 未登録のビデオを対象に
    const toCheck = allIds.filter((id) => {
      const s = existingMap.get(id);
      return s === undefined || s === "upcoming" || s === "none";
    });

    if (toCheck.length === 0) {
      return NextResponse.json({ checked: 0, started: 0, discovered: 0 });
    }

    let started = 0;
    let discovered = 0;
    let checked = 0;

    for (let i = 0; i < toCheck.length; i += 50) {
      const batch = toCheck.slice(i, i + 50);
      const res = await yt.videos({
        part: "snippet,liveStreamingDetails",
        id: batch.join(","),
      });

      for (const item of res.items ?? []) {
        checked++;
        const updated = extractVideo(item);
        const existing = existingMap.get(item.id);

        if (existing === undefined) {
          // 未登録の live/upcoming 動画を新規追加
          if (updated.status === "live" || updated.status === "upcoming") {
            await supabase
              .from("videos")
              .upsert(updated, { onConflict: "video_id" });
            discovered++;
            if (updated.status === "live") started++;
          }
        } else if (updated.status !== existing) {
          // ステータス変化（upcoming→live など）
          await supabase
            .from("videos")
            .update({
              status: updated.status,
              start_time: updated.start_time,
              end_time: updated.end_time,
              live_chat_id: updated.live_chat_id,
            })
            .eq("video_id", item.id);
          if (updated.status === "live" && existing !== "live") started++;
        }
      }
    }

    return NextResponse.json({ checked, started, discovered });
  } catch (err) {
    const message =
      err instanceof Error ? err.message :
      typeof err === "object" && err !== null ? JSON.stringify(err) : String(err);
    console.error("[poll/videos]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
