import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { YouTubeClient, getYouTubeApiKeys } from "@/lib/youtube/client";
import { TwitchClient } from "@/lib/twitch/client";
import { extractVideo } from "@/lib/youtube/extractors";
import { extractTwitchStream } from "@/lib/twitch/extractors";
import type { Video } from "@/lib/types";

type GraphPoint = {
  video_id: string;
  recorded_at: string;
  concurrent_viewers: number;
  view_count: number;
  like_count: number;
};

async function fetchRssVideoIds(channelId: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    return Array.from(xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g), (m) => m[1]);
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
    const ytKeys = getYouTubeApiKeys();
    if (ytKeys.length === 0) {
      return NextResponse.json({ error: "YOUTUBE_API_KEY missing" }, { status: 500 });
    }

    const { data: channelsData, error: chErr } = await supabase
      .from("channels")
      .select("channel_id, platform");
    if (chErr) throw chErr;

    const allChannels = (channelsData ?? []) as { channel_id: string; platform?: string }[];
    const ytChannelIds = allChannels
      .filter((c) => !c.platform || c.platform === "youtube")
      .map((c) => c.channel_id);
    const twitchChannelIds = allChannels
      .filter((c) => c.platform === "twitch")
      .map((c) => c.channel_id);

    const now = new Date().toISOString();
    const initialGraphPoints: GraphPoint[] = [];

    // ── Twitch: 新規配信の検知 ────────────────────────────────────
    let twitchStarted = 0;
    if (twitchChannelIds.length > 0) {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;
      if (clientId && clientSecret) {
        try {
          const tw = new TwitchClient(clientId, clientSecret);
          for (let i = 0; i < twitchChannelIds.length; i += 100) {
            const batch = twitchChannelIds.slice(i, i + 100);
            const streamsRes = await tw.streams({ user_id: batch });

            const streamIds = streamsRes.data.map((s) => s.id);
            const { data: existingData } = await supabase
              .from("videos")
              .select("video_id, status")
              .in("video_id", streamIds);
            const existingTwitchMap = new Map(
              ((existingData ?? []) as { video_id: string; status: string }[]).map((v) => [v.video_id, v.status])
            );

            for (const stream of streamsRes.data) {
              const existingStatus = existingTwitchMap.get(stream.id);
              if (!existingStatus || existingStatus !== "live") {
                const video = extractTwitchStream(stream);
                await supabase.from("videos").upsert(video, { onConflict: "video_id" });
                twitchStarted++;
                // ライブ検知と同時に初回グラフポイントを記録
                initialGraphPoints.push({
                  video_id: stream.id,
                  recorded_at: now,
                  concurrent_viewers: stream.viewer_count,
                  view_count: stream.viewer_count,
                  like_count: 0,
                });
              }
            }
          }
        } catch (err) {
          console.error("[poll/videos] Twitch error:", err);
        }
      }
    }

    if (ytChannelIds.length === 0) {
      if (initialGraphPoints.length > 0) {
        await supabase.from("live_graph_points").insert(initialGraphPoints);
      }
      return NextResponse.json({ checked: 0, started: twitchStarted, discovered: twitchStarted });
    }

    // ── YouTube: RSS で動画ID収集（APIユニット消費ゼロ）──────────────
    const rssResults = await Promise.allSettled(
      ytChannelIds.map((id) => fetchRssVideoIds(id)),
    );
    const allVideoIds = new Set<string>();
    for (const r of rssResults) {
      if (r.status === "fulfilled") r.value.forEach((id) => allVideoIds.add(id));
    }

    if (allVideoIds.size === 0) {
      if (initialGraphPoints.length > 0) {
        await supabase.from("live_graph_points").insert(initialGraphPoints);
      }
      return NextResponse.json({ checked: 0, started: twitchStarted, discovered: twitchStarted });
    }

    // DBに存在するビデオIDを確認
    const allIds = Array.from(allVideoIds);
    const { data: existingData } = await supabase
      .from("videos")
      .select("video_id, status")
      .in("video_id", allIds);
    const existingMap = new Map(
      ((existingData ?? []) as { video_id: string; status: string }[]).map((v) => [v.video_id, v.status]),
    );

    // 未登録 or upcoming のみ videos.list で確認（none = 終了済みは再確認不要）
    const toCheck = allIds.filter((id) => {
      const s = existingMap.get(id);
      return s === undefined || s === "upcoming";
    });

    if (toCheck.length === 0) {
      if (initialGraphPoints.length > 0) {
        await supabase.from("live_graph_points").insert(initialGraphPoints);
      }
      return NextResponse.json({ checked: 0, started: twitchStarted, discovered: twitchStarted });
    }

    const yt = new YouTubeClient(ytKeys);
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
        const isNewLive =
          (existing === undefined && updated.status === "live") ||
          (existing !== undefined && updated.status === "live" && existing !== "live");

        if (existing === undefined) {
          if (updated.status === "live" || updated.status === "upcoming") {
            await supabase.from("videos").upsert(updated, { onConflict: "video_id" });
            discovered++;
            if (updated.status === "live") started++;
          }
        } else if (updated.status !== existing) {
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

        // ライブ検知と同時に初回グラフポイントを記録
        if (isNewLive) {
          const concurrentViewers = parseInt(
            item.liveStreamingDetails?.concurrentViewers ?? "0",
            10,
          );
          initialGraphPoints.push({
            video_id: item.id,
            recorded_at: now,
            concurrent_viewers: concurrentViewers,
            view_count: 0,
            like_count: 0,
          });
        }
      }
    }

    if (initialGraphPoints.length > 0) {
      await supabase.from("live_graph_points").insert(initialGraphPoints);
    }

    return NextResponse.json({
      checked,
      started: started + twitchStarted,
      discovered: discovered + twitchStarted,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message :
      typeof err === "object" && err !== null ? JSON.stringify(err) : String(err);
    console.error("[poll/videos]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
