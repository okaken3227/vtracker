import { NextRequest, NextResponse } from "next/server";
import { YouTubeClient } from "@/lib/youtube/client";

export type BulkSearchResult = {
  query: string;
  channelId: string;
  channelName: string;
  thumbnail: string;
  description: string;
};

// YouTube search は100ユニット/回と高コストなので1バッチ最大20件まで
const MAX_PER_REQUEST = 20;

export async function POST(req: NextRequest) {
  const { names, suffix } = await req.json() as { names: string[]; suffix?: string };

  if (!Array.isArray(names) || names.length === 0) {
    return NextResponse.json({ error: "names は必須です" }, { status: 400 });
  }
  if (names.length > MAX_PER_REQUEST) {
    return NextResponse.json(
      { error: `一度に検索できるのは ${MAX_PER_REQUEST} 件までです` },
      { status: 400 },
    );
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY missing" }, { status: 500 });
  }

  const yt = new YouTubeClient(apiKey);
  const results: BulkSearchResult[] = [];
  const errors: string[] = [];

  for (const name of names) {
    try {
      const q = suffix ? `${name} ${suffix}` : name;
      const res = await yt.search({
        part: "snippet",
        q,
        type: "channel",
        maxResults: "1",
      });

      const item = res.items?.[0];
      if (!item) {
        errors.push(`${name}: チャンネルが見つかりませんでした`);
        continue;
      }

      const channelId = item.id.channelId ?? item.snippet.channelId;
      results.push({
        query: name,
        channelId,
        channelName: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? "",
        description: item.snippet.description.slice(0, 80),
      });
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ results, errors });
}
