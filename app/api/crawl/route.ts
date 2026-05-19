import { NextRequest, NextResponse } from "next/server";
import { YouTubeClient, getYouTubeApiKeys } from "@/lib/youtube/client";
import { VTrackerCrawler } from "@/lib/crawler/index";
import { TwitchClient } from "@/lib/twitch/client";
import { TwitchCrawler } from "@/lib/twitch/crawler";
import { VTrackerRepository } from "@/lib/supabase/repository";
import { supabase } from "@/lib/supabase/client";
import { parseChannelUrl } from "@/lib/crawler/urlParser";
import { extractVideo } from "@/lib/youtube/extractors";

function parseTwitchLogin(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("twitch.tv")) return null;
    const match = parsed.pathname.match(/^\/([a-zA-Z0-9_]{1,25})\/?$/);
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const v = parsed.searchParams.get("v");
    if (v) return v;
    const shorts = parsed.pathname.match(/\/shorts\/([^/]+)/);
    if (shorts) return shorts[1];
  } catch {
    // not a URL
  }
  return null;
}

// チャンネル追加後にRSSで最新動画を即時取り込む
async function importChannelVideos(channelId: string, yt: YouTubeClient): Promise<number> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    const rssRes = await fetch(rssUrl);
    if (!rssRes.ok) return 0;

    const xml = await rssRes.text();
    const matches = Array.from(xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g), (m) => m[1]);
    if (matches.length === 0) return 0;

    // 既存のビデオIDを確認
    const { data: existing } = await supabase
      .from("videos")
      .select("video_id")
      .in("video_id", matches);
    const existingIds = new Set((existing ?? []).map((r: { video_id: string }) => r.video_id));
    const newIds = matches.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) return 0;

    // 新しい動画のステータスを確認
    const ytRes = await yt.videos({ part: "snippet,liveStreamingDetails", id: newIds.join(",") });
    let added = 0;
    for (const item of ytRes.items ?? []) {
      const video = extractVideo(item);
      if (video.status === "live" || video.status === "upcoming") {
        await supabase.from("videos").upsert(video, { onConflict: "video_id" });
        added++;
      }
    }
    return added;
  } catch {
    return 0;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, groupId } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // ── Twitch URL ──────────────────────────────────────────────
    const twitchLogin = parseTwitchLogin(url.trim());
    if (twitchLogin) {
      const clientId = process.env.TWITCH_CLIENT_ID;
      const clientSecret = process.env.TWITCH_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        return NextResponse.json({ error: "TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET が未設定です" }, { status: 500 });
      }
      const tw = new TwitchClient(clientId, clientSecret);
      const repo = new VTrackerRepository(supabase);
      const twitchCrawler = new TwitchCrawler(tw, repo);
      const channelId = await twitchCrawler.addChannel(twitchLogin);

      if (groupId && channelId) {
        await supabase.from("channels").update({ group_id: groupId }).eq("channel_id", channelId);
      }

      return NextResponse.json({ ok: true, type: "channel", channelId, platform: "twitch" });
    }

    // ── YouTube ──────────────────────────────────────────────────
    const ytKeys = getYouTubeApiKeys();
    if (ytKeys.length === 0) {
      return NextResponse.json({ error: "YOUTUBE_API_KEY is not configured" }, { status: 500 });
    }

    const yt = new YouTubeClient(ytKeys);
    const repo = new VTrackerRepository(supabase);
    const crawler = new VTrackerCrawler(yt, repo);

    const videoId = extractVideoId(url);
    if (videoId) {
      await crawler.addVideo(videoId);
      return NextResponse.json({ ok: true, type: "video", videoId });
    }

    const ref = parseChannelUrl(url);
    if (ref) {
      const channelId = await crawler.addChannel(ref);

      if (groupId && channelId) {
        await supabase
          .from("channels")
          .update({ group_id: groupId })
          .eq("channel_id", channelId);
      } else if (!groupId && channelId) {
        // キーワード自動分類
        const { data: allGroups } = await supabase
          .from("groups")
          .select("id, keywords")
          .not("keywords", "is", null);
        const { data: channelData } = await supabase
          .from("channels")
          .select("description")
          .eq("channel_id", channelId)
          .single();
        const description = channelData?.description ?? "";
        const descLower = description.toLowerCase();

        let matchedGroupId: string | null = null;
        for (const g of (allGroups ?? []) as { id: string; keywords: string }[]) {
          if (!g.keywords) continue;
          const kws = g.keywords.split(",").map((k: string) => k.trim()).filter(Boolean);
          if (kws.some((kw: string) => descLower.includes(kw.toLowerCase()))) {
            matchedGroupId = g.id;
            break;
          }
        }

        if (!matchedGroupId) {
          const { data: indie } = await supabase.from("groups").select("id").eq("id", "indie").maybeSingle();
          if (indie) matchedGroupId = "indie";
        }

        if (matchedGroupId) {
          await supabase.from("channels").update({ group_id: matchedGroupId }).eq("channel_id", channelId);
        }
      }

      // チャンネル追加と同時にライブ中・予定動画を取り込む
      const liveFound = await importChannelVideos(channelId, yt);

      return NextResponse.json({ ok: true, type: "channel", channelId, liveFound });
    }

    return NextResponse.json({ error: `無効な URL: ${url}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[POST /api/crawl]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
