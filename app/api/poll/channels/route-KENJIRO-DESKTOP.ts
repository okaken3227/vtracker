import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { YouTubeClient } from "@/lib/youtube/client";
import { TwitchClient } from "@/lib/twitch/client";
import { extractChannel } from "@/lib/youtube/extractors";
import { extractTwitchChannel } from "@/lib/twitch/extractors";

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

export async function POST(req: NextRequest) {
  let channelId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    channelId = typeof body?.channelId === "string" ? body.channelId : undefined;
  } catch {
    // no body
  }
  return pollChannels(channelId);
}

async function pollChannels(singleChannelId?: string): Promise<NextResponse> {
  try {
    const query = supabase.from("channels").select("channel_id, platform");
    if (singleChannelId) query.eq("channel_id", singleChannelId);

    const { data: channels, error: dbErr } = await query;
    if (dbErr) throw dbErr;
    if (!channels || channels.length === 0) return NextResponse.json({ updated: 0 });

    const allChannels = channels as { channel_id: string; platform?: string }[];
    const ytChannels = allChannels.filter((c) => !c.platform || c.platform === "youtube");
    const twitchChannels = allChannels.filter((c) => c.platform === "twitch");

    const now = new Date().toISOString();
    let updated = 0;

    // ── YouTube ──────────────────────────────────────────────────
    if (ytChannels.length > 0) {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (apiKey) {
        const yt = new YouTubeClient(apiKey);
        for (let i = 0; i < ytChannels.length; i += 50) {
          const batch = ytChannels.slice(i, i + 50).map((c) => c.channel_id);
          const res = await yt.channels({
            part: "snippet,statistics,brandingSettings",
            id: batch.join(","),
          });

          for (const item of res.items ?? []) {
            const channel = extractChannel(item);
            await supabase.from("channels").upsert(channel, { onConflict: "channel_id" });

            const { data: latest } = await supabase
              .from("channel_stats_history")
              .select("subscriber_count, view_count")
              .eq("channel_id", channel.channel_id)
              .order("recorded_at", { ascending: false })
              .limit(1)
              .single();

            if (
              !latest ||
              latest.subscriber_count !== channel.subscriber_count ||
              latest.view_count !== channel.view_count
            ) {
              await supabase.from("channel_stats_history").insert({
                channel_id: channel.channel_id,
                subscriber_count: channel.subscriber_count,
                view_count: channel.view_count,
                recorded_at: now,
              });
            }

            updated++;
          }
        }
      }
    }

    // ── Twitch ───────────────────────────────────────────────────
    if (twitchChannels.length > 0) {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;
      if (clientId && clientSecret) {
        const tw = new TwitchClient(clientId, clientSecret);

        for (let i = 0; i < twitchChannels.length; i += 100) {
          const batch = twitchChannels.slice(i, i + 100).map((c) => c.channel_id);
          const usersRes = await tw.users({ id: batch });

          for (const user of usersRes.data) {
            let followerCount = 0;
            try {
              const followersRes = await tw.channelFollowers(user.id);
              followerCount = followersRes.total;
            } catch {
              // follower endpoint may require broadcaster scope — use 0
            }

            const channel = extractTwitchChannel(user, followerCount);
            await supabase.from("channels").upsert(channel, { onConflict: "channel_id" });

            const { data: latest } = await supabase
              .from("channel_stats_history")
              .select("subscriber_count")
              .eq("channel_id", user.id)
              .order("recorded_at", { ascending: false })
              .limit(1)
              .single();

            if (!latest || latest.subscriber_count !== followerCount) {
              await supabase.from("channel_stats_history").insert({
                channel_id: user.id,
                subscriber_count: followerCount,
                view_count: 0,
                recorded_at: now,
              });
            }

            updated++;
          }
        }
      }
    }

    return NextResponse.json({ updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[poll/channels]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
