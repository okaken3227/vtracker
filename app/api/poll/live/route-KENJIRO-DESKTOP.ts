import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { YouTubeClient } from "@/lib/youtube/client";
import { TwitchClient } from "@/lib/twitch/client";
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
  return pollLive(videoId);
}

async function pollLive(targetVideoId: string | null): Promise<NextResponse> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "YOUTUBE_API_KEY missing" }, { status: 500 });
    }

    let query = supabase.from("videos").select("*").eq("status", "live");
    if (targetVideoId) {
      query = query.eq("video_id", targetVideoId);
    }
    const { data: liveVideos, error: dbErr } = await query;

    if (dbErr) throw dbErr;
    if (!liveVideos || liveVideos.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const videos = liveVideos as Video[];
    const ytVideos = videos.filter((v) => !v.platform || v.platform === "youtube");
    const twitchVideos = videos.filter((v) => v.platform === "twitch");
    const videoIds = ytVideos.map((v) => v.video_id);
    const yt = new YouTubeClient(apiKey);
    const now = new Date().toISOString();

    const graphPoints: {
      video_id: string;
      recorded_at: string;
      concurrent_viewers: number;
      view_count: number;
      like_count: number;
    }[] = [];
    const toEnd: { videoId: string; endTime: string }[] = [];
    const liveChatIds: { videoId: string; chatId: string }[] = [];

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
          concurrent_viewers: parseInt(details?.concurrentViewers ?? "0", 10),
          view_count: parseInt(item.statistics?.viewCount ?? "0", 10),
          like_count: parseInt(item.statistics?.likeCount ?? "0", 10),
        });

        if (details?.activeLiveChatId) {
          liveChatIds.push({ videoId: item.id, chatId: details.activeLiveChatId });
        }
      }
    }

    // Twitch live stream polling
    if (twitchVideos.length > 0) {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;
      if (clientId && clientSecret) {
        const tw = new TwitchClient(clientId, clientSecret);
        const channelIds = [...new Set(twitchVideos.map((v) => v.channel_id))];

        for (let i = 0; i < channelIds.length; i += 100) {
          const batch = channelIds.slice(i, i + 100);
          const streamsRes = await tw.streams({ user_id: batch });
          const liveByUserId = new Map(streamsRes.data.map((s) => [s.user_id, s]));

          for (const video of twitchVideos.filter((v) => batch.includes(v.channel_id))) {
            const stream = liveByUserId.get(video.channel_id);
            if (!stream) {
              toEnd.push({ videoId: video.video_id, endTime: now });
            } else {
              graphPoints.push({
                video_id: video.video_id,
                recorded_at: now,
                concurrent_viewers: stream.viewer_count,
                view_count: 0,
                like_count: 0,
              });
            }
          }
        }
      }
    }

    if (graphPoints.length > 0) {
      const { error } = await supabase.from("live_graph_points").insert(graphPoints);
      if (error) throw error;
    }

    for (const { videoId, endTime } of toEnd) {
      await supabase
        .from("videos")
        .update({ status: "none", end_time: endTime })
        .eq("video_id", videoId);
    }

    // スパチャ収集（ライブ中のみ）
    let newSuperchats = 0;
    if (liveChatIds.length > 0) {
      // 為替レートを一度だけ取得（1 JPY = rates[currency]）
      let rates: Record<string, number> = {};
      try {
        const rateRes = await fetch("https://open.er-api.com/v6/latest/JPY");
        if (rateRes.ok) {
          const rateData = (await rateRes.json()) as { rates?: Record<string, number> };
          rates = rateData.rates ?? {};
        }
      } catch {
        // 為替取得失敗は amount_jpy を null で保存して継続
      }

      for (const { videoId, chatId } of liveChatIds) {
        try {
          const chatRes = await yt.liveChatMessages({
            part: "snippet,authorDetails",
            liveChatId: chatId,
            maxResults: "2000",
          });

          const scItems = (chatRes.items ?? []).filter(
            (item) => item.snippet.type === "superChatEvent" && item.snippet.superChatDetails,
          );

          if (scItems.length === 0) continue;

          const rows = scItems.map((item) => {
            const details = item.snippet.superChatDetails!;
            const currency = details.currency;
            const amount = Math.round(parseInt(details.amountMicros, 10) / 1_000_000);
            const exchangeRate = currency === "JPY" ? 1 : (rates[currency] ?? null);
            const amountJpy =
              currency === "JPY"
                ? amount
                : exchangeRate != null
                ? Math.round(amount / exchangeRate)
                : null;
            return {
              id: item.id,
              video_id: videoId,
              author_channel_id: item.authorDetails.channelId,
              author_name: item.authorDetails.displayName,
              amount,
              currency,
              comment: details.userComment ?? "",
              tier: details.tier,
              published_at: item.snippet.publishedAt,
              amount_jpy: amountJpy,
              exchange_rate: exchangeRate,
            };
          });

          const { error: scErr } = await supabase
            .from("superchats")
            .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
          if (scErr) throw scErr;
          newSuperchats += rows.length;
        } catch (e) {
          console.error(`[poll/live] superchat fetch failed for ${videoId}:`, e);
        }
      }
    }

    return NextResponse.json({ updated: graphPoints.length, ended: toEnd.length, superchats: newSuperchats });
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
