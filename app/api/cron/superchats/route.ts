import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { YouTubeClient, getYouTubeApiKeys } from "@/lib/youtube/client";
import { fetchRatesToJPY } from "@/lib/exchange";
import type { Video } from "@/lib/types";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const ytKeys = getYouTubeApiKeys();
  if (ytKeys.length === 0) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY missing" }, { status: 500 });
  }

  // live_chat_id を持つライブ中のYouTube動画を取得
  const { data: liveVideos, error: dbErr } = await supabase
    .from("videos")
    .select("video_id, live_chat_id")
    .eq("status", "live")
    .not("live_chat_id", "is", null)
    .or("platform.is.null,platform.eq.youtube");

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  if (!liveVideos || liveVideos.length === 0) {
    return NextResponse.json({ superchats: 0 });
  }

  const videos = liveVideos as Pick<Video, "video_id" | "live_chat_id">[];
  const yt = new YouTubeClient(ytKeys);

  // 為替レート取得
  const rates = await fetchRatesToJPY().catch(() => ({} as Record<string, number>));

  let totalNew = 0;

  for (const { video_id, live_chat_id } of videos) {
    if (!live_chat_id) continue;
    try {
      const chatRes = await yt.liveChatMessages({
        part: "snippet,authorDetails",
        liveChatId: live_chat_id,
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
          video_id,
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
      if (scErr) console.error(`[cron/superchats] upsert failed for ${video_id}:`, scErr);
      else totalNew += rows.length;
    } catch (e) {
      console.error(`[cron/superchats] failed for ${video_id}:`, e);
    }
  }

  return NextResponse.json({ superchats: totalNew, videos: videos.length });
}
