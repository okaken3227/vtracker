import { supabase } from "@/lib/supabase/client";
import { YouTubeClient } from "@/lib/youtube/client";
import { TwitchClient } from "@/lib/twitch/client";
import { extractVideo } from "@/lib/youtube/extractors";
import { extractTwitchStream } from "@/lib/twitch/extractors";
import { fetchVideoIdsFromRSS } from "@/lib/youtube/rss";

export const dynamic = "force-dynamic";

type LiveEntry = {
  videoId: string;
  channelId: string;
  channelName: string;
  title: string;
  platform?: string;
  url?: string;
};

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // client disconnected
        }
      };

      try {
        const { data: channelsData } = await supabase
          .from("channels")
          .select("channel_id, name, platform");
        const allChannels = (channelsData ?? []) as { channel_id: string; name: string; platform?: string }[];

        if (allChannels.length === 0) {
          send({ type: "done", found: 0, lives: [] });
          controller.close();
          return;
        }

        const ytChannels = allChannels.filter((c) => !c.platform || c.platform === "youtube");
        const twitchChannels = allChannels.filter((c) => c.platform === "twitch");

        send({ type: "info", message: `${ytChannels.length}件のYouTubeチャンネル / ${twitchChannels.length}件のTwitchチャンネルをスキャン開始` });

        const channelNameMap = new Map(allChannels.map((c) => [c.channel_id, c.name]));
        const liveVideos: LiveEntry[] = [];
        let totalApiCalls = 0;
        let totalApiUnits = 0;

        // ── YouTube ──────────────────────────────────────────────
        if (ytChannels.length > 0) {
          const apiKey = process.env.YOUTUBE_API_KEY;
          if (!apiKey) {
            send({ type: "error", message: "YOUTUBE_API_KEY missing" });
          } else {
            const yt = new YouTubeClient(apiKey);

            // RSS取得（並列）
            const allVideoIds = new Set<string>();
            await Promise.all(
              ytChannels.map(async (c) => {
                try {
                  const ids = await fetchVideoIdsFromRSS(c.channel_id);
                  ids.forEach((id) => allVideoIds.add(id));
                  send({ type: "rss", channel: c.name, count: ids.length });
                } catch {
                  send({ type: "rss_error", channel: c.name });
                }
              })
            );

            const allIds = Array.from(allVideoIds);
            send({ type: "phase", message: `YouTube RSS完了 — ${allIds.length}件の動画` });

            if (allIds.length > 0) {
              const { data: existingData } = await supabase
                .from("videos")
                .select("video_id, status, channel_id, title")
                .in("video_id", allIds);

              type VideoRow = { video_id: string; status: string; channel_id: string; title: string };
              const rows = (existingData ?? []) as VideoRow[];
              const existingMap = new Map(rows.map((v) => [v.video_id, v]));

              const { data: upcomingData } = await supabase
                .from("videos")
                .select("video_id, status, channel_id, title")
                .eq("status", "upcoming");
              const upcomingRows = (upcomingData ?? []) as VideoRow[];
              for (const v of upcomingRows) {
                if (!existingMap.has(v.video_id)) existingMap.set(v.video_id, v);
              }

              const knownLive = rows.filter((v) => v.status === "live");
              for (const v of knownLive) {
                const channelName = channelNameMap.get(v.channel_id) ?? v.channel_id;
                liveVideos.push({ videoId: v.video_id, channelId: v.channel_id, channelName, title: v.title, platform: "youtube" });
                send({ type: "live_known", channel: channelName, title: v.title });
              }

              const toCheckSet = new Set<string>();
              for (const id of allIds) {
                const s = existingMap.get(id)?.status;
                if (s === undefined || s === "upcoming") toCheckSet.add(id);
              }
              for (const v of upcomingRows) toCheckSet.add(v.video_id);
              const toCheck = Array.from(toCheckSet);

              if (toCheck.length > 0) {
                const totalBatches = Math.ceil(toCheck.length / 50);
                send({ type: "phase", message: `YouTube APIで${toCheck.length}件を確認中...` });

                const batches = Array.from({ length: totalBatches }, (_, i) =>
                  toCheck.slice(i * 50, (i + 1) * 50)
                );

                await Promise.all(
                  batches.map(async (batch, batchIdx) => {
                    send({ type: "api_batch", batch: batchIdx + 1, total: totalBatches, count: batch.length });
                    const res = await yt.videos({ part: "snippet,liveStreamingDetails", id: batch.join(",") });
                    totalApiCalls++;
                    totalApiUnits++;

                    for (const video of res.items ?? []) {
                      const v = extractVideo(video);
                      await supabase.from("videos").upsert(v, { onConflict: "video_id" });
                      if (v.status === "live" && !liveVideos.some((lv) => lv.videoId === v.video_id)) {
                        const channelName = channelNameMap.get(v.channel_id) ?? v.channel_id;
                        liveVideos.push({ videoId: v.video_id, channelId: v.channel_id, channelName, title: v.title, platform: "youtube" });
                        send({ type: "live_new", channel: channelName, title: v.title });
                      }
                    }
                  })
                );

                send({ type: "phase", message: `YouTube確認完了 (API ${totalApiCalls}回 / ${totalApiUnits}ユニット消費)` });
              }
            }
          }
        }

        // ── Twitch ───────────────────────────────────────────────
        if (twitchChannels.length > 0) {
          const clientId = process.env.TWITCH_CLIENT_ID;
          const clientSecret = process.env.TWITCH_CLIENT_SECRET;
          if (!clientId || !clientSecret) {
            send({ type: "error", message: "TWITCH_CLIENT_ID/SECRET missing — Twitchをスキップ" });
          } else {
            send({ type: "phase", message: `Twitch: ${twitchChannels.length}チャンネルを確認中...` });
            const tw = new TwitchClient(clientId, clientSecret);
            const userIds = twitchChannels.map((c) => c.channel_id);

            // DB上でTwitchのライブ中動画を確認
            const { data: twitchLiveData } = await supabase
              .from("videos")
              .select("video_id, channel_id, title")
              .eq("status", "live")
              .eq("platform", "twitch");
            const twitchKnownLive = new Set(
              ((twitchLiveData ?? []) as { channel_id: string }[]).map((v) => v.channel_id)
            );

            for (let i = 0; i < userIds.length; i += 100) {
              const batch = userIds.slice(i, i + 100);
              const streamsRes = await tw.streams({ user_id: batch });

              for (const stream of streamsRes.data) {
                const video = extractTwitchStream(stream);
                await supabase.from("videos").upsert(video, { onConflict: "video_id" });

                const channelName = channelNameMap.get(stream.user_id) ?? stream.user_name;
                const entry: LiveEntry = {
                  videoId: video.video_id,
                  channelId: stream.user_id,
                  channelName,
                  title: stream.title,
                  platform: "twitch",
                  url: `https://www.twitch.tv/${stream.user_login}`,
                };

                if (!liveVideos.some((lv) => lv.videoId === video.video_id)) {
                  liveVideos.push(entry);
                  if (twitchKnownLive.has(stream.user_id)) {
                    send({ type: "live_known", channel: channelName, title: stream.title, platform: "twitch" });
                  } else {
                    send({ type: "live_new", channel: channelName, title: stream.title, platform: "twitch" });
                  }
                }
              }

              // ライブ終了したTwitchストリームをマーク
              const liveUserIds = new Set(streamsRes.data.map((s) => s.user_id));
              for (const channelId of batch) {
                if (twitchKnownLive.has(channelId) && !liveUserIds.has(channelId)) {
                  await supabase
                    .from("videos")
                    .update({ status: "none", end_time: new Date().toISOString() })
                    .eq("channel_id", channelId)
                    .eq("status", "live")
                    .eq("platform", "twitch");
                  const channelName = channelNameMap.get(channelId) ?? channelId;
                  send({ type: "twitch_ended", channel: channelName });
                } else if (!liveUserIds.has(channelId) && !twitchKnownLive.has(channelId)) {
                  const channelName = channelNameMap.get(channelId) ?? channelId;
                  send({ type: "twitch_offline", channel: channelName });
                }
              }
            }
          }
        }

        if (liveVideos.length === 0) {
          send({ type: "no_live", message: "現在ライブ中のチャンネルはありません" });
        }
        send({ type: "done", found: liveVideos.length, lives: liveVideos, apiCalls: totalApiCalls, apiUnits: totalApiUnits });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send({ type: "error", message: msg });
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
