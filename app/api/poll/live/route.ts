import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { YouTubeClient, getYouTubeApiKeys } from "@/lib/youtube/client";
import { TwitchClient } from "@/lib/twitch/client";
import { extractTwitchStream } from "@/lib/twitch/extractors";
import type { Video } from "@/lib/types";


export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return pollLive(null);
}

// videoId を指定すると該当動画のみポーリング（個別ページの更新ボタン用）
export async function POST(req: NextRequest) {
  let videoId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    videoId = body.videoId ?? null;
  } catch {
    // body なしでも OK
  }

  // 全体ポーリング時: 1分以内のデータがあれば API を叩かずにスキップ
  if (!videoId) {
    const { data: latest } = await supabase
      .from("live_graph_points")
      .select("recorded_at")
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();

    if (latest) {
      const ageMs = Date.now() - new Date(latest.recorded_at).getTime();
      if (ageMs < 60 * 1000) {
        return NextResponse.json({ fresh: true, latestAt: latest.recorded_at, updated: 0 });
      }
    }
  }

  return pollLive(videoId);
}

async function pollLive(targetVideoId: string | null): Promise<NextResponse> {
  try {
    let query = supabase.from("videos").select("*").eq("status", "live");
    if (targetVideoId) query = query.eq("video_id", targetVideoId);
    const { data: liveVideos, error: dbErr } = await query;

    if (dbErr) throw dbErr;
    if (!liveVideos || liveVideos.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const videos = liveVideos as Video[];
    const ytVideos = videos.filter((v) => !v.platform || v.platform === "youtube");
    const twitchVideos = videos.filter((v) => v.platform === "twitch");
    const now = new Date().toISOString();

    const graphPoints: {
      video_id: string;
      recorded_at: string;
      concurrent_viewers: number;
      view_count: number;
      like_count: number;
    }[] = [];
    const toEnd: { videoId: string; endTime: string }[] = [];

    // ── YouTube ──────────────────────────────────────────────────
    if (ytVideos.length > 0) {
      const ytKeys = getYouTubeApiKeys();
      if (ytKeys.length === 0) {
        console.error("[poll/live] YOUTUBE_API_KEY missing");
      } else {
        const yt = new YouTubeClient(ytKeys);
        const videoIds = ytVideos.map((v) => v.video_id);

        for (let i = 0; i < videoIds.length; i += 50) {
          const batch = videoIds.slice(i, i + 50);
          const res = await yt.videos({
            part: "liveStreamingDetails,statistics",
            id: batch.join(","),
          });

          for (const item of res.items ?? []) {
            const details = item.liveStreamingDetails;

            if (details?.actualEndTime) {
              toEnd.push({ videoId: item.id, endTime: details.actualEndTime });
              continue;
            }

            graphPoints.push({
              video_id: item.id,
              recorded_at: now,
              concurrent_viewers: Math.max(0, parseInt(details?.concurrentViewers ?? "0", 10) || 0),
              view_count: Math.max(0, parseInt(item.statistics?.viewCount ?? "0", 10) || 0),
              like_count: Math.max(0, parseInt(item.statistics?.likeCount ?? "0", 10) || 0),
            });
          }
        }
      }
    }

    // ── Twitch ───────────────────────────────────────────────────
    if (twitchVideos.length > 0) {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        console.error("[poll/live] TWITCH_CLIENT_ID/SECRET missing — skipping Twitch");
      } else {
        const tw = new TwitchClient(clientId, clientSecret);
        // channel_id でTwitch APIを叩く（video_idはストリームIDで変わる可能性あり）
        const channelIds = [...new Set(twitchVideos.map((v) => v.channel_id))];

        for (let i = 0; i < channelIds.length; i += 100) {
          const batch = channelIds.slice(i, i + 100);
          const streamsRes = await tw.streams({ user_id: batch });
          const liveByChannelId = new Map(streamsRes.data.map((s) => [s.user_id, s]));

          for (const video of twitchVideos.filter((v) => batch.includes(v.channel_id))) {
            const stream = liveByChannelId.get(video.channel_id);

            if (!stream) {
              // ストリーム終了
              toEnd.push({ videoId: video.video_id, endTime: now });
              continue;
            }

            if (stream.id !== video.video_id) {
              // 同じチャンネルで新しいストリームが始まっている（再配信など）
              // 古いレコードを終了させ、新しいストリームを登録
              toEnd.push({ videoId: video.video_id, endTime: stream.started_at });
              const newVideo = extractTwitchStream(stream);
              await supabase.from("videos").upsert(newVideo, { onConflict: "video_id" });
              graphPoints.push({
                video_id: stream.id,
                recorded_at: now,
                concurrent_viewers: stream.viewer_count,
                view_count: stream.viewer_count,
                like_count: 0,
              });
            } else {
              // 同じストリームが継続中
              graphPoints.push({
                video_id: video.video_id,
                recorded_at: now,
                concurrent_viewers: stream.viewer_count,
                view_count: stream.viewer_count,
                like_count: 0,
              });
            }
          }
        }
      }
    }

    // グラフポイント保存
    if (graphPoints.length > 0) {
      const { error } = await supabase.from("live_graph_points").insert(graphPoints);
      if (error) throw error;
    }

    // ライブ終了処理
    for (const { videoId, endTime } of toEnd) {
      await supabase
        .from("videos")
        .update({ status: "none", end_time: endTime })
        .eq("video_id", videoId);
    }

    return NextResponse.json({
      updated: graphPoints.length,
      ended: toEnd.length,
      youtube: ytVideos.length,
      twitch: twitchVideos.length,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err !== null
        ? JSON.stringify(err)
        : String(err);
    console.error("[poll/live]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
