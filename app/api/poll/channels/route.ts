import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { YouTubeClient, getYouTubeApiKeys } from "@/lib/youtube/client";
import { extractChannel } from "@/lib/youtube/extractors";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return pollChannels();
}

export async function POST() {
  return pollChannels();
}

async function pollChannels(): Promise<NextResponse> {
  try {
    const ytKeys = getYouTubeApiKeys();
    if (ytKeys.length === 0) {
      return NextResponse.json({ error: "YOUTUBE_API_KEY missing" }, { status: 500 });
    }

    const { data: channels, error: dbErr } = await supabase
      .from("channels")
      .select("channel_id");

    if (dbErr) throw dbErr;
    if (!channels || channels.length === 0) {
      return NextResponse.json({ updated: 0 });
    }

    const channelIds = (channels as { channel_id: string }[]).map((c) => c.channel_id);
    const yt = new YouTubeClient(ytKeys);
    const now = new Date().toISOString();
    let updated = 0;

    for (let i = 0; i < channelIds.length; i += 50) {
      const batch = channelIds.slice(i, i + 50);
      const res = await yt.channels({
        part: "snippet,statistics",
        id: batch.join(","),
      });

      for (const item of res.items ?? []) {
        const channel = extractChannel(item);

        await supabase
          .from("channels")
          .upsert(channel, { onConflict: "channel_id" });

        await supabase.from("channel_stats_history").insert({
          channel_id: channel.channel_id,
          subscriber_count: channel.subscriber_count,
          view_count: channel.view_count,
          recorded_at: now,
        });

        updated++;
      }
    }

    return NextResponse.json({ updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/poll/channels]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
