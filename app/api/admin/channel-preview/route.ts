import { NextRequest, NextResponse } from "next/server";
import { YouTubeClient, YouTubeApiError } from "@/lib/youtube/client";
import { parseChannelUrl } from "@/lib/crawler/urlParser";
import { extractChannel } from "@/lib/youtube/extractors";
import { supabase } from "@/lib/supabase/client";

async function detectGroup(description: string): Promise<string | null> {
  const { data: groups } = await supabase
    .from("groups")
    .select("id, keywords")
    .not("keywords", "is", null);

  const descLower = description.toLowerCase();
  for (const g of (groups ?? []) as { id: string; keywords: string }[]) {
    const kws = g.keywords.split(",").map((k: string) => k.trim()).filter(Boolean);
    if (kws.some((kw: string) => descLower.includes(kw.toLowerCase()))) return g.id;
  }

  const { data: indie } = await supabase.from("groups").select("id").eq("id", "indie").maybeSingle();
  return indie ? "indie" : null;
}

function quotaError() {
  return NextResponse.json(
    { error: "YouTube API のクォータ上限に達しています。本日の上限は太平洋時間の深夜0時（日本時間17時）にリセットされます。" },
    { status: 429 },
  );
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "url は必須です" }, { status: 400 });

  const trimmed = (url as string).trim();
  const ref = parseChannelUrl(trimmed);

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "YOUTUBE_API_KEY が未設定です" }, { status: 500 });
  const yt = new YouTubeClient(apiKey);

  // 名前検索: URLでもハンドルでもないテキストはチャンネル検索（100ユニット）
  if (!ref) {
    try {
      const searchRes = await yt.search({
        part: "snippet",
        type: "channel",
        q: trimmed,
        maxResults: "3",
      });
      const candidates = (searchRes.items ?? [])
        .map((item) => ({
          channelId: item.id.channelId ?? item.snippet.channelId ?? "",
          name: item.snippet.title ?? "",
          iconUrl: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? "",
          description: item.snippet.description ?? "",
        }))
        .filter((c) => c.channelId);
      return NextResponse.json({ candidates });
    } catch (err) {
      if (err instanceof YouTubeApiError && err.status === 403) return quotaError();
      return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  try {
    let channelId: string;

    if (ref.type === "id") {
      channelId = ref.value;
      const { data: existing } = await supabase
        .from("channels")
        .select("*")
        .eq("channel_id", channelId)
        .maybeSingle();
      if (existing) {
        const detectedGroupId = await detectGroup(existing.description ?? "");
        return NextResponse.json({
          channelId: existing.channel_id,
          name: existing.name,
          iconUrl: existing.icon_url,
          description: existing.description,
          detectedGroupId,
          alreadyExists: true,
          existingGroupId: existing.group_id ?? null,
          source: "db",
        });
      }
    } else if (ref.type === "handle") {
      const { data: dbByHandle } = await supabase
        .from("channels")
        .select("*")
        .eq("custom_url", `@${ref.value}`)
        .maybeSingle();
      if (dbByHandle) {
        const detectedGroupId = await detectGroup(dbByHandle.description ?? "");
        return NextResponse.json({
          channelId: dbByHandle.channel_id,
          name: dbByHandle.name,
          iconUrl: dbByHandle.icon_url,
          description: dbByHandle.description,
          detectedGroupId,
          alreadyExists: true,
          existingGroupId: dbByHandle.group_id ?? null,
          source: "db",
        });
      }
      const res = await yt.channels({ part: "id", forHandle: ref.value });
      channelId = res.items?.[0]?.id ?? "";
      if (!channelId) return NextResponse.json({ error: "チャンネルが見つかりません" }, { status: 404 });
    } else {
      // video_id: 動画からチャンネルIDを取得
      const videoRes = await yt.videos({ part: "snippet", id: ref.value });
      const videoItem = videoRes.items?.[0];
      if (!videoItem) return NextResponse.json({ error: "動画が見つかりません" }, { status: 404 });
      channelId = videoItem.snippet.channelId;
    }

    const channelRes = await yt.channels({ part: "snippet,statistics", id: channelId });
    const item = channelRes.items?.[0];
    if (!item) return NextResponse.json({ error: "チャンネルが見つかりません" }, { status: 404 });

    const channel = extractChannel(item);
    const detectedGroupId = await detectGroup(channel.description);

    const { data: existing } = await supabase
      .from("channels")
      .select("channel_id, group_id")
      .eq("channel_id", channelId)
      .maybeSingle();

    return NextResponse.json({
      channelId: channel.channel_id,
      name: channel.name,
      iconUrl: channel.icon_url,
      description: channel.description,
      detectedGroupId,
      alreadyExists: !!existing,
      existingGroupId: existing?.group_id ?? null,
      source: "youtube",
    });
  } catch (err) {
    if (err instanceof YouTubeApiError && err.status === 403) return quotaError();
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
