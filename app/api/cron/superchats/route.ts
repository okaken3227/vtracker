import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { YouTubeClient } from "@/lib/youtube/client";
import type { Video } from "@/lib/types";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
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
  const yt = new YouTubeClient(apiKey);

  // 為替レート取得
  let rates: Record<string, number> = {};
  try {
    const rateRes = await fetch("https://open.er-api.com/v6/latest/JPY");
    if (rateRes.ok) {
      const rateData = (await rateRes.json()) as { rates?: Record<string, number> };
      rates = rateData.rates ?? {};
    }
  } catch {
    // 失敗時は amount_jpy を null で保存して続行
  }

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
